"""翻译相关系统配置读取（system_configs），带短 TTL 缓存。"""

import logging
import time

from db import get_db
from models import SystemConfig

logger = logging.getLogger("translation.config")

DEFAULTS = {
    "translation_enabled": "true",
    "translation_engine": "llm",
    "translation_llm_prompt": "",
}

_CACHE = {}
_TTL_SECONDS = 15.0


def get_setting(key: str, default: str = "") -> str:
    """读取 translation_* 配置；缺失时返回默认值。结果缓存 _TTL_SECONDS 秒。"""
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now - cached[0] < _TTL_SECONDS:
        return cached[1]
    value = DEFAULTS.get(key, default)
    try:
        with get_db() as db:
            row = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
            if row is not None and row.config_value is not None and str(row.config_value).strip() != "":
                value = str(row.config_value).strip()
    except Exception as exc:  # 配置读取失败不应影响主流程
        logger.debug("read setting %s failed: %s", key, exc)
    _CACHE[key] = (now, value)
    return value


def translation_enabled() -> bool:
    return str(get_setting("translation_enabled", "true")).strip().lower() in ("1", "true", "yes", "on")
