"""Tests for ChatGPT._do_stream fallback when the model only emits reasoning_content."""

import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent))

from main import ChatGPT


class _Usage:
    def __init__(self, prompt=0, completion=0):
        self.prompt_tokens = prompt
        self.completion_tokens = completion


class _Delta:
    def __init__(self, content="", reasoning_content=None):
        self.content = content
        self.reasoning_content = reasoning_content
        self.reasoning = None


class _Choice:
    def __init__(self, delta):
        self.delta = delta


class _Chunk:
    def __init__(self, delta, usage=None):
        self.choices = [_Choice(delta)]
        self.usage = usage


class _Tokens:
    def record(self, *a, **k):
        pass


class _Client:
    def __init__(self, stream, model="qwen3.8"):
        self._stream = stream
        self.llm_model = model

    def chat_stream(self, *a, **k):
        return self._stream

    @staticmethod
    def _extract_thinking(content, reasoning=None):
        clean = content
        parts = reasoning or ""
        for tag, close in [("<thinking>", "</thinking>"), ("<reasoning>", "</reasoning>")]:
            while True:
                si = clean.find(tag)
                if si == -1:
                    break
                ei = clean.find(close, si + len(tag))
                if ei == -1:
                    break
                inner = clean[si + len(tag):ei].strip()
                if inner:
                    parts = f"{parts}\n\n{inner}" if parts else inner
                clean = clean[:si] + clean[ei + len(close):]
        return clean, (parts or None)


class _Config:
    llm_model = "qwen3.8"


class _Session:
    def __init__(self):
        self.session_id = "test_sid"


def _build(stream, use_thinking):
    eng = ChatGPT.__new__(ChatGPT)
    eng.config = _Config()
    eng.client = _Client(stream)
    eng.tokens = _Tokens()
    session = _Session()
    chunks = []
    reasoning = []
    result = eng._do_stream(
        session, "sp", [], "你好", None,
        on_chunk=lambda t: chunks.append(t),
        on_reasoning=lambda t: reasoning.append(t),
        use_thinking=use_thinking,
    )
    return result, "".join(chunks), "".join(reasoning)


def test_thinking_off_reasoning_only_streams_as_content():
    # 网关未禁用思考：所有输出进入 reasoning_content，正文为空。
    # 思考关闭时把 reasoning 当作正文逐块流式输出，保留打字机效果并避免空白响应。
    stream = [
        _Chunk(_Delta(reasoning_content="需要"), usage=_Usage(10, 5)),
        _Chunk(_Delta(reasoning_content="用中文回答")),
        _Chunk(_Delta(), usage=_Usage(10, 8)),
    ]
    result, chunks, reasoning = _build(stream, use_thinking=False)
    assert result["content"] == "需要用中文回答", result
    assert result["reasoning"] is None
    # 思考关闭时以正文方式流式输出（on_chunk），不走 on_reasoning
    assert chunks == "需要用中文回答"
    assert reasoning == ""


def test_thinking_on_reasoning_only_keeps_reasoning():
    stream = [
        _Chunk(_Delta(reasoning_content="思考一下")),
        _Chunk(_Delta()),
    ]
    result, chunks, reasoning = _build(stream, use_thinking=True)
    assert result["content"] == ""
    assert result["reasoning"] == "思考一下"


def test_thinking_off_with_real_content_streams_all():
    stream = [
        _Chunk(_Delta(reasoning_content="内部思考")),
        _Chunk(_Delta(content="你好，我是顾问")),
        _Chunk(_Delta()),
    ]
    result, chunks, reasoning = _build(stream, use_thinking=False)
    # 思考关闭时 reasoning 也被当作正文流式输出，与后续正文拼接
    assert result["content"] == "内部思考你好，我是顾问"
    assert result["reasoning"] is None
    assert chunks == "内部思考你好，我是顾问"


def test_thinking_off_reasoning_plus_content_streams_both():
    stream = [
        _Chunk(_Delta(reasoning_content="想了一下")),
        _Chunk(_Delta(content="最终答案")),
        _Chunk(_Delta()),
    ]
    result, chunks, reasoning = _build(stream, use_thinking=False)
    assert result["content"] == "想了一下最终答案"
    assert result["reasoning"] is None
    assert chunks == "想了一下最终答案"


def test_thinking_on_normal_content_streams():
    stream = [
        _Chunk(_Delta(reasoning_content="思考中")),
        _Chunk(_Delta(content="正常")),
        _Chunk(_Delta(content="回答")),
        _Chunk(_Delta()),
    ]
    result, chunks, reasoning = _build(stream, use_thinking=True)
    assert result["content"] == "正常回答"
    assert result["reasoning"] == "思考中"
    assert "".join(chunks) == "正常回答"
    assert "".join(reasoning) == "思考中"
