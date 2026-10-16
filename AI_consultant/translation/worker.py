"""后台翻译 worker：轮询 translation_jobs，调用 LLM 翻译并写回 translation_entries。

- 使用 ``FOR UPDATE SKIP LOCKED`` 领取任务，支持多进程/多实例并发消费而不重复。
- 幂等：entries 按 (resource_type, resource_id, field, locale) upsert。
- 失败：指数型退避重试，超过 MAX_ATTEMPTS 置为 failed 并记录 error。
"""

import logging
import threading
import time
from typing import List

from sqlalchemy import text as sqltext

from db import _engine

from .config import translation_enabled
from .langdet import detect_lang
from .pipeline import translate_texts

logger = logging.getLogger("translation.worker")

POLL_INTERVAL = 3.0
BATCH_SIZE = 20
MAX_ATTEMPTS = 5

_thread = None
_stop = threading.Event()


def _claim_batch(batch: int) -> List[dict]:
    """领取并占用一批待办任务（置 running）。"""
    with _engine().begin() as conn:
        rows = conn.execute(
            sqltext(
                "SELECT id, resource_type, resource_id, field, locale, source_hash, source_text, kind, attempts "
                "FROM translation_jobs WHERE status = 'pending' "
                "ORDER BY created_at ASC LIMIT :lim FOR UPDATE SKIP LOCKED"
            ),
            {"lim": batch},
        ).fetchall()
        if not rows:
            return []
        ids = [r[0] for r in rows]
        conn.execute(
            sqltext(
                "UPDATE translation_jobs SET status='running', attempts=attempts+1, updated_at=now() "
                "WHERE id = ANY(:ids)"
            ),
            {"ids": ids},
        )
        return [dict(r._mapping) for r in rows]


def _upsert_entry(conn, job: dict, translated: str):
    conn.execute(
        sqltext(
            "INSERT INTO translation_entries "
            "(resource_type, resource_id, field, locale, source_hash, source_text, translated_text, status, engine, created_at, updated_at) "
            "VALUES (:rt, :rid, :f, :loc, :sh, :st, :tt, 'final', 'llm', now(), now()) "
            "ON CONFLICT (resource_type, resource_id, field, locale) DO UPDATE SET "
            "source_hash = EXCLUDED.source_hash, source_text = EXCLUDED.source_text, "
            "translated_text = EXCLUDED.translated_text, status = EXCLUDED.status, "
            "engine = EXCLUDED.engine, updated_at = now()"
        ),
        {
            "rt": job["resource_type"],
            "rid": job["resource_id"],
            "f": job["field"],
            "loc": job["locale"],
            "sh": job["source_hash"],
            "st": job["source_text"],
            "tt": translated,
        },
    )


def _mark(conn, job_id: int, status: str, error: str = None):
    conn.execute(
        sqltext("UPDATE translation_jobs SET status=:s, error=:e, updated_at=now() WHERE id=:id"),
        {"s": status, "e": error, "id": job_id},
    )


def _resolve_failure(job: dict, error: str):
    """失败后：未达上限则回到 pending 重试，否则置 failed。"""
    current_attempt = int(job.get("attempts") or 0) + 1  # SELECT 时 attempts 为自增前的值
    error = (error or "")[:2000]
    try:
        with _engine().begin() as conn:
            if current_attempt >= MAX_ATTEMPTS:
                _mark(conn, job["id"], "failed", error)
                logger.warning("job %s failed permanently after %s attempts: %s", job["id"], current_attempt, error)
            else:
                _mark(conn, job["id"], "pending", error)
    except Exception:
        logger.exception("failed to update job %s status", job["id"])


def _process(rows: List[dict]):
    # 按（源语言, 目标语言）分组翻译，支持中英双向（源语言自动识别）。
    groups: dict = {}
    for idx, r in enumerate(rows):
        text = r.get("source_text") or ""
        target = str(r.get("locale") or "en").strip().lower()
        if not text.strip():
            groups.setdefault((None, None), []).append((idx, text))
            continue
        source = detect_lang(text)
        groups.setdefault((source, target), []).append((idx, text))

    results: List = [None] * len(rows)
    for (source, target), items in groups.items():
        if source is None:
            for idx, text in items:
                results[idx] = text.strip()
            continue
        batch = [text for _, text in items]
        try:
            translated = translate_texts(batch, source, target)
        except Exception as exc:
            logger.warning("batch translate raised: %s", exc)
            translated = [None] * len(batch)
        for (idx, _text), value in zip(items, translated):
            results[idx] = (value or "").strip()

    for job, translated in zip(rows, results):
        value = (translated or "").strip()
        if not value:
            _resolve_failure(job, "empty translation")
            continue
        try:
            with _engine().begin() as conn:
                _upsert_entry(conn, job, value)
                _mark(conn, job["id"], "done", None)
        except Exception as exc:
            logger.exception("persist translation for job %s failed", job["id"])
            _resolve_failure(job, str(exc))


def _run():
    logger.info("translation worker started")
    while not _stop.is_set():
        try:
            if not translation_enabled():
                _stop.wait(POLL_INTERVAL)
                continue
            rows = _claim_batch(BATCH_SIZE)
            if not rows:
                _stop.wait(POLL_INTERVAL)
                continue
            _process(rows)
        except Exception:
            logger.exception("translation worker loop error")
            _stop.wait(POLL_INTERVAL)
    logger.info("translation worker stopped")


def start_worker():
    global _thread
    if _thread is not None and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_run, name="translation-worker", daemon=True)
    _thread.start()
    logger.info("translation worker thread launched")
