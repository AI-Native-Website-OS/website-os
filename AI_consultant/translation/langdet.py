"""轻量语言判断：仅区分中文与其他（视为英文），用于确定翻译方向。"""


def has_cjk(text) -> bool:
    for ch in str(text or ""):
        if "\u4e00" <= ch <= "\u9fff" or "\u3400" <= ch <= "\u4dbf":
            return True
    return False


def has_latin(text) -> bool:
    for ch in str(text or ""):
        if ch.isascii() and ch.isalpha():
            return True
    return False


def detect_lang(text) -> str:
    """含中文→zh，否则→en。"""
    return "zh" if has_cjk(text) else "en"


def should_translate(text, target: str) -> bool:
    """源语言与目标一致则无需翻译；目标为中文时要求含拉丁字母，避免误翻标识符。"""
    if text is None or not str(text).strip():
        return False
    src = detect_lang(text)
    if src == target:
        return False
    if target == "zh" and not has_latin(text):
        return False
    return True
