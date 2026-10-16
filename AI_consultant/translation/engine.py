"""翻译引擎抽象层。

一期仅实现 LlmEngine（复用现有 OpenAI 兼容 LLM，无新增依赖）。
NmtEngine 为预留实现：未来接入超轻量 CTranslate2 小模型时，只需在此新增实现并让
``get_engine`` 识别 ``translation_engine == 'nmt'`` 即可，其余组件不变。
"""

import logging
import threading
from typing import List

from .config import get_setting

logger = logging.getLogger("translation.engine")

DEFAULT_PROMPT = (
    "You are a professional Chinese-to-English translator for a corporate website. "
    "Translate the user's Chinese text into fluent, natural, business-appropriate English. "
    "Output ONLY the translation, with no explanations, notes, or surrounding quotes. "
    "Preserve all numbers, units, dates, punctuation, markdown/HTML tags, links and placeholders "
    "(such as {name}, %s) exactly as-is. Keep brand, product and person names unchanged when appropriate."
)

EN_TO_ZH_PROMPT = (
    "You are a professional English-to-Chinese translator for a corporate website. "
    "Translate the user's English text into fluent, natural, business-appropriate Simplified Chinese. "
    "Output ONLY the translation, with no explanations, notes, or surrounding quotes. "
    "Preserve all numbers, units, dates, punctuation, markdown/HTML tags, links and placeholders "
    "(such as {name}, %s) exactly as-is. Keep brand, product and person names unchanged when appropriate."
)

_DIRECTION_PROMPTS = {
    ("zh", "en"): DEFAULT_PROMPT,
    ("en", "zh"): EN_TO_ZH_PROMPT,
}


class TranslationEngine:
    name = "base"

    def translate(self, texts: List[str], src: str = "zh", tgt: str = "en") -> List[str]:
        raise NotImplementedError


class LlmEngine(TranslationEngine):
    """基于现有 OpenAI 兼容 LLM 的翻译引擎。"""

    name = "llm"

    def __init__(self, client=None):
        self._client = client
        self._lock = threading.Lock()

    def _get_client(self):
        if self._client is None:
            with self._lock:
                if self._client is None:
                    from main import Config, AIClient
                    cfg = Config()
                    if not cfg.llm_base_url or not cfg.llm_model:
                        raise RuntimeError("LLM 未配置（llm_base_url/llm_model 为空），无法翻译")
                    self._client = AIClient(cfg)
        return self._client

    def translate(self, texts: List[str], src: str = "zh", tgt: str = "en") -> List[str]:
        if src == tgt:
            return [str(t) if t is not None else "" for t in texts]
        client = self._get_client()
        custom_prompt = get_setting("translation_llm_prompt", "")
        if custom_prompt and (src, tgt) == ("zh", "en"):
            system_prompt = custom_prompt
        else:
            system_prompt = _DIRECTION_PROMPTS.get((src, tgt), DEFAULT_PROMPT)
        results: List[str] = []
        for text in texts:
            if text is None or str(text).strip() == "":
                results.append("")
                continue
            try:
                resp = client.chat(system_prompt, [], str(text), max_tokens=4096, temperature=0.0)
                results.append((resp.get("content") or "").strip())
            except Exception as exc:
                logger.warning("LLM translate failed: %s", exc)
                results.append("")
        return results


_ENGINE = None
_ENGINE_LOCK = threading.Lock()


def get_engine() -> TranslationEngine:
    """按 translation_engine 配置返回引擎实例（一期恒为 LlmEngine）。"""
    global _ENGINE
    name = str(get_setting("translation_engine", "llm")).strip().lower()
    if _ENGINE is not None and _ENGINE.name == name:
        return _ENGINE
    with _ENGINE_LOCK:
        if _ENGINE is not None and _ENGINE.name == name:
            return _ENGINE
        # 预留：name == "nmt" 时返回 NmtEngine(); 一期统一走 LLM。
        _ENGINE = LlmEngine()
        logger.info("translation engine selected: %s", _ENGINE.name)
    return _ENGINE
