"""读时实时翻译（用于管理后台按语言预览 AI 服务侧内容，如提示词配置、知识库名）。

- 支持中英双向：目标语言由请求 locale 决定，源语言自动识别。
- 结果按 (目标语言, 原文) 缓存于内存；保存时用反查表把未修改的译文还原为源语言原文，避免覆盖源内容。
- 依赖 translation_enabled() 配置；关闭时不翻译。
"""

import logging
import threading
from typing import List, Optional

from .config import translation_enabled
from .langdet import detect_lang, should_translate
from .pipeline import translate_texts

logger = logging.getLogger("translation.live")

SUPPORTED_TARGETS = ("zh", "en")

_CACHE = {}
_LOCK = threading.Lock()


def is_target(locale: Optional[str]) -> bool:
    return str(locale or "").strip().lower() in SUPPORTED_TARGETS


def _target(locale: Optional[str]) -> Optional[str]:
    value = str(locale or "").strip().lower()
    return value if value in SUPPORTED_TARGETS else None


def translate_cached(texts: List[Optional[str]], target: Optional[str]) -> List[Optional[str]]:
    """批量翻译到 target（仅翻译源语言与 target 不同的文本），命中缓存则不调用 LLM。"""
    target = _target(target)
    if target is None or not translation_enabled():
        return list(texts)
    result: List[Optional[str]] = []
    pending_texts: List[str] = []
    pending_idx: List[int] = []
    for i, t in enumerate(texts):
        if t is None or not should_translate(t, target):
            result.append(t)
            continue
        key = (target, str(t))
        with _LOCK:
            cached = _CACHE.get(key)
        if cached is not None:
            result.append(cached)
        else:
            result.append(None)
            pending_texts.append(str(t))
            pending_idx.append(i)
    if pending_texts:
        source = detect_lang(pending_texts[0])
        try:
            translated = translate_texts(pending_texts, source, target)
        except Exception as exc:  # 翻译失败不影响主流程
            logger.warning("live translate failed: %s", exc)
            translated = [None] * len(pending_texts)
        for i, src, tr in zip(pending_idx, pending_texts, translated):
            value = (tr or "").strip()
            if value:
                result[i] = value
                with _LOCK:
                    _CACHE[(target, src)] = value
            else:
                result[i] = src
    return result


def translate_one(text: Optional[str], target: Optional[str]) -> Optional[str]:
    return translate_cached([text], target)[0]


def restore_cached(texts: List[Optional[str]], target: Optional[str]) -> List[Optional[str]]:
    """把与缓存译文一致的值还原为源语言原文（用于保存保护）。"""
    target = _target(target)
    if target is None:
        return list(texts)
    with _LOCK:
        reverse = {v: k[1] for k, v in _CACHE.items() if k[0] == target}
    out: List[Optional[str]] = []
    for t in texts:
        if t is None:
            out.append(t)
        else:
            out.append(reverse.get(str(t), t))
    return out


def restore_one(text: Optional[str], target: Optional[str]) -> Optional[str]:
    return restore_cached([text], target)[0]
