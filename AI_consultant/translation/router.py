"""翻译服务内部接口：健康检查（供 Java 后端探活）。"""

import logging

from fastapi import APIRouter

from .config import get_setting, translation_enabled

logger = logging.getLogger("translation.router")

router = APIRouter(prefix="/translate", tags=["translation"])


@router.get("/health")
def health():
    llm_ok = False
    model = ""
    try:
        from main import Config

        cfg = Config()
        llm_ok = bool(cfg.llm_base_url and cfg.llm_model)
        model = cfg.llm_model or ""
    except Exception as exc:
        model = str(exc)
    return {
        "status": "ok",
        "enabled": translation_enabled(),
        "engine": get_setting("translation_engine", "llm"),
        "llm_ready": llm_ok,
        "model": model,
    }
