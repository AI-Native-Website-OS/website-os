import json
import os
import queue as q
import re
import threading
import time as _time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path as _EnvPath
from typing import Optional, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("api")

from sqlalchemy import select, delete as sa_delete

import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException, Path, File, UploadFile, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from main import Config, ChatGPT, AIClient, MemoryManager
from schemas import *
from db import get_db
from models import AiPromptConfig
from knowledge import KnowledgeEngine, EmbeddingClient, RerankerClient, extract_text_from_file
from forbidden_detector import get_detector, ForbiddenDetector
from rate_limit import get_rate_limiter

app = FastAPI(title="AI Consultant API", version="1.0.0")
router = APIRouter(prefix="/ai")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_lock = threading.Lock()

_engine: Optional[ChatGPT] = None

def ensure_tables():
    from db import _engine as _db_engine
    from models import Base, auto_upgrade
    eng = _db_engine()
    Base.metadata.create_all(eng)
    auto_upgrade(eng)

def get_engine() -> ChatGPT:
    global _engine
    if _engine is None:
        ensure_tables()
        _engine = ChatGPT()
        _engine.build_system_prompt()
        # init forbidden detector with same embedder + reranker
        from knowledge import EmbeddingClient, RerankerClient
        get_detector(EmbeddingClient(_engine.config), RerankerClient(_engine.config))
    return _engine


# ── Chat ──────────────────────────────────────────────────────────

def _merge_attachments(req: ChatRequest) -> List[Dict]:
    """解析附件中的文件内容并注入用户输入；返回移除 base64 后的附件列表（用于存储）"""
    if not req.attachments:
        return []
    cleaned: List[Dict] = []
    for att in req.attachments:
        if not isinstance(att, dict):
            cleaned.append(att)
            continue
        if att.get("type") == "file" and att.get("base64"):
            name = att.get("name") or "file.bin"
            try:
                import base64 as _b64
                raw = _b64.b64decode(att["base64"])
                text = extract_text_from_file(raw, name)
                if text:
                    req.user_input = (req.user_input or "") + f"\n\n以下是我上传的文件 {name} 的内容：\n```\n{text}\n```"
            except Exception as e:
                logger.warning("Attachment parse failed %s: %s", name, e)
            stripped = dict(att)
            stripped.pop("base64", None)
            cleaned.append(stripped)
        else:
            cleaned.append(att)
    return cleaned

@router.post("/chat")
def chat(req: ChatRequest):
    # ── 限流检查 ──────────────────────────────────────────────
    limiter = get_rate_limiter()
    if req.username:
        allowed, remaining = limiter.check_user(req.username)
        reason = "user_rate_limit"
        limit_val = limiter.get_limits()["user_limit"]
        message = f"请求过于频繁，请稍后再试（每分钟最多 {limit_val} 次）。"
    else:
        vid = (req.visitor_id or req.session_id or "").strip() or "anonymous"
        allowed, remaining = limiter.check_guest(vid)
        reason = "guest_limit"
        message = "您今日的免费咨询次数已用完，请登录后继续使用AI顾问。"

    if not allowed:
        def limit_stream():
            yield f"data: {json.dumps({'type': 'limit', 'reason': reason, 'message': message, 'remaining': 0}, ensure_ascii=False)}\n\n"
        return StreamingResponse(limit_stream(), media_type="text/event-stream")

    eng = get_engine()
    attachments = _merge_attachments(req)
    with _lock:
        if req.session_id:
            ok = eng.switch_session(req.session_id)
            if not ok:
                eng.sessions.create(session_id=req.session_id, username=req.username or "")
        if req.username:
            s = eng.current_session()
            if s:
                s.username = req.username
                if req.role:
                    s.role = req.role
        sid = eng.current_session().session_id if eng.current_session() else None

    # streaming is always enabled → SSE
    sync_q: "q.Queue" = q.Queue()
    stop_evt = threading.Event()

    def on_chunk(text: str):
        sync_q.put(("content", text))

    def on_reasoning(text: str):
        sync_q.put(("reasoning", text))

    def run():
        try:
            result = eng.chat(
                user_input=req.user_input,
                images=req.images,
                attachments=attachments,
                original_input=req.original_input,
                stream=True,
                on_chunk=on_chunk,
                on_reasoning=on_reasoning,
                username=req.username,
                session_id=sid,
                use_knowledge=req.use_knowledge,
                use_thinking=req.use_thinking,
                stop_event=stop_evt,
            )
            sync_q.put(("done", result))
        except Exception as e:
            logger.exception("AI chat error (session=%s): %s", sid, e)
            sync_q.put(("error", str(e)))

    threading.Thread(target=run, daemon=True).start()

    def event_stream():
        try:
            while True:
                typ, data = sync_q.get()
                if typ == "content":
                    yield f"data: {json.dumps({'type': 'content', 'content': data}, ensure_ascii=False)}\n\n"
                elif typ == "reasoning":
                    yield f"data: {json.dumps({'type': 'reasoning', 'content': data}, ensure_ascii=False)}\n\n"
                elif typ == "done":
                    payload = {"type": "done"}
                    if isinstance(data, dict):
                        payload["content"] = data.get("content", "")
                        payload["reasoning"] = data.get("reasoning")
                        payload["prompt_tokens"] = data.get("prompt_tokens", 0)
                        payload["completion_tokens"] = data.get("completion_tokens", 0)
                        payload["total_tokens"] = data.get("total_tokens", 0)
                        payload["model"] = data.get("model", "")
                        if data.get("finish_reason") == "stopped":
                            payload["stopped"] = True
                        rec = data.get("recommendations")
                        if rec and any(v for v in rec.values()):
                            payload["recommendations"] = rec
                    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                    break
                elif typ == "error":
                    yield f"data: {json.dumps({'type': 'error', 'error': data}, ensure_ascii=False)}\n\n"
                    break
        finally:
            # 客户端断开/取消时通知后台线程停止生成，避免空转与继续计费
            stop_evt.set()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Sessions ──────────────────────────────────────────────────────

@router.post("/sessions", response_model=SessionOut)
def create_session(req: SessionCreateRequest):
    with _lock:
        eng = get_engine()
        s = eng.new_session(req.title)
        if req.system_prompt:
            s.system_prompt = req.system_prompt
        if req.model:
            s.model = req.model
        out = _session_to_out(s)
    return out


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions():
    return get_engine().list_sessions()


@router.get("/sessions/{session_id}/history", response_model=SessionHistoryOut)
def get_history(session_id: str = Path(...)):
    msgs = get_engine().show_history(session_id, None)
    if msgs is None:
        raise HTTPException(404, "Session not found")
    return SessionHistoryOut(session_id=session_id, messages=[MessageOut(**m) for m in msgs])


@router.post("/sessions/{session_id}/switch", response_model=StatusOut)
def switch_session(session_id: str = Path(...)):
    ok = get_engine().switch_session(session_id)
    if not ok:
        raise HTTPException(404, "Session not found")
    return StatusOut(status="ok", message=f"Switched to {session_id}")


@router.delete("/sessions/{session_id}", response_model=StatusOut)
def delete_session(session_id: str = Path(...)):
    get_engine().delete_session(session_id)
    return StatusOut(status="ok", message=f"Deleted {session_id}")


# ── Stats & Logs ─────────────────────────────────────────────────

@router.get("/stats", response_model=StatsOut)
def stats(session_id: Optional[str] = None):
    return StatsOut(**get_engine().token_stats(session_id))


@router.get("/token/logs", response_model=list[TokenLogEntryOut])
def token_logs():
    return get_engine().token_logs()


# ── Models ────────────────────────────────────────────────────────

@router.get("/models", response_model=list[str])
def list_models():
    return get_engine().get_models()


# ── Config ────────────────────────────────────────────────────────

@router.get("/config", response_model=ConfigOut)
def get_config():
    c = get_engine().config
    limits = get_rate_limiter().get_limits()
    return ConfigOut(
        llm_provider=c.llm_provider,
        llm_base_url=c.llm_base_url,
        llm_model=c.llm_model,
        llm_temperature=c.llm_temperature,
        llm_max_tokens=c.llm_max_tokens,
        llm_top_p=c.llm_top_p,
        system_prompt=c.system_prompt,
        llm_frequency_penalty=c.llm_frequency_penalty,
        llm_presence_penalty=c.llm_presence_penalty,
        llm_stop=c.llm_stop,
        llm_seed=c.llm_seed,
        llm_thinking_auto_collapse=c.llm_thinking_auto_collapse,
        embedding_provider=c.embedding_provider,
        embedding_base_url=c.embedding_base_url,
        embedding_model=c.embedding_model,
        embedding_dimension=c.embedding_dimension,
        vl_provider=c.vl_provider,
        vl_base_url=c.vl_base_url,
        vl_model=c.vl_model,
        vl_temperature=c.vl_temperature,
        vl_max_tokens=c.vl_max_tokens,
        vl_image_size=c.vl_image_size,
        vl_image_quality=c.vl_image_quality,
        reranker_provider=c.reranker_provider,
        reranker_base_url=c.reranker_base_url,
        reranker_model=c.reranker_model,
        reranker_enabled=c.reranker_enabled,
        reranker_top_k=c.reranker_top_k,
        ai_user_rate_limit=limits["user_limit"],
        ai_guest_daily_limit=limits["guest_limit"],
    )


# reverse mapping: config attribute → env var name

@router.post("/config", response_model=StatusOut)
def update_config(req: ConfigUpdateRequest):
    data = req.model_dump(exclude_none=True)
    with _lock:
        get_engine().update_config(**data)
    # persist relevant fields to os.environ
    for attr, val in data.items():
        env_key = _CONFIG_ATTR_TO_ENV.get(attr)
        if not env_key:
            continue
        if isinstance(val, bool):
            raw = "true" if val else "false"
        elif isinstance(val, list):
            raw = ",".join(str(v) for v in val)
        elif val is None:
            raw = ""
        else:
            raw = str(val)
        os.environ[env_key] = raw
    return StatusOut(status="ok", message="Config updated")


# ── Prompt Config ─────────────────────────────────────────────────

_ENV_FILE = _EnvPath(__file__).resolve().parent.parent / ".env"

def _update_env_file(key: str, value: str):
    """更新 .env 文件中指定 key 的值，若 key 不存在则追加"""
    env_path = _ENV_FILE
    if not env_path.exists():
        env_path.write_text(f"{key}={value}\n", encoding="utf-8")
        return
    lines = env_path.read_text(encoding="utf-8").splitlines()
    found = False
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(f"{key}=") or stripped.startswith(f"# {key}="):
            new_lines.append(f"{key}={value}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}={value}")
    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


@router.get("/prompt-config", response_model=PromptConfigOut)
def get_prompt_config():
    sys_prompt = os.getenv("AI_SYSTEM_PROMPT", "")
    suggestions = []
    banned = []
    threshold = 0.82
    welcome_message = ""
    input_placeholder = ""
    with get_db() as db:
        rows = db.execute(
            select(AiPromptConfig).where(
                AiPromptConfig.type.in_(["suggestion", "banned_word", "banned_threshold", "welcome_message", "input_placeholder"])
            ).order_by(AiPromptConfig.type, AiPromptConfig.sort_order)
        ).scalars().all()
        for r in rows:
            if r.type == "suggestion":
                suggestions.append(r.content)
            elif r.type == "banned_word":
                banned.append(r.content)
            elif r.type == "banned_threshold":
                try:
                    threshold = float(r.content)
                except (ValueError, TypeError):
                    pass
            elif r.type == "welcome_message":
                welcome_message = r.content
            elif r.type == "input_placeholder":
                input_placeholder = r.content
    return PromptConfigOut(
        system_prompt=sys_prompt,
        suggestions=suggestions,
        banned_words=banned,
        banned_threshold=threshold,
        welcome_message=welcome_message,
        input_placeholder=input_placeholder,
    )


@router.post("/prompt-config", response_model=StatusOut)
def save_prompt_config(req: PromptConfigSaveRequest):
    # 系统提示词持久化到 .env 文件 + 环境变量
    if req.system_prompt:
        os.environ["AI_SYSTEM_PROMPT"] = req.system_prompt
        _update_env_file("AI_SYSTEM_PROMPT", req.system_prompt)
    # 推荐话术、违禁词和禁答阈值存数据库
    with get_db() as db:
        db.execute(sa_delete(AiPromptConfig).where(
            AiPromptConfig.type.in_(["suggestion", "banned_word", "banned_threshold", "welcome_message", "input_placeholder"])
        ))
        for i, s in enumerate(req.suggestions):
            if s.strip():
                db.add(AiPromptConfig(type="suggestion", content=s.strip(), sort_order=i))
        for i, b in enumerate(req.banned_words):
            if b.strip():
                db.add(AiPromptConfig(type="banned_word", content=b.strip(), sort_order=i))
        if req.banned_threshold is not None:
            db.add(AiPromptConfig(type="banned_threshold", content=str(req.banned_threshold), sort_order=0))
        if req.welcome_message is not None and req.welcome_message.strip():
            db.add(AiPromptConfig(type="welcome_message", content=req.welcome_message.strip(), sort_order=0))
        if req.input_placeholder is not None and req.input_placeholder.strip():
            db.add(AiPromptConfig(type="input_placeholder", content=req.input_placeholder.strip(), sort_order=0))
    # Also sync to in-memory config so current sessions pick it up
    eng = get_engine()
    eng.build_system_prompt()
    return StatusOut(status="ok", message="Prompt config saved")


# ── Model Config ───────────────────────────────────────────────

ENV_MAP = {
    # ── LLM ──
    "LLM_PROVIDER": "llm_provider",
    "LLM_BASE_URL": "llm_base_url",
    "LLM_API_KEY": "llm_api_key",
    "LLM_MODEL": "llm_model",
    "LLM_TEMPERATURE": "llm_temperature",
    "LLM_MAX_TOKENS": "llm_max_tokens",
    "LLM_TOP_P": "llm_top_p",
    "LLM_FREQUENCY_PENALTY": "llm_frequency_penalty",
    "LLM_PRESENCE_PENALTY": "llm_presence_penalty",
    "LLM_STOP": "llm_stop",
    "LLM_SEED": "llm_seed",
    "LLM_THINKING_KEYWORD": "llm_thinking_keyword",
    "LLM_THINKING_AUTO_COLLAPSE": "llm_thinking_auto_collapse",
    "LLM_THINKING_ENABLED": "llm_thinking_enabled",
    # ── Embedding ──
    "EMBEDDING_PROVIDER": "embedding_provider",
    "EMBEDDING_BASE_URL": "embedding_base_url",
    "EMBEDDING_API_KEY": "embedding_api_key",
    "EMBEDDING_MODEL": "embedding_model",
    "EMBEDDING_DIMENSION": "embedding_dimension",
    # ── VL ──
    "VL_PROVIDER": "vl_provider",
    "VL_BASE_URL": "vl_base_url",
    "VL_API_KEY": "vl_api_key",
    "VL_MODEL": "vl_model",
    "VL_TEMPERATURE": "vl_temperature",
    "VL_MAX_TOKENS": "vl_max_tokens",
    "VL_IMAGE_SIZE": "vl_image_size",
    "VL_IMAGE_QUALITY": "vl_image_quality",
    # ── Rerank ──
    "RERANK_PROVIDER": "reranker_provider",
    "RERANK_BASE_URL": "reranker_base_url",
    "RERANK_API_KEY": "reranker_api_key",
    "RERANK_MODEL": "reranker_model",
    "RERANK_ENABLED": "reranker_enabled",
    "RERANK_TOP_K": "reranker_top_k",
}

# reverse mapping: config attribute → env var name
_CONFIG_ATTR_TO_ENV = {v: k for k, v in ENV_MAP.items()}


def _is_sensitive_env_key(key: str) -> bool:
    upper = key.upper()
    return upper == "JWT_SECRET" or upper.endswith("_API_KEY") \
        or upper.endswith("_SECRET") or upper.endswith("_PASSWORD")


def _display_env_value(key: str, val: str) -> str:
    """模型配置回显：敏感项（API Key 等）不返回明文，未配置为空串。"""
    if not val:
        return val
    if _is_sensitive_env_key(key):
        return "******"
    return val

@router.get("/model-config", response_model=ModelConfigOut)
def get_model_config():
    c = get_engine().config
    items = []
    for env_key, attr in ENV_MAP.items():
        val = getattr(c, attr, None)
        if val is None:
            continue
        if isinstance(val, list):
            items.append(ModelConfigItem(key=env_key, value=_display_env_value(env_key, ",".join(val))))
        elif isinstance(val, bool):
            items.append(ModelConfigItem(key=env_key, value=_display_env_value(env_key, "true" if val else "false")))
        else:
            items.append(ModelConfigItem(key=env_key, value=_display_env_value(env_key, str(val))))
    return ModelConfigOut(items=items)


@router.post("/model-config", response_model=StatusOut)
def save_model_config(req: ModelConfigSaveRequest):
    """配置已由后端 Java 写入 system_configs 表，此处从数据库重载并热生效。

    req 保持兼容（页面仍会携带 items），实际以数据库为准。
    """
    try:
        get_engine().reload_model_config_from_db()
        # Recreate knowledge engine (embedder + reranker) with new config
        get_engine()._ke = None
        # Recreate forbidden detector with new embedding/rerank config
        import forbidden_detector as _fd
        _fd._detector = ForbiddenDetector(EmbeddingClient(get_engine().config), RerankerClient(get_engine().config))
        _fd._detector.refresh_all_embeddings()
        return StatusOut(status="ok", message="Model config reloaded from database")
    except Exception as e:
        return StatusOut(status="error", message=str(e))


# ── Model Connectivity Test ──────────────────────────────────────

@router.post("/model-config/test", response_model=TestConnectivityResult)
def test_model_connectivity(req: TestConnectivityRequest):
    import time as _time
    import httpx as _httpx
    c = get_engine().config
    model_type = req.model_type
    start = _time.time()

    try:
        if model_type == "llm":
            base_url = (c.llm_base_url or "").rstrip("/")
            api_key = c.llm_api_key or ""
            model = c.llm_model or ""
            if not base_url or not model:
                return TestConnectivityResult(success=False, model_type=model_type, message=f"缺少配置: BASE_URL={base_url} MODEL={model}")
            url = f"{base_url}/chat/completions"
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            body = {"model": model, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 5, "stream": False}
            with _httpx.Client(timeout=30) as client:
                resp = client.post(url, headers=headers, json=body)
            latency = round((_time.time() - start) * 1000, 1)
            if resp.status_code == 200:
                return TestConnectivityResult(success=True, model_type=model_type, message=f"连接成功 ({resp.status_code})", latency_ms=latency)
            detail = resp.text[:200]
            return TestConnectivityResult(success=False, model_type=model_type, message=f"HTTP {resp.status_code}: {detail}", latency_ms=latency)

        elif model_type == "embedding":
            base_url = (c.embedding_base_url or c.llm_base_url or "").rstrip("/")
            api_key = c.embedding_api_key or c.llm_api_key or ""
            model = c.embedding_model or ""
            if not base_url or not model:
                return TestConnectivityResult(success=False, model_type=model_type, message=f"缺少配置: BASE_URL={base_url} MODEL={model}")
            url = f"{base_url}/embeddings"
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            body = {"model": model, "input": "Hello"}
            with _httpx.Client(timeout=30) as client:
                resp = client.post(url, headers=headers, json=body)
            latency = round((_time.time() - start) * 1000, 1)
            if resp.status_code == 200:
                data = resp.json()
                dim = len(data.get("data", [{}])[0].get("embedding", []))
                return TestConnectivityResult(success=True, model_type=model_type, message=f"连接成功 维度={dim}", latency_ms=latency)
            detail = resp.text[:200]
            return TestConnectivityResult(success=False, model_type=model_type, message=f"HTTP {resp.status_code}: {detail}", latency_ms=latency)

        elif model_type == "vl":
            base_url = (c.vl_base_url or c.llm_base_url or "").rstrip("/")
            api_key = c.vl_api_key or c.llm_api_key or ""
            model = c.vl_model or c.llm_model or ""
            if not base_url or not model:
                return TestConnectivityResult(success=False, model_type=model_type, message=f"缺少配置: BASE_URL={base_url} MODEL={model}")
            url = f"{base_url}/chat/completions"
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            body = {"model": model, "messages": [{"role": "user", "content": [{"type": "text", "text": "describe this"}]}], "max_tokens": 10, "stream": False}
            with _httpx.Client(timeout=30) as client:
                resp = client.post(url, headers=headers, json=body)
            latency = round((_time.time() - start) * 1000, 1)
            if resp.status_code == 200:
                return TestConnectivityResult(success=True, model_type=model_type, message=f"连接成功 ({resp.status_code})", latency_ms=latency)
            detail = resp.text[:200]
            return TestConnectivityResult(success=False, model_type=model_type, message=f"HTTP {resp.status_code}: {detail}", latency_ms=latency)

        elif model_type == "rerank":
            base_url = (c.reranker_base_url or "").rstrip("/")
            api_key = c.reranker_api_key or c.llm_api_key or ""
            model = c.reranker_model or ""
            if not base_url or not model:
                return TestConnectivityResult(success=False, model_type=model_type, message=f"缺少配置: BASE_URL={base_url} MODEL={model}")
            url = f"{base_url}/rerank"
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            body = {"model": model, "query": "test", "documents": ["hello world"]}
            with _httpx.Client(timeout=30) as client:
                resp = client.post(url, headers=headers, json=body)
            latency = round((_time.time() - start) * 1000, 1)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results") or []
                return TestConnectivityResult(success=True, model_type=model_type, message=f"连接成功 结果数={len(results)}", latency_ms=latency)
            detail = resp.text[:200]
            return TestConnectivityResult(success=False, model_type=model_type, message=f"HTTP {resp.status_code}: {detail}", latency_ms=latency)

        else:
            return TestConnectivityResult(success=False, model_type=model_type, message=f"未知模型类型: {model_type}")
    except Exception as e:
        latency = round((_time.time() - start) * 1000, 1)
        return TestConnectivityResult(success=False, model_type=model_type, message=str(e), latency_ms=latency)


# ── Memory ────────────────────────────────────────────────────────

@router.get("/memory/search", response_model=MemorySearchOut)
def search_memory(keyword: str = Query(...), username: str = Query(...), role: str = Query("")):
    # 记忆严格按用户隔离：必须指定 username，仅检索该用户的记忆
    return MemorySearchOut(results=get_engine().search_memory(username, keyword, role))


@router.delete("/memory", response_model=StatusOut)
def clear_memory():
    get_engine().clear_memory()
    return StatusOut(status="ok", message="Memory cleared")


@router.get("/memory/files", response_model=MemoryFileListOut)
def list_memory_files():
    return MemoryFileListOut(files=get_engine().list_memory_files())


@router.get("/memory/file", response_model=MemoryFileContentOut)
def get_memory_file(username: str = Query(...), filename: str = Query("MEMORY.md"), role: str = Query(""), file_type: str = Query("")):
    if file_type and file_type in MemoryManager.MEMORY_FILE_NAMES:
        filename = MemoryManager.MEMORY_FILE_NAMES[file_type]
    content = get_engine().read_memory_file(username, filename, role)
    return MemoryFileContentOut(username=username, content=content)


@router.put("/memory/file", response_model=StatusOut)
def save_memory_file(username: str = Query(...), filename: str = Query("MEMORY.md"), role: str = Query(""), file_type: str = Query(""), req: MemoryFileSaveRequest = None):
    if file_type and file_type in MemoryManager.MEMORY_FILE_NAMES:
        filename = MemoryManager.MEMORY_FILE_NAMES[file_type]
    get_engine().write_memory_file(username, req.content, filename, role)
    return StatusOut(status="ok", message=f"Saved {role}/{username}/{filename}")


@router.post("/memory/init", response_model=StatusOut)
def init_memory(username: str = Query(...), role: str = Query("")):
    get_engine().init_user_memory(username, role)
    return StatusOut(status="ok", message=f"Initialized memory for {role}/{username}")


@router.post("/users/{username}/memory/init", response_model=StatusOut)
def init_user_memory(username: str, req: MemoryInitRequest = None):
    """Java端创建用户后调用，初始化全部6个记忆文件"""
    role = req.role if req else ""
    get_engine().init_user_memory(username, role)
    return StatusOut(status="ok", message=f"Initialized 6 memory files for {role}/{username}")


@router.get("/memory/user-files", response_model=MemoryFileListOut)
def list_user_memory_files(username: str = Query(...), role: str = Query("")):
    """List all 6 memory files for a specific user."""
    file_list = []
    for file_type, filename in MemoryManager.MEMORY_FILE_NAMES.items():
        content = get_engine().read_memory_file(username, filename, role)
        lines = content.strip().splitlines() if content else []
        file_list.append({
            "filename": filename,
            "file_type": file_type,
            "size": len(content),
            "line_count": len(lines),
            "content": content,
        })
    return MemoryFileListOut(files=file_list)


# backward compat: default to MEMORY.md
@router.get("/memory/files/{username}", response_model=MemoryFileContentOut)
def get_memory_file_legacy(username: str):
    content = get_engine().read_memory_file(username, "MEMORY.md", "")
    return MemoryFileContentOut(username=username, content=content)


@router.put("/memory/files/{username}", response_model=StatusOut)
def save_memory_file_legacy(username: str, req: MemoryFileSaveRequest):
    get_engine().write_memory_file(username, req.content, "MEMORY.md", "")
    return StatusOut(status="ok", message=f"Saved {username}/MEMORY.md")


# ── Forbidden Detection ─────────────────────────────────────────────

@router.post("/forbidden/detect", response_model=ForbiddenDetectResult)
def forbidden_detect(req: ForbiddenDetectRequest):
    return get_detector().detect(req.user_input)


@router.post("/forbidden/examples/{example_id}/embed", response_model=StatusOut)
def forbidden_example_embed(example_id: int):
    ok = get_detector().compute_and_store_embedding(example_id)
    if ok:
        return StatusOut(status="ok", message=f"Embedding computed for example {example_id}")
    return StatusOut(status="error", message=f"Failed to compute embedding for example {example_id}")


@router.post("/forbidden/refresh-embeddings", response_model=StatusOut)
def forbidden_refresh_embeddings():
    get_detector().refresh_all_embeddings()
    return StatusOut(status="ok", message="All forbidden example embeddings refreshed")


# ── RAG 开关 ───────────────────────────────────────────────────────

class _RagConfigOut(BaseModel):
    enabled: bool
    kb_ids: List[int] = []
    top_k: int = 6
    threshold: float = 0.5
    max_threshold: float = 0.7
    reranker_enabled: bool = False
    reranker_model: str = ""

class _RagConfigUpdateRequest(BaseModel):
    enabled: Optional[bool] = None
    kb_ids: Optional[List[int]] = None
    top_k: Optional[int] = None
    threshold: Optional[float] = None
    max_threshold: Optional[float] = None
    reranker_enabled: Optional[bool] = None
    reranker_model: Optional[str] = None

@router.get("/rag-config", response_model=_RagConfigOut)
def get_rag_config():
    eng = get_engine()
    return _RagConfigOut(
        enabled=eng.rag_enabled, kb_ids=eng.rag_kb_ids,
        top_k=eng.rag_top_k, threshold=eng.rag_threshold,
        max_threshold=eng.rag_max_threshold,
        reranker_enabled=eng.rag_reranker_enabled,
        reranker_model=eng.rag_reranker_model or "",
    )

@router.post("/rag-config", response_model=StatusOut)
def update_rag_config(req: _RagConfigUpdateRequest):
    eng = get_engine()
    if req.enabled is not None:
        eng.rag_enabled = req.enabled
    if req.kb_ids is not None:
        eng.rag_kb_ids = req.kb_ids
    if req.top_k is not None:
        eng.rag_top_k = req.top_k
    if req.threshold is not None:
        eng.rag_threshold = req.threshold
    if req.max_threshold is not None:
        eng.rag_max_threshold = req.max_threshold
    if req.reranker_enabled is not None:
        eng.rag_reranker_enabled = req.reranker_enabled
    if req.reranker_model is not None:
        eng.rag_reranker_model = req.reranker_model
    return StatusOut(status="ok", message="RAG config updated")


# ── 知识库 ────────────────────────────────────────────────────────

def _get_ke() -> KnowledgeEngine:
    return get_engine().ke


# ── 知识库 CRUD ─────────────────────────────────────────────────

@router.get("/knowledge-bases", response_model=KnowledgeBaseListOut)
def list_knowledge_bases():
    return KnowledgeBaseListOut(items=_get_ke().list_kbs())


@router.post("/knowledge-bases", response_model=KnowledgeBaseOut)
def create_knowledge_base(req: KnowledgeBaseCreateRequest):
    kb = _get_ke().create_kb(
        name=req.name, description=req.description,
        chunk_size=req.chunk_size, chunk_overlap=req.chunk_overlap,
        chunk_separator=req.chunk_separator,
        text_preprocessing_rules=req.text_preprocessing_rules,
        embedding_model=req.embedding_model, embedding_dimension=req.embedding_dimension,
        top_k=req.top_k, threshold_min=req.threshold_min, threshold_max=req.threshold_max,
        reranker_model=req.reranker_model, reranker_enabled=req.reranker_enabled,
    )
    return KnowledgeBaseOut(**(_get_ke()._kb_to_dict(kb)))


@router.get("/knowledge-bases/{kb_id}", response_model=KnowledgeBaseOut)
def get_knowledge_base(kb_id: int = Path(..., description="知识库 ID")):
    ke = _get_ke()
    kb = ke.get_kb(kb_id)
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    return KnowledgeBaseOut(**ke._kb_to_dict(kb))


@router.put("/knowledge-bases/{kb_id}", response_model=KnowledgeBaseOut)
def update_knowledge_base(kb_id: int = Path(..., description="知识库 ID"), req: KnowledgeBaseUpdateRequest = None):
    ke = _get_ke()
    kb = ke.get_kb(kb_id)
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    kwargs = req.model_dump(exclude_none=True)
    updated = ke.update_kb_config(kb_id, **kwargs)
    if not updated:
        raise HTTPException(500, "Failed to update")
    return KnowledgeBaseOut(**ke._kb_to_dict(updated))


@router.delete("/knowledge-bases/{kb_id}", response_model=StatusOut)
def delete_knowledge_base(kb_id: int = Path(..., description="知识库 ID")):
    ke = _get_ke()
    kb = ke.get_kb(kb_id)
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    ke.delete_kb(kb_id)
    return StatusOut(status="ok", message="Knowledge base deleted")


# ── 文档管理 ─────────────────────────────────────────────────

@router.get("/knowledge-bases/{kb_id}/documents", response_model=KnowledgeDocumentListOut)
def list_documents(kb_id: int = Path(...)):
    return KnowledgeDocumentListOut(items=_get_ke().list_documents(kb_id))


@router.post("/knowledge-bases/{kb_id}/documents/upload", response_model=KnowledgeDocumentOut)
def upload_document(
    kb_id: int = Path(...),
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
):
    ke = _get_ke()
    kb = ke.get_kb(kb_id)
    if not kb:
        raise HTTPException(404, "Knowledge base not found")

    content_bytes = file.file.read()
    doc_title = title or file.filename or "untitled"
    content = extract_text_from_file(content_bytes, file.filename or "untitled.txt")

    doc = ke.add_document(
        kb_id=kb_id,
        title=doc_title,
        content=content,
        file_name=file.filename or "",
        file_size=len(content_bytes),
    )

    # Auto-process (chunk + embed)
    ke.process_document(doc.id)
    doc = ke.get_document(doc.id)

    return KnowledgeDocumentOut(
        id=doc.id,
        knowledge_base_id=doc.knowledge_base_id,
        title=doc.title,
        file_name=doc.file_name or "",
        file_size=doc.file_size or 0,
        status=doc.status,
        chunk_count=doc.chunk_count or 0,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
        updated_at=doc.updated_at.isoformat() if doc.updated_at else "",
    )


@router.post("/knowledge-bases/{kb_id}/documents/text", response_model=KnowledgeDocumentOut)
def add_text_document(
    kb_id: int = Path(...),
    title: str = Form(...),
    content: str = Form(...),
):
    ke = _get_ke()
    kb = ke.get_kb(kb_id)
    if not kb:
        raise HTTPException(404, "Knowledge base not found")

    doc = ke.add_document(kb_id=kb_id, title=title, content=content, file_name="")
    ke.process_document(doc.id)
    doc = ke.get_document(doc.id)

    return KnowledgeDocumentOut(
        id=doc.id,
        knowledge_base_id=doc.knowledge_base_id,
        title=doc.title,
        status=doc.status,
        chunk_count=doc.chunk_count or 0,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
        updated_at=doc.updated_at.isoformat() if doc.updated_at else "",
    )


@router.post("/documents/{doc_id}/process", response_model=KnowledgeProcessOut)
def process_document(doc_id: int = Path(...)):
    result = _get_ke().process_document(doc_id)
    return KnowledgeProcessOut(**result)


@router.delete("/documents/{doc_id}", response_model=StatusOut)
def delete_document(doc_id: int = Path(...)):
    ke = _get_ke()
    doc = ke.get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    ke.delete_document(doc_id)
    return StatusOut(status="ok", message="Document deleted")


# ── 向量搜索 ────────────────────────────────────────────────

@router.post("/knowledge/search", response_model=KnowledgeSearchOut)
def search_knowledge(req: KnowledgeSearchRequest):
    ke = _get_ke()
    if req.kb_id:
        results = ke.search(req.kb_id, req.query, req.top_k, req.threshold, req.max_threshold)
    else:
        results = ke.search_all_kbs(req.query, req.top_k, req.threshold, req.max_threshold)
    return KnowledgeSearchOut(results=[
        KnowledgeChunkOut(**r) for r in results
    ])


@router.post("/knowledge/sync-document", response_model=KnowledgeDocumentOut)
def sync_document(req: SyncDocumentRequest):
    ke = _get_ke()
    result = ke.sync_document(
        kb_id=req.kb_id,
        source_type=req.source_type,
        source_id=req.source_id,
        title=req.title,
        content=req.content,
        file_path=req.file_path or "",
        images=req.images or [],
    )
    doc = ke.get_document(result["document_id"])
    return KnowledgeDocumentOut(
        id=doc.id,
        knowledge_base_id=doc.knowledge_base_id,
        title=doc.title,
        status=doc.status,
        chunk_count=doc.chunk_count or 0,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
        updated_at=doc.updated_at.isoformat() if doc.updated_at else "",
    )


@router.delete("/knowledge/sync-document/{source_type}/{source_id}", response_model=StatusOut)
def delete_synced_document(source_type: str, source_id: int):
    ke = _get_ke()
    ok = ke.delete_document_by_source(source_type, source_id)
    if not ok:
        return StatusOut(status="ok", message="Document not found, nothing to delete")
    return StatusOut(status="ok", message=f"Deleted {source_type}/{source_id}")


@router.post("/knowledge/reembed", response_model=KnowledgeReembedOut)
def reembed_knowledge(kb_id: Optional[int] = Query(None)):
    result = _get_ke().reembed_all(kb_id)
    return KnowledgeReembedOut(**result)


# ── SEO/GEO 内容生成 ──────────────────────────────────────────────

SEO_GENERATE_SYSTEM_PROMPT = """你是一位资深的中文 SEO 与 GEO/AEO 优化专家，服务对象是「圣诺联合」（河北圣诺联合科技有限公司），一家企业数字基础设施服务商（智慧招采平台、可信数据空间、分布式数据治理、区块链可信基础设施、AI智能体应用）。

请根据给定的单个页面信息，为该页面生成一套 SEO 与 GEO 内容。要求：

1. description：80-150 字的中文页面描述，用于 meta description 与搜索结果摘要，包含核心关键词，客观具体，避免空泛营销话术。
2. keywords：5-10 个中文关键词数组（不含品牌名重复堆砌）。
3. geo_summary：1-2 句话，直接回答“这个页面/产品是什么”，让 AI 搜索引擎可直接引用，具体、客观、可验证。
4. keyword_entries：8-12 条关键词词库条目，每条包含 keyword、category、intent_note。category 只能是以下之一：品牌、产品、场景、问题、对比。intent_note 用一句话描述用户说出该关键词时的真实意图。
5. faqs：3-6 条 FAQ，每条包含 question、answer。answer 为 1-3 句简洁直接的回答，可带具体数据。

只输出一个 JSON 对象，不要任何解释、前后缀或 markdown 代码块。JSON 结构如下：
{
  "description": "...",
  "keywords": ["..."],
  "geo_summary": "...",
  "keyword_entries": [
    {"keyword": "...", "category": "品牌|产品|场景|问题|对比", "intent_note": "..."}
  ],
  "faqs": [
    {"question": "...", "answer": "..."}
  ]
}"""


def _gen_client():
    """基于引擎配置构造低温度的生成客户端（不影响共享引擎配置）。"""
    base = get_engine().config
    g = Config()
    for attr in ("llm_provider", "llm_base_url", "llm_api_key", "llm_model",
                 "llm_top_p", "llm_frequency_penalty", "llm_presence_penalty",
                 "llm_stop", "llm_seed"):
        setattr(g, attr, getattr(base, attr))
    g.llm_temperature = 0.3
    g.llm_max_tokens = 4000
    return AIClient(g)


def _parse_json_block(text: str) -> dict:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    si = text.find("{")
    ei = text.rfind("}")
    if si == -1 or ei == -1 or ei <= si:
        raise ValueError("响应中未找到 JSON 对象")
    return json.loads(text[si:ei + 1])


def _generate_one(client: AIClient, page, sp: str) -> dict:
    user = (
        f"页面标题：{page.title or ''}\n"
        f"页面类型：{page.page_type or 'static'}\n"
        f"所属模块：{page.module_name or '无'}\n\n"
        f"页面内容参考：\n{(page.context or '').strip() or '（无）'}"
    )
    resp = client.chat(sp, [], user, max_tokens=4000, temperature=0.3,
                       chat_template_kwargs={"enable_thinking": False})
    data = _parse_json_block(resp["content"])

    categories = {"品牌", "产品", "场景", "问题", "对比"}
    result = {
        "key": page.key,
        "description": str(data.get("description") or "").strip(),
        "keywords": [str(k).strip() for k in (data.get("keywords") or []) if str(k).strip()],
        "geo_summary": str(data.get("geo_summary") or "").strip(),
        "keyword_entries": [],
        "faqs": [],
    }
    for ke in (data.get("keyword_entries") or []):
        if not isinstance(ke, dict):
            continue
        kw = str(ke.get("keyword") or "").strip()
        if not kw:
            continue
        cat = str(ke.get("category") or "").strip()
        if cat not in categories:
            cat = "产品"
        result["keyword_entries"].append({
            "keyword": kw,
            "category": cat,
            "intent_note": str(ke.get("intent_note") or "").strip(),
        })
    for f in (data.get("faqs") or []):
        if not isinstance(f, dict):
            continue
        q = str(f.get("question") or "").strip()
        if not q:
            continue
        result["faqs"].append({"question": q, "answer": str(f.get("answer") or "").strip()})
    return result


@router.post("/seo/generate", response_model=SeoGenerateResponse)
def seo_generate(req: SeoGenerateRequest):
    """为多个页面批量生成 SEO/GEO 内容（description/keywords/geo_summary/词库/FAQ）。"""
    if not req.pages:
        return SeoGenerateResponse()
    client = _gen_client()
    workers = max(1, min(int(req.max_concurrency) or 4, len(req.pages)))
    results = []
    failed = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(_generate_one, client, p, SEO_GENERATE_SYSTEM_PROMPT): p.key for p in req.pages}
        for fut in as_completed(futs):
            key = futs[fut]
            try:
                results.append(fut.result())
            except Exception as e:
                logger.error("SEO generate failed for %s: %s", key, e)
                failed.append(key)
    order = {p.key: i for i, p in enumerate(req.pages)}
    results.sort(key=lambda r: order.get(r["key"], len(req.pages)))
    return SeoGenerateResponse(results=[SeoGenerateResult(**r) for r in results], failed=failed)


@router.post("/catalog/reload")
def catalog_reload():
    """强制 AI 顾问清除内容目录缓存，下次对话立即重新读取 SEO/GEO 词库
    （seo_keywords / seo_configs.geo_summary / seo_faqs）并重建 embedding。"""
    from intent_recognizer import get_intent_recognizer
    get_intent_recognizer().clear_cache()
    return {"status": "ok"}


# ── Health ────────────────────────────────────────────────────────

@router.get("/health", response_model=StatusOut)
def health():
    return StatusOut(status="ok", message="Running")


# ── Helper ────────────────────────────────────────────────────────

def _session_to_out(s) -> SessionOut:
    return SessionOut(
        session_id=s.session_id,
        title=s.title or s.session_id,
        username=s.username or "",
        message_count=len(s.messages),
        created_at=_time.strftime("%Y-%m-%dT%H:%M:%S", _time.localtime(s.created_at)),
        last_active=_time.strftime("%Y-%m-%dT%H:%M:%S", _time.localtime(s.updated_at)),
    )


app.include_router(router)

# ── GEO .md 页面（/ai/md/*，动态 Markdown 版本） ────────────────────
from ai_md import router as ai_md_router
app.include_router(ai_md_router, prefix="/ai")

if __name__ == "__main__":
    import multiprocessing
    workers = max(2, multiprocessing.cpu_count() // 2)
    uvicorn.run("api:app", host="0.0.0.0", port=8000, workers=workers)
