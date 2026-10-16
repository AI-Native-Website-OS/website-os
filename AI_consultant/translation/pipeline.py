"""翻译流水线：统一的翻译入口（引擎选择由 engine.get_engine 负责）。"""

from typing import List

from .engine import get_engine


def translate_texts(texts: List[str], src: str = "zh", tgt: str = "en") -> List[str]:
    if not texts:
        return []
    return get_engine().translate(texts, src, tgt)


def translate_text(text: str, src: str = "zh", tgt: str = "en") -> str:
    return translate_texts([text], src, tgt)[0]
