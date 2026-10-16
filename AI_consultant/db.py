import os
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from sqlalchemy.engine import URL

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import dotenv

# ── 加载根目录 .env 文件 ──────────────────────────────────────
for _env_path in [
    str(Path(__file__).resolve().parent.parent / ".env"),      # project-root/.env
    "/app/.env",                                               # Docker /app/.env
]:
    dotenv.load_dotenv(_env_path, override=False)

# ── PostgreSQL ────────────────────────────────────────────────────

PG_HOST = os.getenv("PG_HOST")
PG_PORT = os.getenv("PG_PORT")
PG_DATABASE = os.getenv("PG_DATABASE")
PG_USER = os.getenv("PG_USER")
PG_PASSWORD = os.getenv("PG_PASSWORD")

DATABASE_URL = URL.create(
    drivername="postgresql+psycopg2",
    username=PG_USER,
    password=PG_PASSWORD,
    host=PG_HOST,
    port=int(PG_PORT),
    database=PG_DATABASE,
)

@lru_cache(maxsize=1)
def _engine():
    return create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=3600,
    )

@lru_cache(maxsize=1)
def _session_maker():
    return sessionmaker(bind=_engine(), expire_on_commit=False)


@contextmanager
def get_db():
    db = _session_maker()()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── 系统引导密钥（system_secrets，后端启动时自动生成）──────────────

_SECRET_CACHE_TTL = 10.0
_secret_cache = {"ts": 0.0, "values": None}


def _load_all_system_secrets():
    """读取 system_secrets 全表；返回 (dict, ok)。异常时 ok=False，不污染缓存。"""
    try:
        from sqlalchemy import text
        with get_db() as db:
            rows = db.execute(
                text("SELECT secret_key, secret_value FROM system_secrets")
            ).fetchall()
        return {r[0]: r[1] for r in rows}, True
    except Exception:
        return {}, False


def get_system_secret(key: str) -> str:
    """读取引导密钥（JWT_SECRET / AI_INTERNAL_TOKEN / CONFIG_CRYPTO_AES_KEY）。

    带短 TTL 缓存；读取失败或缺失时返回空串（调用方据此判定未就绪）。
    """
    import time
    now = time.time()
    if _secret_cache["values"] is None or now - _secret_cache["ts"] > _SECRET_CACHE_TTL:
        values, ok = _load_all_system_secrets()
        if not ok:
            return ""
        _secret_cache["values"] = values
        _secret_cache["ts"] = now
    return (_secret_cache["values"].get(key) or "").strip()


# ── Redis ─────────────────────────────────────────────────────────

REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT")
REDIS_USER = os.getenv("REDIS_USER") or None
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None
REDIS_DATABASE = os.getenv("REDIS_DATABASE")

_redis_client = None


def get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            import redis as _r
            _redis_client = _r.Redis(
                host=REDIS_HOST,
                port=int(REDIS_PORT),
                username=REDIS_USER,
                password=REDIS_PASSWORD,
                db=int(REDIS_DATABASE),
                decode_responses=True,
            )
            _redis_client.ping()
        except Exception:
            _redis_client = None
    return _redis_client


# ── Helpers ───────────────────────────────────────────────────────

def cache_active_session(session_id: str):
    r = get_redis()
    if r:
        try:
            r.set("active_session", session_id)
        except Exception:
            pass


def get_cached_active_session() -> str | None:
    r = get_redis()
    if r:
        try:
            return r.get("active_session")
        except Exception:
            pass
    return None


def cache_short_term(session_id: str, entry: dict):
    r = get_redis()
    if r:
        try:
            import json
            key = f"short_term:{session_id}"
            r.lpush(key, json.dumps(entry, ensure_ascii=False))
            r.ltrim(key, 0, 19)
            r.expire(key, 86400)
        except Exception:
            pass


def get_cached_short_term(session_id: str) -> list:
    r = get_redis()
    if r:
        try:
            import json
            key = f"short_term:{session_id}"
            items = r.lrange(key, 0, -1)
            return [json.loads(i) for i in items]
        except Exception:
            pass
    return []


def clear_short_term_cache(session_id: str = ""):
    r = get_redis()
    if r:
        try:
            if session_id:
                r.delete(f"short_term:{session_id}")
            else:
                for k in r.scan_iter("short_term:*"):
                    r.delete(k)
        except Exception:
            pass
