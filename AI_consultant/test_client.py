"""Tests for AIClient message building (single system prompt guarantee)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from main import AIClient


def _client():
    return AIClient.__new__(AIClient)


def test_build_messages_single_system_message():
    client = _client()
    sp = "你是网站助手"
    history = [
        {"role": "system", "content": "[用户记忆]\n- 用户使用 Laravel"},
        {"role": "user", "content": "你好"},
        {"role": "assistant", "content": "你好！"},
    ]
    msgs = client._build_messages(sp, history, "帮我查一下")
    system_msgs = [m for m in msgs if m.get("role") == "system"]
    assert len(system_msgs) == 1, f"expected exactly 1 system message, got {len(system_msgs)}"
    assert "你是网站助手" in system_msgs[0]["content"]
    assert "[用户记忆]" in system_msgs[0]["content"]
    assert system_msgs[0] is msgs[0]


def test_build_messages_no_system_history_unchanged():
    client = _client()
    sp = "你是网站助手"
    history = [{"role": "user", "content": "你好"}]
    msgs = client._build_messages(sp, history, "接着聊")
    system_msgs = [m for m in msgs if m.get("role") == "system"]
    assert len(system_msgs) == 1
    assert system_msgs[0]["content"] == sp


def test_build_messages_memory_without_base_prompt():
    client = _client()
    history = [{"role": "system", "content": "[用户记忆]\n- 用户喜欢深色主题"}]
    msgs = client._build_messages("", history, "hello")
    system_msgs = [m for m in msgs if m.get("role") == "system"]
    assert len(system_msgs) == 1
    assert "[用户记忆]" in system_msgs[0]["content"]
