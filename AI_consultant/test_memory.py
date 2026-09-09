"""Tests for MemoryManager layered memory (index, hybrid recall, dedup, budget, warmup)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest

from main import MemoryManager, _warmup_threshold


class _Cfg:
    memory_short_term_size = 20
    memory_long_term_enabled = True
    memory_context_budget_chars = 2000
    memory_dedup_threshold = 0.90
    memory_recall_top_k = 8
    memory_extract_max_interval = 16
    memory_warmup_enabled = True
    embedding_base_url = ""
    embedding_model = ""
    embedding_api_key = ""


@pytest.fixture()
def mm(tmp_path):
    m = MemoryManager(_Cfg())
    m.MEMORY_DIR = tmp_path
    m._index_cache.clear()
    return m


def _write(mm, username, role, filename, text):
    user_dir = mm.MEMORY_DIR / (role or "_") / username
    user_dir.mkdir(parents=True, exist_ok=True)
    (user_dir / filename).write_text(text, "utf-8")


def test_parse_entries_formats(mm):
    text = (
        "# header\n> note\n\n"
        "- [2026-08-12T10:00:00] **user**: hello world\n"
        "- [2026-08-12 10:00] 用户是前端工程师\n"
        "not a bullet\n"
    )
    entries = mm._parse_entries_from_text(text)
    assert len(entries) == 2
    assert entries[0]["content"] == "hello world"
    assert entries[0]["timestamp"] > 0
    assert entries[1]["content"] == "用户是前端工程师"


def test_index_rebuild_and_cache(mm, tmp_path):
    user_dir = tmp_path / "_" / "alice"
    user_dir.mkdir(parents=True)
    p = user_dir / "knowledge.md"
    p.write_text("# 事实\n- [2026-08-12 10:00] 用户使用 Laravel\n", "utf-8")
    entries = mm._load_entries("alice", "")
    assert len(entries) == 1
    assert entries[0]["file_type"] == "knowledge"
    assert (user_dir / ".index.json").exists()
    # cached second read (same instance, unchanged files)
    assert mm._load_entries("alice", "") == entries
    # append → rebuild picks up new entry
    with p.open("a", encoding="utf-8") as f:
        f.write("- [2026-08-12 11:00] 服务器在东京\n")
    entries2 = mm._load_entries("alice", "")
    assert len(entries2) == 2


def test_recall_keyword_only_ranks(mm, tmp_path):
    _write(mm, "bob", "", "knowledge.md",
           "- [2026-08-12 10:00] 用户使用 Laravel 开发\n"
           "- [2026-08-12 10:00] 用户喜欢喝咖啡\n")
    res = mm.recall("bob", "Laravel 项目", top_k=5)
    assert res
    assert res[0]["content"].startswith("用户使用 Laravel")
    assert all(r["username"] == "bob" for r in res)
    assert all("score" in r for r in res)


def test_recall_user_isolation(mm, tmp_path):
    for name in ("carol", "dave"):
        _write(mm, name, "", "knowledge.md",
               f"- [2026-08-12 10:00] 唯一关键词 XYZ789 是{name}的\n")
    res = mm.recall("carol", "XYZ789", top_k=10)
    assert res
    assert all(r["username"] == "carol" for r in res)
    assert all("dave" not in r["content"] for r in res)


def test_dedup_exact(mm, tmp_path):
    _write(mm, "erin", "", "preferences.md",
           "- [2026-08-12 10:00] 偏好深色主题\n")
    assert mm.is_duplicate("erin", "", "preferences", "偏好深色主题")
    assert not mm.is_duplicate("erin", "", "preferences", "偏好浅色主题")
    assert not mm.is_duplicate("erin", "", "knowledge", "偏好深色主题")


def test_get_context_budget_trims(mm, tmp_path):
    cfg = mm.config
    cfg.memory_context_budget_chars = 30
    _write(mm, "frank", "", "profile.md",
           "# 画像\n> x\n\n- [2026-08-12 10:00] 姓名 Frank\n")
    _write(mm, "frank", "", "knowledge.md",
           "- [2026-08-12 10:00] 服务器在东京\n"
           f"- [2026-08-12 10:00] {'长' * 200}\n")
    ctx = mm.get_context([], username="frank", query="服务器")
    assert ctx
    block = ctx[0]["content"]
    assert "[用户记忆]" in block
    assert "姓名 Frank" in block  # persona always injected
    assert "长" * 200 not in block  # budget trimmed long line


def test_get_context_query_relevance_beats_recency(mm, tmp_path):
    cfg = mm.config
    cfg.memory_context_budget_chars = 30
    _write(mm, "gina", "", "knowledge.md",
           "- [2026-08-12 10:00] 用户使用 PostgreSQL\n"
           "- [2026-08-12 12:00] 用户使用 MongoDB\n")
    msgs = [{"role": "user", "content": "PostgreSQL 相关?"}, {"role": "assistant", "content": "ok"}]
    ctx = mm.get_context(msgs, username="gina")
    block = ctx[0]["content"]
    assert "PostgreSQL" in block  # relevant to current question
    assert "MongoDB" not in block  # newest-but-irrelevant trimmed


def test_warmup_thresholds():
    assert [_warmup_threshold(i, 16) for i in range(6)] == [1, 2, 4, 8, 16, 16]
    assert _warmup_threshold(0, 2) == 1


def test_cosine():
    assert MemoryManager._cosine([1, 0], [1, 0]) == pytest.approx(1.0)
    assert MemoryManager._cosine([1, 0], [0, 1]) == pytest.approx(0.0)
    assert MemoryManager._cosine([], []) == 0.0
