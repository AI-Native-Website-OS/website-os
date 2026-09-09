"""Tests for the backend-controlled thinking switch (LLM_THINKING_ENABLED)."""

import os
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))

import main
from main import Config, ChatGPT


@patch("main._db_model_config_values", return_value={})
def test_config_thinking_enabled_defaults_false_when_unset(_mock_db):
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("LLM_THINKING_ENABLED", None)
        cfg = Config()
    assert cfg.llm_thinking_enabled is False


@patch("main._db_model_config_values", return_value={})
def test_config_thinking_enabled_true_from_env(_mock_db):
    with patch.dict(os.environ, {"LLM_THINKING_ENABLED": "true"}, clear=False):
        cfg = Config()
    assert cfg.llm_thinking_enabled is True


@patch("main._db_model_config_values", return_value={})
def test_config_thinking_enabled_db_overrides_env(_mock_db):
    # DB 值优先于环境变量（后台模型参数配置保存后热生效）
    with patch.dict(os.environ, {"LLM_THINKING_ENABLED": "true"}, clear=False):
        with patch("main._db_model_config_values", return_value={"LLM_THINKING_ENABLED": "false"}):
            cfg = Config()
    assert cfg.llm_thinking_enabled is False


def test_chat_resolves_use_thinking_from_config():
    eng = ChatGPT.__new__(ChatGPT)
    eng.config = _Config(thinking_enabled=False)

    # 未显式传入 use_thinking 时，取后台配置值（关闭）
    assert eng._resolve_use_thinking(None) is False
    # 显式传入时优先使用请求值
    assert eng._resolve_use_thinking(True) is True
    assert eng._resolve_use_thinking(False) is False


class _Config:
    def __init__(self, thinking_enabled=True):
        self.llm_thinking_enabled = thinking_enabled