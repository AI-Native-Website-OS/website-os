"""单文件记忆系统自检：迁移（6文件→1）与整合写入。

运行： python selftest_memory.py
"""

import os
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import MemoryManager, ChatGPT, MEMORY_MD  # noqa: E402
import main  # noqa: E402


class _Cfg:
    memory_short_term_size = 20
    memory_long_term_enabled = True
    memory_context_budget_chars = 3000


class _TestMemoryManager(MemoryManager):
    """绕过 __init__ 的目录探测，把记忆目录指向临时路径。"""

    def __init__(self, cfg, base: Path):
        self.config = cfg
        self.short_term = []
        self.MEMORY_DIR = base
        self.MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        self.migrate_legacy()


def test_migration():
    base = Path(tempfile.mkdtemp())
    try:
        u = base / "NORMAL_USER" / "alice"
        u.mkdir(parents=True)
        (u / "profile.md").write_text("# alice 的用户画像\n> 角色: NORMAL_USER\n- 姓名：爱丽丝\n", "utf-8")
        (u / "preferences.md").write_text("- 偏好中文回答\n", "utf-8")
        (u / "knowledge.md").write_text("- 用户使用 Laravel\n", "utf-8")
        (u / "conversation.md").write_text("- [2026-01-02 10:00] 讨论了部署方案\n", "utf-8")
        (u / "decisions.md").write_text("- 决定使用 MySQL\n", "utf-8")
        (u / "timeline.md").write_text("- [2026-01-03 09:00] 项目启动\n", "utf-8")
        (u / "MEMORY.md").write_text(
            "# alice 的记忆\n> 自动生成的长期记忆文件\n- [2026-01-01 08:00] **user**: 你好\n", "utf-8")
        (u / ".index.json").write_text("{}", "utf-8")

        mm = _TestMemoryManager(_Cfg(), base)
        text = mm.read_file("alice", "NORMAL_USER")
        assert text.lstrip().startswith("# Memory"), text
        for section in ("## Profile", "## Preferences", "## Facts", "## Decisions", "## Timeline"):
            assert section in text, f"missing {section}\n{text}"
        for token in ("爱丽丝", "Laravel", "MySQL", "部署方案", "项目启动"):
            assert token in text, f"missing {token}\n{text}"

        for fn in mm.LEGACY_FILENAMES:
            assert not (u / fn).exists(), f"legacy {fn} not deleted"
        assert not (u / ".index.json").exists(), ".index.json not deleted"

        mm.migrate_legacy()
        assert mm.read_file("alice", "NORMAL_USER") == text, "migration not idempotent"
        print("[PASS] migration (6 files -> MEMORY.md, legacy deleted, idempotent)")
    finally:
        shutil.rmtree(base, ignore_errors=True)


def test_consolidation_and_injection():
    base = Path(tempfile.mkdtemp())
    try:
        mm = _TestMemoryManager(_Cfg(), base)
        mm.init_user("NORMAL_USER/bob")
        assert (base / "NORMAL_USER" / "bob" / MEMORY_MD).exists()

        eng = object.__new__(ChatGPT)
        eng.config = _Cfg()
        eng.memory = mm

        class _FakeClient:
            def chat(self, sp, history, user_input):
                return {"content": "# Memory\n\n> updated: 2026-01-01 00:00\n\n## Facts\n- Likes coffee\n"}

        eng.client = _FakeClient()
        eng._consolidate_memory_once("bob", "NORMAL_USER", "我喜欢咖啡", "好的")
        text = mm.read_file("bob", "NORMAL_USER")
        assert "coffee" in text and text.lstrip().startswith("# Memory"), text

        blocks = mm.build_memory_blocks("bob", "NORMAL_USER")
        assert blocks and blocks[0].type == "memory" and "coffee" in blocks[0].content

        assert mm.search("bob", "coffee", "NORMAL_USER"), "keyword search failed"
        print("[PASS] consolidation write + whole-file injection + search")
    finally:
        shutil.rmtree(base, ignore_errors=True)


def test_relocate_orphan():
    base = Path(tempfile.mkdtemp())
    try:
        mm = _TestMemoryManager(_Cfg(), base)
        u = base / "_" / "超级管理"
        u.mkdir(parents=True)
        (u / MEMORY_MD).write_text(
            "# Memory\n\n> updated: 2026-01-01 00:00\n\n## Facts\n- x\n", "utf-8")
        moved = mm.relocate_orphan_memories(
            lambda name: "SUPER_ADMIN" if name == "超级管理" else "")
        assert moved == 1, moved
        assert (base / "SUPER_ADMIN" / "超级管理" / MEMORY_MD).exists()
        assert not (base / "_" / "超级管理").exists()
        print("[PASS] relocate orphan memory (_/x -> SUPER_ADMIN/x)")
    finally:
        shutil.rmtree(base, ignore_errors=True)


class _FakeEmbedder:
    base_url = "http://fake"
    model = "fake"

    def embed_batch(self, texts):
        return [[1.0, 0.0] if "coffee" in t.lower() else [0.0, 1.0] for t in texts]


class _FailingEmbedder:
    base_url = "http://fake"
    model = "fake"

    def embed_batch(self, texts):
        raise RuntimeError("boom")


class _FakeReranker:
    enabled = True

    def rerank(self, query, documents, top_n=None):
        return [{"index": i, "relevance_score": 1.0 - i * 0.01} for i in range(len(documents))]


def test_memory_retrieval_and_budget():
    base = Path(tempfile.mkdtemp())
    try:
        mm = _TestMemoryManager(_Cfg(), base)
        mm.init_user("NORMAL_USER/carol")
        body = ("# Memory\n\n> updated: 2026-01-01 00:00\n\n"
                "## Preferences\n- likes coffee\n\n"
                "## Facts\n- drives a truck\n- lives in Berlin\n")
        mm.write_file("carol", body, "NORMAL_USER")

        items = mm._memory_items(mm._memory_body(body))
        labels = [it["label"] for it in items]
        assert labels[0] == "Preferences: likes coffee", labels

        mm._emb = _FakeEmbedder()
        mm._rr = _FakeReranker()
        sel = mm._retrieve_memory(items, "do you like coffee?", 1000)
        assert sel and "coffee" in sel[0], sel

        sel_small = mm._retrieve_memory(items, "coffee", 2)
        assert len(sel_small) == 1 and "coffee" in sel_small[0], sel_small
        assert main.count_tokens("\n".join(sel_small)) <= 2, sel_small

        mm._emb = _FailingEmbedder()
        blocks = mm.build_memory_blocks("carol", "NORMAL_USER", query="coffee")
        assert blocks and "drives a truck" in blocks[0].content, blocks
        print("[PASS] memory retrieval + rerank + token budget + fallback")
    finally:
        shutil.rmtree(base, ignore_errors=True)


if __name__ == "__main__":
    test_migration()
    test_consolidation_and_injection()
    test_relocate_orphan()
    test_memory_retrieval_and_budget()
    print("all memory selftests passed")
