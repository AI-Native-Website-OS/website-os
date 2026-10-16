#!/usr/bin/env python3
"""
AI Consultant - OpenAI API 交互脚本
支持：单轮对话、多轮对话、流式输出、会话管理、历史记录管理、
      短期记忆、长期记忆、Token消耗统计、Token用量记录、
      自动折叠思考过程、配置模型提供方/名称/地址/Key/请求参数、
      系统提示词编写、多模态
参考设计：Dify, FastGPT, OpenWebUI, LangFlow, Cherry Studio, Chatbox, AnythingLLM
"""

import os, json, time, base64, logging, re, math, hashlib, threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable
from sqlalchemy import select, func, delete as sa_delete, update as sa_update

from db import get_db, get_redis, cache_active_session, cache_short_term, clear_short_term_cache
from models import AiSession, AiMessage, AiTokenUsage, AiPromptConfig
from knowledge import count_tokens, trim_to_tokens

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

MEMORY_MD = "MEMORY.md"

# 上下文块交付形式：True 时把所有 system 内容合并为一条（兼容不支持多条 system 消息的网关）；
# False 时每个上下文块作为独立、带标签的 system 消息发送。
CONTEXT_SINGLE_SYSTEM_MESSAGE = False

# ── 上下文注入 token 预算（写死常量，按模型上下文与实测命中率逐步调整）──
SYSTEM_PROMPT_BUDGET_TOKENS = 2000
MEMORY_BUDGET_TOKENS = 1500
KNOWLEDGE_BUDGET_TOKENS = 4000
INJECTION_BUDGET_TOKENS = 10000
HISTORY_BUDGET_TOKENS = 8000
# 记忆检索时进入 rerank 的候选条目数
MEMORY_RECALL_CANDIDATES = 12

# ── 长期记忆提取提示词（system prompt，用于把对话整合进 MEMORY.md）──
MEMORY_EXTRACTION_PROMPT = """# Agent Memory Extraction
## Role
Extract and maintain concise, accurate, long-term memories from conversation history. Optimize for low token usage while preserving essential meaning and context.

## Language Policy
- Write all memory descriptions in concise English.
- Preserve the original spelling and script of personal names, organization names, product names, project names, and other proper nouns.
- Never translate, transliterate, romanize, or invent English aliases for proper nouns.
- Preserve Chinese names in Chinese characters, even when the surrounding sentence is English.
- Keep technical identifiers, file paths, commands, code symbols, version numbers, and configuration values unchanged.
- Translate ordinary descriptive text into concise English when doing so preserves its meaning.
- Do not translate proper nouns merely to make the memory entirely English.

## Extraction Rules
1. Extract only information likely to improve future interactions.
2. Prioritize stable user preferences, ongoing projects, technical environments, architectural decisions, constraints, workflows, and unresolved issues.
3. Exclude greetings, one-off questions, temporary noise, and facts with little future value.
4. Preserve explicit requirements, prohibitions, exceptions, and rejected alternatives.
5. Never invent facts, relationships, intentions, or completed actions.
6. Distinguish confirmed facts from plans, assumptions, and unresolved issues.
7. Deduplicate related information and merge it into existing memories where appropriate.
8. Prefer the newest explicitly confirmed information when memories conflict.
9. Preserve essential context; do not over-compress memories into ambiguous keywords.
10. Never store passwords, API keys, access tokens, or other credentials.
11. Respect applicable privacy rules and explicit memory update or deletion requests.

## Memory Writing Style
- Use concise, information-dense English.
- Prefer short, self-contained bullet points.
- Omit unnecessary articles, filler words, and repeated explanations when meaning remains clear.
- Keep important names, technical details, constraints, reasons, and exceptions.
- Group related memories under short headings when useful.
- Preserve exact original names even when they appear inside English sentences.
- Modify only affected memories when updating an existing memory file.
- Do not rewrite valid memories unnecessarily.

## Examples

Input: "我的名字是张三。"
Output: "- User's name: 张三."

Input: "我在圣诺联合科技有限公司开发圣诺智采。"
Output: "- User develops 圣诺智采 at 圣诺联合科技有限公司."

Input: "我使用 PostgreSQL 18 和 Python 3.12。"
Output: "- Environment: PostgreSQL 18, Python 3.12."

Input: "不要使用 LLM 翻译数据库连接错误。"
Output: "- Prohibits LLM-based translation of database connection errors."

Input: "我计划将服务迁移到 Docker，但还没有实施。"
Output: "- Plans to migrate the service to Docker; migration is not yet implemented."

## Final Validation
Before returning the memory:
- Verify that all descriptions are in English.
- Verify that all proper nouns retain their original spelling and script.
- Verify that no Chinese personal name has been translated or transliterated.
- Verify that technical identifiers and configuration values remain unchanged.
- Verify that no unsupported facts or redundant entries were introduced.
- Verify that important constraints and exceptions remain explicit.
- Prefer the shortest wording that preserves the complete intended meaning.

## Output
Return only the updated memory content in Markdown.
Do not include explanations, analysis, or extraction notes.
If no useful memory exists, return an empty result in the caller's required format."""


def _resolve_role_from_db(identity: str) -> str:
    """按 real_name 或 username 查询 users 表得到角色；查不到返回空串。

    用于前端未提供 role 时的兜底，保证记忆落到正确的角色目录。
    """
    name = (identity or "").strip()
    if not name:
        return ""
    try:
        from sqlalchemy import text
        with get_db() as db:
            row = db.execute(text(
                "SELECT role FROM users "
                "WHERE deleted = 0 AND (real_name = :n OR username = :n) "
                "ORDER BY (username = :n) DESC LIMIT 1"
            ), {"n": name}).first()
            return (row[0] or "") if row else ""
    except Exception as exc:
        logger.warning("resolve role from db failed for %r: %s", name, exc)
        return ""


# ═══════════════════════════════════════════════════════════════
#  0. 对话错误分类（差异化友好提示 + 后台留痕）
# ═══════════════════════════════════════════════════════════════
ERROR_MESSAGES: Dict[str, str] = {
    "connection": "AI 服务连接失败，请检查网络后重试。",
    "timeout": "AI 响应超时，请稍后再试。",
    "endpoint": "AI 服务地址不可达或配置有误，请联系管理员。",
    "auth": "AI 服务鉴权失败，请联系管理员检查密钥配置。",
    "rate_limit": "当前咨询人数较多，请稍后再试。",
    "config": "AI 模型不存在或未配置，请联系管理员。",
    "upstream": "AI 服务暂时不可用，请稍后再试。",
    "empty": "抱歉，我暂时无法回答，请换个说法再试。",
    "unknown": "抱歉，AI 顾问暂时无法回答。请稍后再试。",
}


class ChatError(Exception):
    """带分类的对话错误：code 供前端映射友好提示，detail 供后台排查。"""

    def __init__(self, code: str, detail: str = "", message: str = ""):
        self.code = code or "unknown"
        self.detail = detail or ""
        self.message = message or ERROR_MESSAGES.get(self.code, ERROR_MESSAGES["unknown"])
        super().__init__(self.detail or self.message)


def _error_detail_text(exc: Exception) -> str:
    """汇总异常的响应体/消息文本，用于区分「地址错误」与「模型不存在」。"""
    chunks: List[str] = []
    body = getattr(exc, "body", None)
    if body is not None:
        try:
            chunks.append(body if isinstance(body, str) else json.dumps(body, ensure_ascii=False, default=str))
        except Exception:
            chunks.append(str(body))
    message = getattr(exc, "message", None)
    if message:
        chunks.append(str(message))
    chunks.append(str(exc))
    return " ".join(chunks).lower()


def classify_chat_error(exc: Exception) -> str:
    """把底层异常归类为稳定的错误码，避免前端只能显示统一兜底文案。"""
    status = getattr(exc, "status_code", None)
    if status is None:
        status = getattr(getattr(exc, "response", None), "status_code", None)

    name = type(exc).__name__.lower()
    text = _error_detail_text(exc)

    if status in (401, 403):
        return "auth"
    if status in (402, 429):
        return "rate_limit"
    if status in (404, 405):
        # 模型名错误 → 配置问题；路径/主机错误或 HTML 响应 → 服务地址问题
        return "config" if "model" in text else "endpoint"
    if isinstance(status, int) and status >= 500:
        return "upstream"

    if any(k in name for k in ("timeout",)) or "timed out" in text or "timeout" in text:
        return "timeout"
    if any(k in name for k in ("connection", "connect", "network", "dns")) \
            or any(k in text for k in ("connection", "unreachable", "refused", "network")):
        return "connection"
    if any(k in text for k in ("unauthorized", "authentication", "invalid api key", "incorrect api key", "api key")):
        return "auth"
    if any(k in text for k in ("rate limit", "too many requests", "quota", "insufficient")):
        return "rate_limit"
    if "model" in text and any(k in text for k in ("not found", "does not exist", "no such")):
        return "config"
    return "unknown"


@dataclass
class ContextBlock:
    """结构化上下文块：带类型标记与用途说明，避免内容无意义堆砌。"""
    type: str
    header: str
    purpose: str
    content: str
    priority: int = 0
    budget: int = 0
    included: bool = True
    skip_reason: str = ""

    def render(self) -> str:
        head = self.header + (f"（{self.purpose}）" if self.purpose else "")
        return f"{head}\n{self.content}" if self.content else head

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "header": self.header,
            "purpose": self.purpose,
            "content": self.content,
            "priority": self.priority,
            "budget": self.budget,
            "included": self.included,
            "skip_reason": self.skip_reason,
        }


# ═══════════════════════════════════════════════════════════════
#  1. 配置管理
# ═══════════════════════════════════════════════════════════════
class Config:
    """从系统环境变量加载所有可配置项"""

    def __init__(self):
        def _bool(key: str) -> bool:
            return (os.getenv(key) or "").strip().lower() == "true"
        def _int(key: str, default: int = 0) -> int:
            raw = os.getenv(key)
            try: return int(raw)
            except (ValueError, TypeError): return default
        def _float(key: str, default: float = 0.0) -> float:
            raw = os.getenv(key)
            try: return float(raw)
            except (ValueError, TypeError): return default
        def _str(key: str, default: str = "") -> str:
            return os.getenv(key) or default
        def _split_stop(raw):
            return [s.strip() for s in raw.split(",") if s.strip()] if raw else None

        # ── LLM Model ──
        self.llm_provider = _str("LLM_PROVIDER")
        self.llm_base_url = _str("LLM_BASE_URL")
        self.llm_api_key = _str("LLM_API_KEY")
        self.llm_model = _str("LLM_MODEL")
        self.llm_temperature = _float("LLM_TEMPERATURE", 0.7)
        self.llm_max_tokens = _int("LLM_MAX_TOKENS", 4096)
        self.llm_top_p = _float("LLM_TOP_P", 1.0)
        self.llm_frequency_penalty = _float("LLM_FREQUENCY_PENALTY")
        self.llm_presence_penalty = _float("LLM_PRESENCE_PENALTY")
        self.llm_stop = _split_stop(_str("LLM_STOP"))
        seed_raw = _str("LLM_SEED")
        self.llm_seed = int(seed_raw) if seed_raw and seed_raw.strip().isdigit() else None
        self.llm_thinking_keyword = _str("LLM_THINKING_KEYWORD")
        self.llm_thinking_auto_collapse = _bool("LLM_THINKING_AUTO_COLLAPSE")
        self.llm_thinking_enabled = _str("LLM_THINKING_ENABLED", "false").strip().lower() == "true"

        # ── Embedding Model ──
        self.embedding_provider = _str("EMBEDDING_PROVIDER")
        self.embedding_base_url = _str("EMBEDDING_BASE_URL")
        self.embedding_api_key = _str("EMBEDDING_API_KEY")
        self.embedding_model = _str("EMBEDDING_MODEL")
        dim_raw = _str("EMBEDDING_DIMENSION")
        self.embedding_dimension = int(dim_raw) if dim_raw and dim_raw.strip().isdigit() else None

        # ── VL Model ──
        self.vl_provider = _str("VL_PROVIDER")
        self.vl_base_url = _str("VL_BASE_URL")
        self.vl_api_key = _str("VL_API_KEY")
        self.vl_model = _str("VL_MODEL")
        self.vl_temperature = _float("VL_TEMPERATURE", 0.7)
        self.vl_max_tokens = _int("VL_MAX_TOKENS", 4096)
        self.vl_image_size = _str("VL_IMAGE_SIZE", "1024x1024")
        self.vl_image_quality = _str("VL_IMAGE_QUALITY", "standard")

        # ── Reranker Model ──
        self.reranker_provider = _str("RERANK_PROVIDER")
        self.reranker_base_url = _str("RERANK_BASE_URL")
        self.reranker_api_key = _str("RERANK_API_KEY")
        self.reranker_model = _str("RERANK_MODEL")
        self.reranker_enabled = _bool("RERANK_ENABLED")
        self.reranker_top_k = _int("RERANK_TOP_K", 6)

        # ── 媒体文件（图片/附件文档向量化用）──
        # 媒体根目录固定为 uploads；对话附件存于其 temp 子目录，代码中按需组合 "uploads/temp"
        self.upload_path = "uploads"
        # 后端兜底拉取地址（BACKEND_SERVER_URL）：默认由 BACKEND_HOST/BACKEND_PORT 推导；特殊场景可显式覆盖
        self.backend_base_url = _str("BACKEND_SERVER_URL", "") or (
            f"http://{_str('BACKEND_HOST', 'localhost')}:{_str('BACKEND_PORT', '8080')}"
        )

        # ── 知识库关闭时推荐跳转链接的来源（SEO/GEO 配置 seo_configs 的 Canonical URL，见 intent_recognizer）──

        # ── Internal defaults (no longer exposed as model config) ──
        # 系统提示词持久化于 ai_prompt_config 表，启动时由 build_system_prompt() 从数据库加载
        self.system_prompt = ""
        self.session_auto_save = True
        self.session_max_history = 100
        self.memory_short_term_size = 20
        self.memory_long_term_enabled = True
        # ── 记忆系统（参考 TencentDB Agent Memory 轻量分层）──
        self.memory_context_budget_chars = _int("MEMORY_CONTEXT_BUDGET_CHARS", 3000)
        self.token_log_enabled = True
        self.token_model_pricing = {}

        # ── 模型配置单一数据源：system_configs 表（管理后台修改后由后端 Java 写入）──
        # 若数据库存在对应记录则覆盖环境变量值，实现动态更新 Python 调用的模型配置
        self.load_model_config_from_db()

    # 模型配置属性 → system_configs 表 config_key 映射（与 Java 端 ModelConfigKeys 保持一致）
    DB_MODEL_KEY_MAP = {
        # ── LLM ──
        "llm_provider": "LLM_PROVIDER",
        "llm_base_url": "LLM_BASE_URL",
        "llm_api_key": "LLM_API_KEY",
        "llm_model": "LLM_MODEL",
        "llm_temperature": "LLM_TEMPERATURE",
        "llm_max_tokens": "LLM_MAX_TOKENS",
        "llm_top_p": "LLM_TOP_P",
        "llm_frequency_penalty": "LLM_FREQUENCY_PENALTY",
        "llm_presence_penalty": "LLM_PRESENCE_PENALTY",
        "llm_stop": "LLM_STOP",
        "llm_seed": "LLM_SEED",
        "llm_thinking_keyword": "LLM_THINKING_KEYWORD",
        "llm_thinking_auto_collapse": "LLM_THINKING_AUTO_COLLAPSE",
        "llm_thinking_enabled": "LLM_THINKING_ENABLED",
        # ── Embedding ──
        "embedding_provider": "EMBEDDING_PROVIDER",
        "embedding_base_url": "EMBEDDING_BASE_URL",
        "embedding_api_key": "EMBEDDING_API_KEY",
        "embedding_model": "EMBEDDING_MODEL",
        "embedding_dimension": "EMBEDDING_DIMENSION",
        # ── VL ──
        "vl_provider": "VL_PROVIDER",
        "vl_base_url": "VL_BASE_URL",
        "vl_api_key": "VL_API_KEY",
        "vl_model": "VL_MODEL",
        "vl_temperature": "VL_TEMPERATURE",
        "vl_max_tokens": "VL_MAX_TOKENS",
        "vl_image_size": "VL_IMAGE_SIZE",
        "vl_image_quality": "VL_IMAGE_QUALITY",
        # ── Rerank ──
        "reranker_provider": "RERANK_PROVIDER",
        "reranker_base_url": "RERANK_BASE_URL",
        "reranker_api_key": "RERANK_API_KEY",
        "reranker_model": "RERANK_MODEL",
        "reranker_enabled": "RERANK_ENABLED",
        "reranker_top_k": "RERANK_TOP_K",
    }

    @staticmethod
    def _coerce_config_value(attr: str, raw: str, int_fields: set, float_fields: set, bool_fields: set) -> tuple:
        """将 system_configs 原始字符串按属性类型转换；类型非法时返回 (False, None) 表示跳过。"""
        if attr == "llm_stop":
            return True, [s.strip() for s in raw.split(",") if s.strip()] if raw else None
        if attr in bool_fields:
            return True, raw.strip().lower() == "true"
        if attr in int_fields:
            if raw.strip().isdigit():
                return True, int(raw)
            return False, None
        if attr in float_fields:
            return True, float(raw)
        return True, raw

    def load_model_config_from_db(self, force: bool = False):
        """从 system_configs 表读取模型配置并覆盖环境变量值。

        容错（R40）：数据库不可用或表内无记录时静默保留现有值（.env / 环境变量）。
        字段缺失、类型非法时跳过该字段，不阻断整体加载。
        """
        db_vals = _db_model_config_values(force)
        if not db_vals:
            return
        int_fields = {"llm_max_tokens", "llm_seed", "embedding_dimension", "vl_max_tokens", "reranker_top_k"}
        float_fields = {"llm_temperature", "llm_top_p", "llm_frequency_penalty", "llm_presence_penalty", "vl_temperature"}
        bool_fields = {"llm_thinking_auto_collapse", "llm_thinking_enabled", "reranker_enabled"}
        for attr, env_key in self.DB_MODEL_KEY_MAP.items():
            raw = db_vals.get(env_key)
            if raw is None:
                continue
            try:
                should_set, value = self._coerce_config_value(attr, raw, int_fields, float_fields, bool_fields)
            except (ValueError, TypeError):
                continue
            if should_set:
                setattr(self, attr, value)


# 模型配置数据库读取缓存（短 TTL，避免高频 Config() 实例化重复查询）
_db_config_cache: Dict[str, Any] = {"ts": 0.0, "values": None}
_DB_CONFIG_CACHE_TTL = 5.0


def _config_crypto_key() -> Optional[bytes]:
    """读取敏感配置 AES 落盘密钥（由后端启动时生成并存入 system_secrets 表）。

    兼容 Base64(16/24/32 字节) 与普通字符串两种写法；普通字符串经 SHA-256 派生。
    """
    try:
        from db import get_system_secret
        raw = get_system_secret("CONFIG_CRYPTO_AES_KEY")
    except Exception:
        raw = ""
    if not raw:
        return None
    try:
        key = base64.b64decode(raw)
        if len(key) in (16, 24, 32):
            return key
    except Exception:
        pass
    return hashlib.sha256(raw.encode("utf-8")).digest()


def _decrypt_db_value(value: str) -> str:
    """解密后端 AES 落盘的敏感配置（enc:v1: 前缀）；历史明文原样返回。"""
    if not value or not value.startswith("enc:v1:"):
        return value
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError:
        raise RuntimeError("检测到加密敏感配置(enc:v1:)，但未安装 cryptography 依赖")
    key = _config_crypto_key()
    if key is None:
        raise RuntimeError("检测到加密敏感配置(enc:v1:)，但缺少 CONFIG_CRYPTO_AES_KEY（system_secrets 表）")
    data = base64.b64decode(value[len("enc:v1:"):])
    nonce, ciphertext = data[:12], data[12:]
    return AESGCM(key).decrypt(nonce, ciphertext, None).decode("utf-8")


def _db_model_config_values(force: bool = False) -> Dict[str, str]:
    """查询 system_configs 表，返回 config_key → config_value（仅模型配置项）。

    敏感项（如 *._API_KEY）在库中为 AES 密文，读取时解密为明文供 AI 调用使用。
    短 TTL 缓存；force=True 时绕过缓存（管理后台保存后的热更新）。
    容错：任何异常返回空 dict，不影响上层逻辑。
    """
    now = time.time()
    if not force and _db_config_cache["values"] is not None \
            and now - _db_config_cache["ts"] < _DB_CONFIG_CACHE_TTL:
        return _db_config_cache["values"]
    try:
        from models import SystemConfig
        keys = set(Config.DB_MODEL_KEY_MAP.values())
        with get_db() as db:
            rows = db.execute(
                select(SystemConfig).where(SystemConfig.config_key.in_(keys))
            ).scalars().all()
        values: Dict[str, str] = {}
        for r in rows:
            key = r.config_key
            raw = r.config_value or ""
            try:
                values[key] = _decrypt_db_value(raw)
            except Exception as e:
                logger.exception("解密配置 %s 失败，跳过该项（回退环境变量）", key)
        _db_config_cache["values"] = values
        _db_config_cache["ts"] = now
        return values
    except Exception as e:
        logger.warning("load model config from database failed: %s", e)
        return {}


# RAG 配置属性 → system_configs 表 config_key 映射（持久化，重启后仍生效）
DB_RAG_KEY_MAP = {
    "rag_enabled": "RAG_ENABLED",
    "rag_kb_ids": "RAG_KB_IDS",
    "rag_top_k": "RAG_TOP_K",
    "rag_threshold": "RAG_THRESHOLD",
    "rag_max_threshold": "RAG_MAX_THRESHOLD",
    "rag_reranker_enabled": "RAG_RERANKER_ENABLED",
    "rag_reranker_model": "RAG_RERANKER_MODEL",
}


def _coerce_rag_value(attr: str, raw: str):
    """将 system_configs 原始字符串按 RAG 属性类型转换。"""
    if attr == "rag_kb_ids":
        raw = (raw or "").strip()
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            return [int(x) for x in parsed] if isinstance(parsed, list) else []
        except Exception:
            return [int(s) for s in raw.split(",") if s.strip().isdigit()]
    if attr in ("rag_enabled", "rag_reranker_enabled"):
        return str(raw).strip().lower() == "true"
    if attr == "rag_top_k":
        return int(raw)
    if attr in ("rag_threshold", "rag_max_threshold"):
        return float(raw)
    return raw


def _db_rag_config_values() -> Dict[str, str]:
    """查询 system_configs 表，返回 RAG 配置 config_key → config_value。容错返回空 dict。"""
    try:
        from models import SystemConfig
        keys = set(DB_RAG_KEY_MAP.values())
        with get_db() as db:
            rows = db.execute(
                select(SystemConfig).where(SystemConfig.config_key.in_(keys))
            ).scalars().all()
        return {r.config_key: (r.config_value or "") for r in rows}
    except Exception as e:
        logger.warning("load rag config from database failed: %s", e)
        return {}


def save_rag_config_to_db(values: Dict[str, Any]):
    """将 RAG 配置 upsert 到 system_configs 表（config_type=rag），供重启后热加载。"""
    from models import SystemConfig
    with get_db() as db:
        for key, val in values.items():
            if isinstance(val, bool):
                text = "true" if val else "false"
            elif isinstance(val, (list, tuple)):
                text = json.dumps(list(val))
            else:
                text = str(val)
            row = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
            if row is None:
                db.add(SystemConfig(config_key=key, config_value=text,
                                    config_type="rag", description="AI 知识库 RAG 配置"))
            else:
                row.config_value = text
                row.config_type = "rag"


# ═══════════════════════════════════════════════════════════════
#  2. Token 消耗统计 & 记录
# ═══════════════════════════════════════════════════════════════
class TokenTracker:
    """Token 使用量统计 — 持久化到 PostgreSQL"""

    def __init__(self, config: Config):
        self.config = config
        # in-memory cache for fast reads during session
        self._session_cache: Dict[str, Dict[str, int]] = {}

    def _calc_cost(self, prompt: int, completion: int, model: str) -> float:
        p = self.config.token_model_pricing.get(model, {})
        return round(prompt * p.get("input", 0) + completion * p.get("output", 0), 6)

    def record(self, session_id: str, prompt_tokens: int, completion_tokens: int, model: str):
        total = prompt_tokens + completion_tokens
        c = self._session_cache.setdefault(session_id, {"prompt": 0, "completion": 0, "total": 0})
        c["prompt"] += prompt_tokens
        c["completion"] += completion_tokens
        c["total"] += total

        if self.config.token_log_enabled:
            import threading
            def _log():
                try:
                    with get_db() as db:
                        db.add(AiTokenUsage(
                            session_id=session_id,
                            model=model,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            total_tokens=total,
                            cost_usd=self._calc_cost(prompt_tokens, completion_tokens, model),
                            timestamp=datetime.now(datetime.timezone.utc).replace(tzinfo=None),
                        ))
                except Exception:
                    pass
            threading.Thread(target=_log, daemon=True).start()

    def get_session_stats(self, session_id: str) -> Dict[str, int]:
        with get_db() as db:
            row = db.execute(
                select(
                    func.coalesce(func.sum(AiTokenUsage.prompt_tokens), 0),
                    func.coalesce(func.sum(AiTokenUsage.completion_tokens), 0),
                    func.coalesce(func.sum(AiTokenUsage.total_tokens), 0),
                ).where(AiTokenUsage.session_id == session_id)
            ).one()
        return {"prompt": row[0], "completion": row[1], "total": row[2]}

    def get_total_stats(self) -> Dict[str, int]:
        with get_db() as db:
            row = db.execute(
                select(
                    func.coalesce(func.sum(AiTokenUsage.prompt_tokens), 0),
                    func.coalesce(func.sum(AiTokenUsage.completion_tokens), 0),
                    func.coalesce(func.sum(AiTokenUsage.total_tokens), 0),
                )
            ).one()
        return {"prompt": row[0], "completion": row[1], "total": row[2]}

    def get_all_logs(self) -> List[Dict]:
        with get_db() as db:
            rows = db.execute(
                select(AiTokenUsage).order_by(AiTokenUsage.timestamp.desc()).limit(500)
            ).scalars().all()
            result = [{
                "timestamp": r.timestamp.isoformat(),
                "session_id": r.session_id,
                "model": r.model,
                "prompt_tokens": r.prompt_tokens,
                "completion_tokens": r.completion_tokens,
                "total_tokens": r.total_tokens,
                "cost_usd": r.cost_usd,
            } for r in rows]
        return result


# ═══════════════════════════════════════════════════════════════
#  3. 记忆管理（短期内存 + 长期 memories/{username}/MEMORY.md 文件）
# ═══════════════════════════════════════════════════════════════
class MemoryManager:
    """长期记忆：每个用户一个 memories/{role}/{username}/MEMORY.md（AGENTS.md 风格精简整合）。

    短期记忆仍为进程内缓存；长期记忆不再拆分 6 个文件，也不再维护向量索引。
    """

    MEMORY_DIR = Path(__file__).parent / "memories"
    MEMORY_SECTIONS = ["Profile", "Preferences", "Facts", "Decisions", "Timeline"]
    LEGACY_FILENAMES = [
        "profile.md", "preferences.md", "knowledge.md",
        "conversation.md", "decisions.md", "timeline.md",
    ]
    INDEX_FILENAME = ".index.json"
    _BULLET_RE = re.compile(r'^-\s*(?:\[([^\]]*)\]\s*)?(?:\*\*[^*]*\*\*\s*:?\s*)?(.*)$')

    def __init__(self, config: Config):
        self.config = config
        self.short_term: List[Dict] = []
        self._emb = None
        self._rr = None
        app_memories = Path("/app/memories")
        if app_memories.is_dir():
            self.MEMORY_DIR = app_memories
        else:
            self.MEMORY_DIR = Path(__file__).parent / "memories"
        self.MEMORY_DIR.mkdir(exist_ok=True)
        try:
            self.migrate_legacy()
        except Exception as exc:
            logger.warning("memory legacy migration failed: %s", exc)

    # ── 路径与文件 ─────────────────────────────────────────
    @staticmethod
    def _sanitize(name: str) -> str:
        safe = re.sub(r'[\\/:*?"<>|]', '_', str(name))
        return safe or "anonymous"

    def _parse_user(self, username: str, role: str = "") -> tuple:
        """Split 'role/username' format or return (role, username) as given."""
        if not role and "/" in username:
            parts = username.split("/", 1)
            return parts[0], parts[1]
        return role, username

    def _memory_path(self, username: str, role: str = "") -> Path:
        role, uname = self._parse_user(username, role)
        role_dir = self._sanitize(role) if role else "_"
        return self.MEMORY_DIR / role_dir / self._sanitize(uname) / MEMORY_MD

    def _ensure_user_dir(self, username: str, role: str = "") -> Path:
        role, uname = self._parse_user(username, role)
        role_dir = self.MEMORY_DIR / (self._sanitize(role) if role else "_")
        user_dir = role_dir / self._sanitize(uname)
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    def _list_user_paths(self) -> List[Dict]:
        """Return [{role, username, path}] for all user dirs containing memory."""
        results = []
        if not self.MEMORY_DIR.is_dir():
            return results
        for role_dir in sorted(self.MEMORY_DIR.iterdir()):
            if not role_dir.is_dir():
                continue
            for user_dir in sorted(role_dir.iterdir()):
                if not user_dir.is_dir():
                    continue
                if (user_dir / MEMORY_MD).exists() or any(
                        (user_dir / fn).exists() for fn in self.LEGACY_FILENAMES):
                    results.append({
                        "role": role_dir.name,
                        "username": user_dir.name,
                        "path": user_dir,
                    })
        return results

    def list_users(self) -> List[Dict]:
        """所有含记忆的用户 [{role, username, path}]。"""
        return self._list_user_paths()

    @staticmethod
    def _write_atomic(path: Path, content: str):
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(content, "utf-8")
        os.replace(tmp, path)

    # ── 文件格式（纯英文内部结构）───────────────────────────
    @staticmethod
    def _new_file(username: str = "", role: str = "") -> str:
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        return (f"# Memory\n\n> updated: {now}\n\n## Profile\n\n## Preferences\n\n"
                f"## Facts\n\n## Decisions\n\n## Timeline\n")

    @staticmethod
    def _is_new_format(text: str) -> bool:
        t = text.lstrip()
        return t.startswith("# Memory") and any(
            f"## {s}" in text for s in MemoryManager.MEMORY_SECTIONS)

    @staticmethod
    def _memory_body(text: str) -> str:
        """去掉文件头（# Memory 与元信息引用行），仅保留章节正文。"""
        lines = []
        for ln in text.splitlines():
            s = ln.strip()
            if s.startswith("# Memory") or s.startswith("> user:") or s.startswith("> updated"):
                continue
            lines.append(ln.rstrip())
        return "\n".join(lines).strip("\n")

    @staticmethod
    def _section_for_file(filename: str) -> str:
        return {
            "profile.md": "Profile",
            "preferences.md": "Preferences",
            "knowledge.md": "Facts",
            "decisions.md": "Decisions",
            "conversation.md": "Timeline",
            "timeline.md": "Timeline",
        }.get(filename, "Facts")

    def _collect_into(self, sections: Dict[str, List[str]], text: str, fallback: str):
        """把任意格式的旧内容解析进 sections；兼容 `## Section` 分组与逐条 bullet。"""
        current = fallback
        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                continue
            if line.startswith("##"):
                name = line[2:].strip()
                current = name if name in sections else fallback
                continue
            if line.startswith("#") or line.startswith(">"):
                continue
            if not line.startswith("-"):
                continue
            m = self._BULLET_RE.match(line)
            if not m:
                continue
            ts = (m.group(1) or "").strip()
            bullet = (m.group(2) or "").strip()
            if not bullet:
                continue
            if current == "Timeline" and ts:
                date = re.split(r'[ T]', ts, 1)[0]
                bullet = f"{date}: {bullet}"
            sections[current].append(bullet)

    def _render_sections(self, sections: Dict[str, List[str]], username: str,
                         role: str, now: Optional[str] = None) -> str:
        now = now or datetime.now().strftime("%Y-%m-%d %H:%M")
        parts = [f"# Memory\n\n> updated: {now}\n"]
        seen = set()
        for section in self.MEMORY_SECTIONS:
            items = []
            for b in sections.get(section, []):
                key = b.strip().lower()
                if not key or key in seen:
                    continue
                seen.add(key)
                items.append(b.strip())
            if not items:
                continue
            parts.append("## " + section + "\n" + "\n".join(f"- {b}" for b in items) + "\n")
        return "\n".join(parts)

    # ── 旧 6 文件迁移（一次性；成功后删除旧文件）─────────────
    def migrate_legacy(self):
        for info in self._list_user_paths():
            try:
                self._migrate_user_dir(info["username"], info["role"], info["path"])
            except Exception as exc:
                logger.warning("memory migration failed for %s/%s: %s",
                               info["role"], info["username"], exc)

    def _migrate_user_dir(self, username: str, role: str, user_dir: Path):
        mem_path = user_dir / MEMORY_MD
        legacy_present = any((user_dir / fn).exists() for fn in self.LEGACY_FILENAMES)
        mem_text = mem_path.read_text("utf-8") if mem_path.exists() else ""
        if not legacy_present and (not mem_path.exists() or self._is_new_format(mem_text)):
            return
        sections = {s: [] for s in self.MEMORY_SECTIONS}
        if mem_text:
            self._collect_into(sections, mem_text, "Facts")
        for fn in self.LEGACY_FILENAMES:
            p = user_dir / fn
            if p.exists():
                self._collect_into(sections, p.read_text("utf-8"), self._section_for_file(fn))
        content = self._render_sections(sections, username, role)
        self._write_atomic(mem_path, content)
        # 写入成功后删除旧文件与索引，永久不再出现
        for fn in self.LEGACY_FILENAMES:
            (user_dir / fn).unlink(missing_ok=True)
        (user_dir / self.INDEX_FILENAME).unlink(missing_ok=True)
        for tmp in list(user_dir.glob("*.tmp")):
            tmp.unlink(missing_ok=True)

    def relocate_orphan_memories(self, role_resolver) -> int:
        """把落在默认 '_' 目录、但能解析出真实角色的用户记忆移动到 {role}/{name}。

        用于修正历史上因 role 缺失而写入 memories/_/ 的记忆文件。返回移动数量。
        """
        default_dir = self.MEMORY_DIR / "_"
        if not default_dir.is_dir():
            return 0
        moved = 0
        for user_dir in sorted(default_dir.iterdir()):
            if not user_dir.is_dir():
                continue
            src = user_dir / MEMORY_MD
            if not src.exists():
                continue
            try:
                role = role_resolver(user_dir.name)
            except Exception:
                role = ""
            if not role or role == "_":
                continue
            target_dir = self.MEMORY_DIR / self._sanitize(role) / user_dir.name
            target = target_dir / MEMORY_MD
            if target.exists():
                logger.warning("memory relocate skipped (target exists): %s/%s", role, user_dir.name)
                continue
            target_dir.mkdir(parents=True, exist_ok=True)
            os.replace(src, target)
            (user_dir / self.INDEX_FILENAME).unlink(missing_ok=True)
            for f in list(user_dir.iterdir()):
                if f.is_file() and f != src:
                    f.unlink(missing_ok=True)
            try:
                user_dir.rmdir()
            except OSError:
                pass
            moved += 1
            logger.info("relocated memory %s/%s -> %s/%s", "_", user_dir.name, role, user_dir.name)
        return moved

    # ── 读写 ───────────────────────────────────────────────
    def init_user(self, username: str, role: str = ""):
        """为用户创建单个 MEMORY.md（若不存在）。"""
        path = self._memory_path(username, role)
        if not path.exists():
            self._write_atomic(path, self._new_file(username, role))

    def read_file(self, username: str, role: str = "") -> str:
        path = self._memory_path(username, role)
        if path.exists():
            return path.read_text("utf-8")
        return ""

    def write_file(self, username: str, content: str, role: str = ""):
        self._write_atomic(self._memory_path(username, role), content)

    def list_files(self) -> List[Dict]:
        files = []
        for info in self._list_user_paths():
            path = info["path"] / MEMORY_MD
            if not path.exists():
                continue
            content = path.read_text("utf-8")
            files.append({
                "username": info["username"],
                "filename": MEMORY_MD,
                "role": info["role"],
                "size": len(content),
                "line_count": len(content.strip().splitlines()),
                "updated_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
            })
        return files

    def search(self, username: str, keyword: str, role: str = "") -> List[Dict]:
        """单文件内的关键词匹配（后台搜索用，不再依赖向量）。"""
        content = self.read_file(username, role)
        if not content or not keyword:
            return []
        kw = keyword.lower()
        results = []
        for line in content.splitlines():
            s = line.strip().lstrip("- ").strip()
            if not s or s.startswith("#") or s.startswith(">"):
                continue
            if kw in s.lower():
                results.append({"content": s, "role": role,
                                "username": username, "file_type": "memory"})
            if len(results) >= 50:
                break
        return results

    # ── 短期记忆 ───────────────────────────────────────────
    def add(self, role_type: str, content: str, session_id: str = "",
            username: str = "", user_role: str = ""):
        entry = {"role": role_type, "content": content, "timestamp": time.time(),
                 "session_id": session_id, "username": username, "user_role": user_role}
        self.short_term.append(entry)
        cache_short_term(session_id, entry)
        if len(self.short_term) > self.config.memory_short_term_size:
            self.short_term.pop(0)

    def clear_short(self):
        self.short_term.clear()
        clear_short_term_cache()

    def clear_long(self):
        for info in self._list_user_paths():
            user_dir = info["path"]
            for f in list(user_dir.iterdir()):
                if f.is_file():
                    f.unlink(missing_ok=True)
            try:
                user_dir.rmdir()
            except OSError:
                pass

    # ── 记忆块构建（先按提问检索 + 重排，再按 token 预算注入）────
    @staticmethod
    def _last_user_text(messages: List[Dict]) -> str:
        for m in reversed(messages):
            if not isinstance(m, dict) or m.get("role") != "user":
                continue
            c = m.get("content")
            if isinstance(c, str):
                return c
            if isinstance(c, list):
                return " ".join(p.get("text", "") for p in c if isinstance(p, dict) and p.get("text"))
            if c:
                return str(c)
        return ""

    @property
    def _embedder(self):
        if getattr(self, "_emb", None) is None:
            from knowledge import EmbeddingClient
            self._emb = EmbeddingClient(self.config)
        return self._emb

    @property
    def _reranker(self):
        if getattr(self, "_rr", None) is None:
            from knowledge import RerankerClient
            self._rr = RerankerClient(self.config)
        return self._rr

    _SECTION_LABELS = {
        "Profile": "Profile", "Preferences": "Preferences", "Facts": "Facts",
        "Decisions": "Decisions", "Timeline": "Timeline",
    }

    @classmethod
    def _memory_items(cls, body: str) -> List[Dict[str, str]]:
        """把 MEMORY.md 正文拆成条目：每个 bullet 一条，附所属 section。"""
        items: List[Dict[str, str]] = []
        section = ""
        for raw in body.splitlines():
            line = raw.strip()
            if not line:
                continue
            if line.startswith("##"):
                name = line[2:].strip()
                section = cls._SECTION_LABELS.get(name, name)
                continue
            if line.startswith("#") or line.startswith(">"):
                continue
            text = line.lstrip("-* ").strip()
            if not text:
                continue
            label = f"{section}: {text}" if section else text
            items.append({"section": section, "text": text, "label": label})
        return items

    @staticmethod
    def _cosine(a: List[float], b: List[float]) -> float:
        if not a or not b:
            return 0.0
        n = min(len(a), len(b))
        dot = sum(a[i] * b[i] for i in range(n))
        na = math.sqrt(sum(x * x for x in a[:n]))
        nb = math.sqrt(sum(y * y for y in b[:n]))
        if na == 0.0 or nb == 0.0:
            return 0.0
        return dot / (na * nb)

    def _rerank_memory(self, query: str, items: List[Dict[str, str]]) -> List[Dict[str, str]]:
        try:
            rr = self._reranker
            if rr.enabled and len(items) > 1:
                ranked = rr.rerank(query, [it["label"] for it in items], top_n=len(items))
                out: List[Dict[str, str]] = []
                seen = set()
                for r in ranked:
                    idx = r.get("index")
                    if idx is not None and 0 <= idx < len(items) and idx not in seen:
                        out.append(items[idx])
                        seen.add(idx)
                if out:
                    return out
        except Exception as e:
            logger.warning("memory rerank failed: %s", e)
        return items

    @staticmethod
    def _fill_budget(texts: List[str], budget: int) -> List[str]:
        """按重要性顺序贪心选取条目，累计 token 不超过预算。"""
        kept: List[str] = []
        total = 0
        for t in texts:
            tt = count_tokens(t) + 1
            if not kept:
                if tt > budget:
                    t = trim_to_tokens(t, budget, mode="head")
                    tt = count_tokens(t) + 1
                kept.append(t)
                total += tt
                continue
            if total + tt > budget:
                continue
            kept.append(t)
            total += tt
        return kept

    def _retrieve_memory(self, items: List[Dict[str, str]], query: str,
                         budget: int) -> List[str]:
        query = (query or "").strip()
        if query and items:
            try:
                emb = self._embedder
                if emb.base_url and emb.model:
                    vectors = emb.embed_batch([query] + [it["label"] for it in items])
                    qv = vectors[0]
                    scored = sorted(
                        zip(items, vectors[1:]),
                        key=lambda p: self._cosine(qv, p[1]), reverse=True)
                    candidates = [it for it, _ in scored[:MEMORY_RECALL_CANDIDATES]]
                    ordered = self._rerank_memory(query, candidates)
                    return self._fill_budget([it["text"] for it in ordered], budget)
            except Exception as e:
                logger.warning("memory retrieval failed, fallback to whole-file: %s", e)
        return self._fill_budget([it["text"] for it in items], budget)

    def build_memory_blocks(self, username: str, role: str = "", query: str = "",
                            session_messages: Optional[List[Dict]] = None,
                            budget: Optional[int] = None) -> List[ContextBlock]:
        """先按提问对 MEMORY.md 条目做 Embedding 检索 + Rerank，再在 token 预算内注入。"""
        if not (self.config.memory_long_term_enabled and username):
            return []
        if not role:
            role = _resolve_role_from_db(username) or "_"
        body = self._memory_body(self.read_file(username, role))
        if not body.strip():
            return []
        items = self._memory_items(body)
        if not items:
            return []
        budget = budget or MEMORY_BUDGET_TOKENS
        effective_query = query or self._last_user_text(session_messages or [])
        selected = self._retrieve_memory(items, effective_query, budget)
        if not selected:
            return []
        return [ContextBlock(
            type="memory", header="[记忆]",
            purpose="用户的长期记忆；用于个性化与保持上下文一致，不要直接复述",
            content="\n".join(selected), priority=10, budget=budget)]


# ═══════════════════════════════════════════════════════════════
#  4. 会话管理
# ═══════════════════════════════════════════════════════════════
class Session:
    def __init__(self, session_id: str, system_prompt: str = "", model: str = ""):
        self.session_id = session_id
        self.system_prompt = system_prompt
        self.model = model
        self.messages: List[Dict] = []
        self.created_at = time.time()
        self.updated_at = time.time()
        self.title = ""
        self.username = ""
        self.role = ""
        self._saved_msg_count = 0

    def to_dict(self) -> Dict:
        return {k: v for k, v in vars(self).items()}

    @classmethod
    def from_dict(cls, d: Dict) -> "Session":
        s = cls(d["session_id"], d.get("system_prompt", ""), d.get("model", ""))
        s.messages = d.get("messages", [])
        s.created_at = d.get("created_at", time.time())
        s.updated_at = d.get("updated_at", time.time())
        s.title = d.get("title", "")
        s.username = d.get("username", "")
        s.role = d.get("role", "")
        s._saved_msg_count = len(s.messages)
        return s


class SessionManager:
    """会话 CRUD — 持久化到 PostgreSQL + Redis 缓存"""

    def __init__(self, config: Config):
        self.config = config
        self.sessions: Dict[str, Session] = {}
        self.current_id: Optional[str] = None
        # Restore active session from Redis
        from db import get_cached_active_session
        cached = get_cached_active_session()
        if cached:
            session = self._load(cached)
            if session:
                self.sessions[cached] = session
                self.current_id = cached

    def create(self, session_id: str = "", system_prompt: str = "", model: str = "", username: str = "", role: str = "") -> Session:
        sid = session_id or f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.urandom(4).hex()}"
        session = Session(sid, system_prompt or self.config.system_prompt, model or self.config.llm_model)
        session.username = username
        session.role = role
        self.sessions[sid] = session
        self.current_id = sid
        with get_db() as db:
            db.add(AiSession(
                session_id=sid,
                title=session.title,
                username=username,
                system_prompt=session.system_prompt,
                model=session.model,
                created_at=session.created_at,
                updated_at=session.updated_at,
            ))
        cache_active_session(sid)
        return session

    def switch(self, session_id: str) -> Optional[Session]:
        if session_id in self.sessions:
            self.current_id = session_id
            cache_active_session(session_id)
            return self.sessions[session_id]
        session = self._load(session_id)
        if session:
            self.sessions[session_id] = session
            self.current_id = session_id
            cache_active_session(session_id)
            return session
        logger.warning("会话不存在: %s", session_id)
        return None

    def current(self) -> Optional[Session]:
        return self.sessions.get(self.current_id) if self.current_id else None

    def delete(self, session_id: str) -> bool:
        self.sessions.pop(session_id, None)
        with get_db() as db:
            db.execute(sa_delete(AiSession).where(AiSession.session_id == session_id))
        if self.current_id == session_id:
            self.current_id = None
        return True

    def list_all(self) -> List[Dict]:
        with get_db() as db:
            rows = db.execute(
                select(AiSession).order_by(AiSession.updated_at.desc())
            ).scalars().all()
            msg_counts = dict(
                db.execute(
                    select(AiMessage.session_id, func.count(AiMessage.id))
                    .group_by(AiMessage.session_id)
                ).all()
            )
            result = [{
                "session_id": r.session_id,
                "title": r.title or r.session_id,
                "username": r.username or "",
                "message_count": msg_counts.get(r.session_id, 0),
                "last_active": datetime.fromtimestamp(r.updated_at).isoformat(),
                "created_at": datetime.fromtimestamp(r.created_at).isoformat(),
            } for r in rows]
        return result

    def save(self, session: Session):
        if not self.config.session_auto_save:
            return
        if len(session.messages) > self.config.session_max_history:
            session.messages = session.messages[-(self.config.session_max_history):]
            session._saved_msg_count = 0
        new_msgs = session.messages[session._saved_msg_count:]
        if not new_msgs:
            return
        with get_db() as db:
            db.execute(
                sa_update(AiSession).where(AiSession.session_id == session.session_id).values(
                    title=session.title,
                    username=session.username,
                    system_prompt=session.system_prompt,
                    model=session.model,
                    updated_at=session.updated_at,
                )
            )
            for msg in new_msgs:
                db.add(AiMessage(
                    session_id=session.session_id,
                    role=msg["role"],
                    content=msg["content"],
                    reasoning=msg.get("reasoning"),
                    attachments=msg.get("attachments"),
                    images=msg.get("images"),
                    display_content=msg.get("display_content"),
                    error=msg.get("error"),
                    timestamp=msg.get("timestamp", time.time()),
                ))
        session._saved_msg_count = len(session.messages)

    def save_current(self):
        s = self.current()
        if s:
            self.save(s)

    def _load(self, session_id: str) -> Optional[Session]:
        with get_db() as db:
            row = db.get(AiSession, session_id)
            if not row:
                return None
            msg_rows = db.execute(
                select(AiMessage).where(AiMessage.session_id == session_id)
                .order_by(AiMessage.timestamp)
            ).scalars().all()
            session = Session(session_id, row.system_prompt, row.model)
            session.messages = [{"role": m.role, "content": m.content, "reasoning": m.reasoning, "attachments": m.attachments, "images": m.images, "display_content": m.display_content, "error": m.error, "timestamp": m.timestamp} for m in msg_rows]
            session.created_at = row.created_at
            session.updated_at = row.updated_at
            session.title = row.title
            session.username = row.username or ""
        return session

    def get_history(self, session_id: str, limit: Optional[int] = None) -> List[Dict]:
        with get_db() as db:
            query = select(AiMessage).where(AiMessage.session_id == session_id).order_by(AiMessage.id.desc())
            if limit is not None:
                query = query.limit(limit)
            rows = db.execute(query).scalars().all()
            result = [{"role": r.role, "content": r.content, "reasoning": r.reasoning, "attachments": r.attachments, "images": r.images, "display_content": r.display_content, "error": r.error, "timestamp": r.timestamp} for r in rows]
        return result[::-1]


# ═══════════════════════════════════════════════════════════════
#  5. AI 客户端（核心 API 封装）
# ═══════════════════════════════════════════════════════════════
class AIClient:
    """封装 OpenAI API 调用，支持单轮、流式、多模态"""

    def __init__(self, config: Config):
        self.config = config
        self.client = None
        self.__vl_client = None
        # 网关是否已拒绝多条 system 消息（拒绝后自动回退为单条合并）
        self._force_single_system = CONTEXT_SINGLE_SYSTEM_MESSAGE
        self._init()

    def _init(self):
        try:
            from openai import OpenAI
            api_key = self.config.llm_api_key or os.environ.get("OPENAI_API_KEY") or "EMPTY"
            self.client = OpenAI(
                api_key=api_key,
                base_url=self.config.llm_base_url.rstrip("/") + "/",
            )
        except ImportError:
            logger.error("请安装 openai: pip install openai")
            raise

    @property
    def _vl_client(self):
        if self.__vl_client is None and self.config.vl_base_url:
            from openai import OpenAI
            try:
                self.__vl_client = OpenAI(
                    api_key=self.config.vl_api_key or self.config.llm_api_key
                    or os.environ.get("OPENAI_API_KEY") or "EMPTY",
                    base_url=self.config.vl_base_url.rstrip("/") + "/",
                )
            except Exception:
                self.__vl_client = False
        return self.__vl_client if self.__vl_client else None

    def _use_vl(self, images: Optional[List]) -> bool:
        return bool(images) and self._vl_client is not None

    def _build_messages(self, sp: str, history: List[Dict], user_input: str,
                        images: Optional[List[str]] = None) -> List[Dict]:
        # history 中的 system 消息为结构化上下文块（记忆/知识库/目录/线索/语言）。
        system_blocks = []
        non_system = []
        for m in history:
            if m.get("role") == "system":
                system_blocks.append(m.get("content", ""))
            else:
                non_system.append(m)

        if getattr(self, "_force_single_system", CONTEXT_SINGLE_SYSTEM_MESSAGE):
            # 兼容不支持多条 system 消息的网关：合并为一条
            sp = "\n\n".join(p for p in [sp, *system_blocks] if p)
            msgs = [{"role": "system", "content": sp}]
        else:
            # 每个上下文块作为独立的、带标签的 system 消息
            msgs = [{"role": "system", "content": sp}] if sp else []
            msgs.extend({"role": "system", "content": c} for c in system_blocks if c)
        msgs.extend({"role": m["role"], "content": m["content"]} for m in non_system)

        if images:
            # Vision is always enabled — send images via multimodal format
            content_parts = [{"type": "text", "text": user_input}]
            for img in images:
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": img, "detail": "high"},
                })
            msgs.append({"role": "user", "content": content_parts})
        else:
            msgs.append({"role": "user", "content": user_input})
        return msgs

    @staticmethod
    def _is_system_message_error(exc: Exception) -> bool:
        msg = str(exc).lower()
        return "system message" in msg and ("beginning" in msg or "first" in msg
                                            or "at the start" in msg or "only one" in msg)

    @staticmethod
    def _merge_system_messages(msgs: List[Dict]) -> List[Dict]:
        """把全部 system 消息合并为开头的一条（保留块内标签与顺序）。"""
        sys_parts = [m.get("content", "") for m in msgs if m.get("role") == "system"]
        rest = [m for m in msgs if m.get("role") != "system"]
        if len(sys_parts) <= 1:
            return msgs
        merged = "\n\n".join(p for p in sys_parts if p)
        return [{"role": "system", "content": merged}] + rest

    def _with_system_fallback(self, msgs: List[Dict], do_create: Callable[[List[Dict]], Any]):
        """调用模型；若网关拒绝多条 system 消息则自动合并为单条后重试一次，并记住该网关特性。"""
        try:
            return do_create(msgs)
        except Exception as exc:
            if self._is_system_message_error(exc) and not self._force_single_system:
                logger.warning("网关拒绝多条 system 消息，回退为单条合并后重试：%s", exc)
                self._force_single_system = True
                return do_create(self._merge_system_messages(msgs))
            raise

    def _log_request(self, kwargs: Dict, label: str = "", base_url: Optional[str] = None, api_key: Optional[str] = None):
        """Log the full model request as a curl command."""
        url = f"{(base_url or self.config.llm_base_url).rstrip('/')}/chat/completions"
        body = json.dumps(kwargs, ensure_ascii=False, default=str)
        key = api_key or self.config.llm_api_key or ""
        lines = [
            f"[AI_REQ] {label}",
            f"curl -X POST '{url}' \\",
        ]
        if key:
            masked = key[:8] + "..." + key[-4:] if len(key) > 12 else key
            lines.append(f"  -H 'Authorization: Bearer {masked}' \\")
        lines.append(f"  -H 'Content-Type: application/json' \\")
        lines.append(f"  -d '{body}'")
        logger.info("\n".join(lines))

    def _build_kwargs(self, stream: bool = False):
        kwargs: Dict = {
            "model": self.config.llm_model,
            "temperature": self.config.llm_temperature,
            "max_tokens": self.config.llm_max_tokens,
            "top_p": self.config.llm_top_p,
            "frequency_penalty": self.config.llm_frequency_penalty,
            "presence_penalty": self.config.llm_presence_penalty,
        }
        if self.config.llm_stop:
            kwargs["stop"] = self.config.llm_stop
        if self.config.llm_seed is not None:
            kwargs["seed"] = self.config.llm_seed
        if stream:
            kwargs["stream"] = True
        return kwargs

    def _prepare_vision(self, images: Optional[List[str]]) -> tuple:
        if not images:
            return False, None
        return self._use_vl(images), images

    def _vl_chat_completion(self, msgs: List[Dict], extra: Optional[Dict]):
        def _do(_msgs: List[Dict]):
            kwargs = dict(
                model=self.config.vl_model or self.config.llm_model,
                messages=_msgs,
                max_tokens=self.config.vl_max_tokens,
                temperature=self.config.vl_temperature,
            )
            self._log_request(kwargs, "VL chat",
                              base_url=self.config.vl_base_url,
                              api_key=self.config.vl_api_key)
            return self._vl_client.chat.completions.create(**kwargs) if extra is None \
                else self._vl_client.chat.completions.create(**kwargs, extra_body=extra)
        return self._with_system_fallback(msgs, _do)

    def _chat_completion(self, msgs: List[Dict], extra: Optional[Dict],
                         max_tokens: Optional[int], temperature: Optional[float]):
        def _do(_msgs: List[Dict]):
            kwargs = self._build_kwargs(stream=False)
            kwargs["messages"] = _msgs
            if max_tokens is not None:
                kwargs["max_tokens"] = max_tokens
            if temperature is not None:
                kwargs["temperature"] = temperature
            self._log_request(kwargs, "LLM chat")
            return self.client.chat.completions.create(**kwargs) if extra is None \
                else self.client.chat.completions.create(**kwargs, extra_body=extra)
        return self._with_system_fallback(msgs, _do)

    def chat(self, sp: str, history: List[Dict], user_input: str,
             images: Optional[List[str]] = None,
             max_tokens: Optional[int] = None,
             temperature: Optional[float] = None,
             chat_template_kwargs: Optional[Dict] = None) -> Dict:
        use_vl, direct_images = self._prepare_vision(images)
        msgs = self._build_messages(sp, history, user_input, direct_images)
        extra = {"chat_template_kwargs": chat_template_kwargs} if chat_template_kwargs else None
        if use_vl:
            resp = self._vl_chat_completion(msgs, extra)
        else:
            resp = self._chat_completion(msgs, extra, max_tokens, temperature)
        content = resp.choices[0].message.content or ""
        reasoning = getattr(resp.choices[0].message, "reasoning", None) or getattr(resp.choices[0].message, "reasoning_content", None)
        content, reasoning = self._extract_thinking(content, reasoning)
        return {
            "content": content,
            "reasoning": reasoning,
            "prompt_tokens": resp.usage.prompt_tokens if resp.usage else 0,
            "completion_tokens": resp.usage.completion_tokens if resp.usage else 0,
            "total_tokens": resp.usage.total_tokens if resp.usage else 0,
            "model": self.config.vl_model if use_vl else self.config.llm_model,
            "finish_reason": resp.choices[0].finish_reason,
        }

    def chat_stream(self, sp: str, history: List[Dict], user_input: str,
                    images: Optional[List[str]] = None,
                    chat_template_kwargs: Optional[Dict] = None) -> Any:
        direct_images = None
        use_vl = False
        if images:
            if self._use_vl(images):
                use_vl = True
            direct_images = images
        msgs = self._build_messages(sp, history, user_input, direct_images)
        extra = {"chat_template_kwargs": chat_template_kwargs} if chat_template_kwargs else None
        if use_vl:
            def _do_vl(_msgs: List[Dict]):
                kwargs = dict(
                    model=self.config.vl_model or self.config.llm_model,
                    messages=_msgs,
                    max_tokens=self.config.vl_max_tokens,
                    temperature=self.config.vl_temperature,
                    stream=True,
                )
                self._log_request(kwargs, "VL stream",
                                  base_url=self.config.vl_base_url,
                                  api_key=self.config.vl_api_key)
                return self._vl_client.chat.completions.create(**kwargs) if extra is None \
                    else self._vl_client.chat.completions.create(**kwargs, extra_body=extra)
            return self._with_system_fallback(msgs, _do_vl)
        else:
            def _do_stream(_msgs: List[Dict]):
                kwargs = self._build_kwargs(stream=True)
                kwargs["messages"] = _msgs
                self._log_request(kwargs, "LLM stream")
                return self.client.chat.completions.create(**kwargs) if extra is None \
                    else self.client.chat.completions.create(**kwargs, extra_body=extra)
            return self._with_system_fallback(msgs, _do_stream)

    @staticmethod
    def _strip_thinking_tag(clean: str, parts: str, tag: str, close: str) -> tuple:
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
        return clean, parts

    def _extract_thinking(self, content: str, reasoning: Optional[str] = None) -> tuple:
        """从正文中提取内联思考块（<thinking>...</thinking> 等），返回 (干净正文, 合并后的思考内容)。"""
        clean = content
        parts = reasoning or ""
        for tag, close in [("<thinking>", "</thinking>"), ("<reasoning>", "</reasoning>"),
                           ("[thinking]", "[/thinking]"), ("[reasoning]", "[/reasoning]"),
                           ("[think]", "[/think]")]:
            clean, parts = self._strip_thinking_tag(clean, parts, tag, close)
        return clean, (parts or None)

    def get_models(self) -> List[str]:
        try:
            return [m.id for m in self.client.models.list()]
        except Exception as e:
            logger.exception("获取模型列表失败")
            return []


# ═══════════════════════════════════════════════════════════════
#  6. 引擎编排（参考 Dify / FastGPT Pipeline 设计）
# ═══════════════════════════════════════════════════════════════
class ChatGPT:
    """串联 SessionManager + MemoryManager + TokenTracker + AIClient + KnowledgeEngine"""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.sessions = SessionManager(self.config)
        self.memory = MemoryManager(self.config)
        self.tokens = TokenTracker(self.config)
        self.client = AIClient(self.config)
        self.sessions.create()  # 默认会话
        self._pending_leads: Dict[str, str] = {}  # session_id -> mode
        self._memory_pending: Dict[tuple, tuple] = {}  # (role, username) -> latest (user_input, assistant)
        self._memory_running: set = set()  # (role, username) keys with an active worker
        self._memory_worker_lock = threading.Lock()

        # RAG 配置（持久化于 system_configs 表，重启后仍生效；可通过 API 动态调整）
        # 默认关闭知识库：仅当后台「知识库管理」页开关打开时（rag_enabled=true）才使用
        self.rag_enabled = False
        self.rag_kb_ids: List[int] = []
        self.rag_top_k = 6
        self.rag_threshold = 0.5
        self.rag_max_threshold = 1.0
        self.rag_reranker_enabled = self.config.reranker_enabled
        self.rag_reranker_model = self.config.reranker_model
        self._ke = None
        # 用数据库已保存的 RAG 配置覆盖默认值
        self.load_rag_config_from_db()

        # 启动时后台把历史（含中文）记忆规范化成精简英文
        if self.config.memory_long_term_enabled:
            threading.Thread(target=self._normalize_all_memories, daemon=True).start()

    @property
    def ke(self):
        if self._ke is None:
            from knowledge import KnowledgeEngine
            self._ke = KnowledgeEngine(self.config)
        return self._ke

    # ── 会话操作 ────────────────────────────────────────────
    def current_session(self) -> Optional[Session]:
        return self.sessions.current()

    def new_session(self, title: str = "") -> Session:
        s = self.sessions.create()
        if title:
            s.title = title
        return s

    def switch_session(self, sid: str) -> bool:
        return self.sessions.switch(sid) is not None

    def list_sessions(self) -> List[Dict]:
        return self.sessions.list_all()

    def delete_session(self, sid: str):
        self.sessions.delete(sid)

    def show_history(self, sid: Optional[str] = None, limit: Optional[int] = None) -> List[Dict]:
        return self.sessions.get_history(sid or (self.current_session().session_id if self.current_session() else ""), limit)

    # ── Token 统计 ─────────────────────────────────────────
    def token_stats(self, sid: Optional[str] = None) -> Dict:
        return self.tokens.get_session_stats(sid) if sid else self.tokens.get_total_stats()

    def token_logs(self) -> List[Dict]:
        return self.tokens.get_all_logs()

    # ── 记忆 ───────────────────────────────────────────────
    def search_memory(self, username: str, keyword: str, role: str = "", top_k: Optional[int] = None) -> List[Dict]:
        return self.memory.search(username, keyword, role)

    def clear_memory(self):
        self.memory.clear_short()
        self.memory.clear_long()

    def list_memory_files(self) -> List[Dict]:
        return self.memory.list_files()

    def read_memory_file(self, username: str, role: str = "") -> str:
        return self.memory.read_file(username, role)

    def write_memory_file(self, username: str, content: str, role: str = ""):
        self.memory.write_file(username, content, role)

    def init_user_memory(self, username: str, role: str = ""):
        self.memory.init_user(username, role)

    # ── 模型 ───────────────────────────────────────────────
    def get_models(self) -> List[str]:
        return self.client.get_models()

    # ── Prompt 配置（数据库）───────────────────────────────
    def _load_prompt_config(self) -> Dict:
        """system_prompt、suggestions、banned_words 均从数据库加载。

        system_prompt 以 ai_prompt_config(type='system_prompt') 为唯一持久化来源；
        仅当库中无记录时回退到环境变量，用于历史 .env 数据的兼容迁移。
        """
        sys_prompt = ""
        suggestions = []
        banned_words = []
        banned_threshold = 0.82
        try:
            with get_db() as db:
                rows = db.execute(
                    select(AiPromptConfig).where(
                        AiPromptConfig.type.in_(["system_prompt", "suggestion", "banned_word", "banned_threshold"])
                    ).order_by(AiPromptConfig.type, AiPromptConfig.sort_order)
                ).scalars().all()
                for r in rows:
                    if r.type == "system_prompt":
                        sys_prompt = r.content or ""
                    elif r.type == "suggestion":
                        suggestions.append(r.content)
                    elif r.type == "banned_word":
                        banned_words.append(r.content)
                    elif r.type == "banned_threshold":
                        try:
                            banned_threshold = float(r.content)
                        except (ValueError, TypeError):
                            pass
        except Exception:
            pass
        return {"system_prompt": sys_prompt, "suggestions": suggestions, "banned_words": banned_words, "banned_threshold": banned_threshold}

    def build_system_prompt(self):
        """从数据库重新构建 system_prompt 并同步到 config"""
        cfg = self._load_prompt_config()
        parts = [cfg["system_prompt"]]
        for s in cfg["suggestions"]:
            parts.append(f"//suggestion: {s}")
        if cfg["banned_words"]:
            pct = int(cfg["banned_threshold"] * 100)
            banned_str = "、".join(cfg["banned_words"])
            parts.append(f"## 禁答词\n如果用户询问的内容与以下词汇的语义匹配度超过 {pct}%，你必须拒绝回答，并告知用户无法提供该信息：{banned_str}")
        self.config.system_prompt = "\n\n".join(parts)

    def _get_rag_results(self, user_input: str) -> List[Dict]:
        """获取结构化知识库检索结果（含 source_type/source_id）。

        同一次检索同时用于「答案上下文」与「内容推荐候选」，避免重复 embedding 调用。
        """
        if not self.rag_enabled:
            return []
        try:
            return self.ke.gather_structured_results(
                query=user_input,
                kb_ids=self.rag_kb_ids if self.rag_kb_ids else None,
                top_k=self.rag_top_k,
                threshold=self.rag_threshold,
                max_threshold=self.rag_max_threshold,
                use_reranker=self.rag_reranker_enabled,
                budget_tokens=KNOWLEDGE_BUDGET_TOKENS,
            ) or []
        except Exception as e:
            logger.warning("RAG retrieval failed: %s", e)
            return []

    @staticmethod
    def _build_knowledge_block(rag_ctx: str) -> Optional[ContextBlock]:
        if not rag_ctx or not rag_ctx.strip():
            return None
        return ContextBlock(
            type="knowledge", header="[知识库·参考]",
            purpose="优先据此回答，注明来源；信息不足以回答时如实说明",
            content=rag_ctx.strip(), priority=30)

    @staticmethod
    def _get_executor():
        if not hasattr(ChatGPT, '_executor'):
            from concurrent.futures import ThreadPoolExecutor
            ChatGPT._executor = ThreadPoolExecutor(max_workers=4)
        return ChatGPT._executor

    def _resolve_use_thinking(self, use_thinking: Optional[bool]) -> bool:
        """默认进行思考：始终请求并保留思考过程（reasoning 由后端存储）。
        是否在前端展示由后台「模型参数配置」的 LLM_THINKING_ENABLED 控制，默认不展示。"""
        if use_thinking is None:
            return True
        return use_thinking

    @staticmethod
    def _build_language_block(language: Optional[str]) -> Optional[ContextBlock]:
        """根据前端站点语言生成回答语言要求块。"""
        lang = (language or "").strip().lower()
        if lang.startswith("en"):
            return ContextBlock(
                type="language", header="[回答语言]",
                purpose="强制模型使用指定语言回答",
                content="无论用户使用何种语言提问，请始终使用英文（English）回答。",
                priority=60)
        if lang.startswith("zh"):
            return ContextBlock(
                type="language", header="[回答语言]",
                purpose="强制模型使用指定语言回答",
                content="无论用户使用何种语言提问，请始终使用简体中文回答。",
                priority=60)
        return None

    def _resolve_session(self, session_id: Optional[str]) -> Session:
        if session_id:
            session = self.sessions.switch(session_id)
        else:
            session = self.current_session()
        if not session:
            session = self.sessions.create()
        return session

    def _run_intent_tasks(self, user_input: str, use_knowledge: Optional[bool]) -> tuple:
        from intent_recognizer import get_intent_recognizer
        from forbidden_detector import get_detector

        irec = get_intent_recognizer()
        irec.configure(self.config)

        pool = self._get_executor()
        # 知识库是否启用：主页未显式传 use_knowledge 时以后台「知识库管理」开关（rag_enabled）为准。
        # 关闭知识库时不再做官网内容目录（SEO/GEO）的 embedding 匹配与 rerank，避免“带出知识库内容”。
        kb_enabled = (use_knowledge is not False) and self.rag_enabled

        futures = {
            "forbidden": pool.submit(get_detector().detect, user_input),
        }
        if kb_enabled:
            # 一次检索：既作为答案上下文，也作为内容推荐的来源
            rag_results = pool.submit(self._get_rag_results, user_input).result()
            rag_ctx = self.ke._format_rag_context(rag_results) if rag_results else ""
            recommendations = irec.recognize(user_input, rag_results or None) or {}
        else:
            # 知识库关闭：仅做线索意图检测（预约/咨询等），不触发内容目录 rerank
            rag_ctx = ""
            recommendations = irec.detect_lead_intent(user_input) or {}
        forbidden = futures["forbidden"].result()
        return irec, rag_ctx, recommendations, forbidden

    @staticmethod
    def _build_catalog_block(irec, recommendations: Dict) -> Optional[ContextBlock]:
        if recommendations.get("intent") != "view_content":
            return None
        matches = recommendations.get("items") or recommendations.get("matches") or []
        catalog_ctx = irec.format_catalog_context(matches=matches if matches else None)
        if not catalog_ctx or not catalog_ctx.strip():
            return None
        return ContextBlock(
            type="catalog", header="[内容目录]",
            purpose="仅在用户想查看/打开内容时，据此生成可点击跳转链接",
            content=catalog_ctx.strip(), priority=40)

    def _build_lead_block(self, irec, recommendations: Dict, username: Optional[str],
                          session: Session, sid: str, user_input: str) -> Optional[ContextBlock]:
        if recommendations.get("action") == "showForm":
            mode = recommendations.get("actionData", {}).get("mode", "demo")
            has_user = bool(username) or bool(session and session.username)
            lead_ctx = irec.format_lead_context(mode, has_user_info=has_user)
            if has_user:
                self._pending_leads[sid] = mode
                recommendations.pop("action", None)
                recommendations.pop("actionData", None)
            if lead_ctx and lead_ctx.strip():
                return ContextBlock(
                    type="lead", header="[用户意图·线索]",
                    purpose="引导用户完成预约/咨询表单",
                    content=lead_ctx.strip(), priority=50)
        elif sid in self._pending_leads:
            recommendations["action"] = "showForm"
            recommendations["actionData"] = {
                "mode": self._pending_leads.pop(sid),
                "requirement": user_input,
            }
        return None

    @staticmethod
    def _render_context_blocks(blocks: List[ContextBlock]) -> List[Dict]:
        """把上下文块渲染为独立、带标签的 system 消息。"""
        return [{"role": "system", "content": b.render()} for b in blocks if b.content or b.header]

    @staticmethod
    def _compose_system_prompt(configured_prompt: str) -> str:
        """给配置的系统提示词加上来源标记；为空则返回空串（不产生系统提示词）。"""
        text = (configured_prompt or "").strip()
        return f"[系统提示词]\n{text}" if text else ""

    def _handle_forbidden(self, forbidden: Optional[Dict], on_chunk: Optional[Callable],
                          session: Session, user_input: str, images, attachments, original_input,
                          recommendations: Dict) -> Optional[Dict]:
        if not (forbidden and forbidden.get("blocked")):
            return None
        refusal = forbidden.get("answer") or "抱歉，这部分属于系统内部信息，我无法提供。如有业务相关问题，我很乐意继续帮助您。"
        if on_chunk:
            on_chunk(refusal)
        result = {"content": refusal, "reasoning": None,
                  "prompt_tokens": 0, "completion_tokens": 0,
                  "total_tokens": 0, "model": self.config.llm_model,
                  "finish_reason": "banned",
                  "recommendations": recommendations}
        session.messages.append({"role": "user", "content": user_input, "attachments": attachments, "images": images, "display_content": original_input})
        session.messages.append({"role": "assistant", "content": refusal, "reasoning": None})
        session.updated_at = time.time()
        self.sessions.save(session)
        return result

    def _save_exchange(self, session: Session, user_input: str, attachments, images, original_input, result: Dict):
        session.messages.append({"role": "user", "content": user_input, "attachments": attachments, "images": images, "display_content": original_input})
        session.messages.append({"role": "assistant", "content": result["content"], "reasoning": result.get("reasoning")})
        session.updated_at = time.time()
        self.sessions.save(session)

    def _save_error_exchange(self, session: Session, user_input: str, attachments, images,
                             original_input, code: str, detail: str):
        """把失败的一问一答写入会话，保证后台「对话记录」能看到失败原因。"""
        if session is None:
            return
        try:
            session.messages.append({"role": "user", "content": user_input, "attachments": attachments,
                                     "images": images, "display_content": original_input})
            session.messages.append({
                "role": "assistant",
                "content": ERROR_MESSAGES.get(code, ERROR_MESSAGES["unknown"]),
                "reasoning": None,
                "error": {"code": code, "detail": (detail or "")[:1000]},
            })
            session.updated_at = time.time()
            self.sessions.save(session)
        except Exception as exc:
            logger.warning("save error exchange failed (session=%s): %s",
                           getattr(session, "session_id", ""), exc)

    @staticmethod
    def _block_tokens(block: ContextBlock) -> int:
        return count_tokens(block.render())

    def _apply_injection_budget(self, sp: str, blocks: List[ContextBlock]) -> tuple:
        """把「系统提示词 + 记忆 + 知识库」控制在 INJECTION_BUDGET_TOKENS 内。

        超限时按优先级裁剪：先知识库、后记忆；系统提示词（最高优先级）不截断。
        """
        sys_tokens = count_tokens(sp)

        def total(bs: List[ContextBlock]) -> int:
            return sys_tokens + sum(self._block_tokens(b) for b in bs)

        if total(blocks) <= INJECTION_BUDGET_TOKENS:
            return sp, blocks

        for b in blocks:
            if b.type == "knowledge":
                b.content = trim_to_tokens(b.content, KNOWLEDGE_BUDGET_TOKENS, mode="head")
        blocks = [b for b in blocks if not (b.type == "knowledge" and not b.content)]
        if total(blocks) > INJECTION_BUDGET_TOKENS:
            blocks = [b for b in blocks if b.type != "knowledge"]

        if total(blocks) > INJECTION_BUDGET_TOKENS:
            for b in blocks:
                if b.type == "memory":
                    b.content = trim_to_tokens(b.content, MEMORY_BUDGET_TOKENS, mode="head")
            blocks = [b for b in blocks if not (b.type == "memory" and not b.content)]
            if total(blocks) > INJECTION_BUDGET_TOKENS:
                blocks = [b for b in blocks if b.type != "memory"]

        if total(blocks) > INJECTION_BUDGET_TOKENS:
            logger.warning(
                "context injection still over budget after trimming "
                "(%d > %d tokens; system prompt alone is %d)",
                total(blocks), INJECTION_BUDGET_TOKENS, sys_tokens)
        return sp, blocks

    @staticmethod
    def _message_tokens(m: Dict) -> int:
        c = m.get("content") if isinstance(m, dict) else ""
        return count_tokens(c if isinstance(c, str) else str(c or ""))

    @staticmethod
    def _bounded_history(messages: List[Dict],
                         max_messages: int = 20,
                         budget: int = HISTORY_BUDGET_TOKENS) -> List[Dict]:
        """取最近的对话历史，token 总量不超过预算（倒序累加后还原时序）。"""
        if not messages:
            return []
        kept: List[Dict] = []
        total = 0
        for m in reversed(messages[-max_messages:]):
            t = ChatGPT._message_tokens(m)
            if kept and total + t > budget:
                break
            kept.append(m)
            total += t
        kept.reverse()
        return kept

    @staticmethod
    def _log_context_tokens(sp: str, blocks: List[ContextBlock],
                            history: List[Dict], user_input: str) -> None:
        parts = {"system_prompt": count_tokens(sp)}
        for b in blocks:
            parts[b.type] = parts.get(b.type, 0) + count_tokens(b.render())
        parts["history"] = sum(ChatGPT._message_tokens(m) for m in history)
        parts["user_input"] = count_tokens(user_input or "")
        logger.debug("context tokens total=%d breakdown=%s", sum(parts.values()), parts)

    def chat(self, user_input: str, images: Optional[List[str]] = None,
             attachments: Optional[List[Dict]] = None,
             system_prompt: Optional[str] = None, stream: Optional[bool] = None,
             on_chunk: Optional[Callable[[str], None]] = None,
             on_reasoning: Optional[Callable[[str], None]] = None,
             username: Optional[str] = None,
             session_id: Optional[str] = None,
             original_input: Optional[str] = None,
             use_knowledge: Optional[bool] = None,
             use_thinking: Optional[bool] = None,
             language: Optional[str] = None,
             stop_event: Optional["threading.Event"] = None) -> Dict:
        session = self._resolve_session(session_id)
        sp = system_prompt or session.system_prompt or self.config.system_prompt

        try:
            result = self._chat_once(session, sp, user_input, images, attachments, original_input,
                                     username, use_knowledge, use_thinking, language,
                                     on_chunk, on_reasoning, stop_event)
        except ChatError as ce:
            self._save_error_exchange(session, user_input, attachments, images, original_input, ce.code, ce.detail)
            raise
        except Exception as exc:
            code = classify_chat_error(exc)
            detail = f"{type(exc).__name__}: {exc}"
            logger.exception("AI chat failed (session=%s, code=%s)", session.session_id, code)
            self._save_error_exchange(session, user_input, attachments, images, original_input, code, detail)
            raise ChatError(code, detail) from exc

        # 违禁拦截已由 _handle_forbidden 落库，此处不再重复写入记忆
        if result.get("finish_reason") != "banned":
            self.memory.add("user", user_input, session.session_id, session.username, session.role)
            self.memory.add("assistant", result["content"], session.session_id, session.username, session.role)
            # 每次对话结束后整合长期记忆（后台执行，不阻塞响应）
            self._schedule_memory_consolidation(session, user_input, result.get("content", ""))

        return result

    def _chat_once(self, session: Session, sp: str, user_input: str, images, attachments,
                   original_input, username, use_knowledge, use_thinking, language,
                   on_chunk, on_reasoning, stop_event) -> Dict:
        # ── 并行执行 RAG, 意图识别, 违禁检测 ──
        irec, rag_ctx, recommendations, forbidden = self._run_intent_tasks(user_input, use_knowledge)

        sid = session.session_id if session else ""

        # 角色兜底：前端未提供 role 时按用户身份查库解析，确保记忆落到正确角色目录
        if session and session.username and not session.role:
            session.role = _resolve_role_from_db(session.username)

        forbidden_result = self._handle_forbidden(forbidden, on_chunk, session, user_input, images, attachments, original_input, recommendations)
        if forbidden_result is not None:
            return forbidden_result

        # ── 收集结构化上下文块（记忆/知识库/目录/线索/语言），统一渲染 ──
        # 首轮：配置提示词 + 记忆 + 知识库（若开启全局 RAG）；后续轮：配置提示词 + 知识库，
        # 记忆不再重复注入（依赖历史上下文），知识库仍按当轮问题检索。
        is_first_turn = not session.messages
        blocks: List[ContextBlock] = []
        if is_first_turn:
            blocks.extend(self.memory.build_memory_blocks(
                session.username or "", role=session.role or "", query=user_input,
                session_messages=session.messages))
        for blk in (self._build_knowledge_block(rag_ctx),
                    self._build_catalog_block(irec, recommendations),
                    self._build_lead_block(irec, recommendations, username, session, sid, user_input),
                    self._build_language_block(language)):
            if blk:
                blocks.append(blk)
        blocks.sort(key=lambda b: b.priority)

        # 默认进行思考（保留思考过程）；是否在前端展示由后台「模型参数配置」LLM_THINKING_ENABLED 控制
        use_thinking = self._resolve_use_thinking(use_thinking)
        # 给配置提示词加上来源标记；为空则不产生系统提示词
        sp = self._compose_system_prompt(sp)
        if use_thinking is False:
            disabled = ("## 思考过程已关闭\n"
                        "本次回答请直接给出最终答案，不要输出任何思考、推理或过程性的内容"
                        "（不要输出 <thinking>、<reasoning> 等思考块）。")
            sp = f"{sp}\n\n{disabled}" if sp else disabled
        # 按 token 预算裁剪注入内容（先知识、后记忆；系统提示词不截断），历史单独预算
        sp, blocks = self._apply_injection_budget(sp, blocks)
        history = self._bounded_history(session.messages)
        ctx = self._render_context_blocks(blocks) + history
        self._log_context_tokens(sp, blocks, history, user_input)
        result = self._do_stream(session, sp, ctx, user_input, images, on_chunk, on_reasoning, stop_event, use_thinking=use_thinking)

        # 空回复（非用户主动停止）视为异常，便于前端给出针对性提示并留痕
        if not (result.get("content") or "").strip() and result.get("finish_reason") != "stopped":
            raise ChatError("empty", f"模型返回空内容 (model={result.get('model', '')})")

        result["recommendations"] = recommendations
        self._save_exchange(session, user_input, attachments, images, original_input, result)
        return result

    @staticmethod
    def _should_stop(stop_event: Optional["threading.Event"]) -> bool:
        return stop_event is not None and stop_event.is_set()

    @staticmethod
    def _handle_reasoning_chunk(rd: str, full: str, thinking: Optional[str], use_thinking: bool,
                                on_chunk: Optional[Callable], on_reasoning: Optional[Callable]) -> tuple:
        if use_thinking is False:
            # 思考已关闭时，若模型/网关未真正禁用思考，可能把全部输出放入
            # reasoning_content 而正文为空。此时将思考内容当作正文逐块流式
            # 输出（保留打字机效果），同时避免最终空白响应。
            full += rd
            if on_chunk:
                on_chunk(rd)
            return full, thinking
        thinking = (thinking or "") + rd
        if on_reasoning:
            on_reasoning(rd)
        return full, thinking

    @staticmethod
    def _apply_chunk(chunk, state: Dict, use_thinking: bool,
                     on_chunk: Optional[Callable], on_reasoning: Optional[Callable]):
        if chunk.usage:
            state["pt"] = chunk.usage.prompt_tokens or 0
            state["ct"] = chunk.usage.completion_tokens or 0
        if not chunk.choices:
            return
        delta = chunk.choices[0].delta
        rd = getattr(delta, "reasoning", None) or getattr(delta, "reasoning_content", None)
        if rd:
            state["full"], state["thinking"] = ChatGPT._handle_reasoning_chunk(
                rd, state["full"], state["thinking"], use_thinking, on_chunk, on_reasoning)
            return
        cd = delta.content or ""
        if cd:
            state["full"] += cd
            if on_chunk:
                on_chunk(cd)

    def _consume_stream(self, stream, use_thinking: bool,
                        on_chunk: Optional[Callable], on_reasoning: Optional[Callable],
                        stop_event: Optional["threading.Event"]) -> tuple:
        state = {"full": "", "thinking": None, "pt": 0, "ct": 0}
        for chunk in stream:
            if self._should_stop(stop_event):
                return state["full"], state["thinking"], state["pt"], state["ct"], True
            self._apply_chunk(chunk, state, use_thinking, on_chunk, on_reasoning)
        return state["full"], state["thinking"], state["pt"], state["ct"], False

    def _do_stream(self, session: Session, sp: str, ctx: List[Dict],
                   user_input: str, images: Optional[List[str]],
                   on_chunk: Optional[Callable[[str], None]] = None,
                   on_reasoning: Optional[Callable[[str], None]] = None,
                   stop_event: Optional["threading.Event"] = None,
                   use_thinking: Optional[bool] = True) -> Dict:
        model = self.config.llm_model
        stream = self.client.chat_stream(
            sp, ctx, user_input, images,
            chat_template_kwargs={"enable_thinking": False} if use_thinking is False else None,
        )
        full, thinking, pt, ct, stopped = self._consume_stream(stream, use_thinking, on_chunk, on_reasoning, stop_event)

        if use_thinking is False:
            # 思考已关闭：正文（含回退的推理内容）即最终答案，不再做思考块二次抽取/丢弃
            thinking = None
        else:
            full, thinking = self.client._extract_thinking(full, thinking)

        self.tokens.record(session.session_id, pt, ct, model)
        return {"content": full, "reasoning": thinking,
                "prompt_tokens": pt, "completion_tokens": ct,
                "total_tokens": pt + ct, "model": model,
                "finish_reason": "stopped" if stopped else "stop"}

    # ── 长期记忆整合（每次对话结束后，后台重写单文件）──────────
    def _schedule_memory_consolidation(self, session: Session, user_input: str, assistant_response: str):
        """每次对话结束后触发一次记忆整合；后台线程执行，不阻塞响应。"""
        if not (self.config.memory_long_term_enabled and session and session.username):
            return
        role = session.role or _resolve_role_from_db(session.username) or "_"
        self._enqueue_consolidation(role, session.username, user_input, assistant_response)

    def _enqueue_consolidation(self, role: str, username: str, user_input: str, assistant_response: str):
        """把一次整合任务放入按用户串行的后台队列（同一用户新任务合并为最新一次）。"""
        key = (role or "_", username)
        with self._memory_worker_lock:
            self._memory_pending[key] = (user_input or "", assistant_response or "")
            if key in self._memory_running:
                return
            self._memory_running.add(key)
        threading.Thread(target=self._memory_worker_loop, args=(key,), daemon=True).start()

    def _normalize_all_memories(self):
        """启动时修正错放角色目录的记忆，并把含非英文内容的文件规范化（翻译为精简英文）。"""
        try:
            moved = self.memory.relocate_orphan_memories(_resolve_role_from_db)
            if moved:
                logger.info("relocated %d orphan memory dir(s)", moved)
        except Exception as exc:
            logger.warning("relocate orphan memories failed: %s", exc)
        try:
            users = self.memory.list_users()
        except Exception as exc:
            logger.warning("list memory users failed: %s", exc)
            return
        for info in users:
            try:
                content = self.memory.read_file(info["username"], info["role"])
                if content and any(ord(ch) > 127 for ch in content):
                    self._enqueue_consolidation(info["role"], info["username"], "", "")
            except Exception as exc:
                logger.warning("memory normalize schedule failed for %s/%s: %s",
                               info.get("role"), info.get("username"), exc)

    def _memory_worker_loop(self, key: tuple):
        """按用户串行整合；同一用户有新对话时合并为最新一次再执行。"""
        role, username = key
        while True:
            with self._memory_worker_lock:
                pending = self._memory_pending.pop(key, None)
                if pending is None:
                    self._memory_running.discard(key)
                    return
            user_input, assistant_response = pending
            try:
                self._consolidate_memory_once(username, role, user_input, assistant_response)
            except Exception as exc:
                logger.warning("memory consolidation failed for %s/%s: %s", role, username, exc)

    def _consolidate_memory_once(self, username: str, role: str,
                                 user_input: str, assistant_response: str):
        current = self.memory.read_file(username, role)
        if not current.strip():
            current = self.memory._new_file(username, role)
        new_content = self._llm_consolidate(username, role, current, user_input, assistant_response)
        if new_content and new_content.strip():
            self.memory.write_file(username, new_content, role)

    def _llm_consolidate(self, username: str, role: str, current: str,
                         user_input: str = "", assistant_response: str = "") -> Optional[str]:
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        has_new = bool((user_input or "").strip() or (assistant_response or "").strip())
        context = [f"## Existing Memory File\n\n{current}"]
        if has_new:
            context.append(
                "## New Conversation\n\n"
                f"User: {user_input[:1500]}\nAssistant: {assistant_response[:1500]}")
        prompt = "\n\n".join(context)
        resp = self.client.chat(
            sp=MEMORY_EXTRACTION_PROMPT,
            history=[],
            user_input=prompt,
        )
        content = ((resp or {}).get("content") or "").strip()
        if content.startswith("```"):
            content = re.sub(r'^```[a-zA-Z]*\s*', '', content)
            content = re.sub(r'\s*```$', '', content).strip()
        if not content:
            return None
        if not self.memory._is_new_format(content):
            content = f"# Memory\n\n> updated: {now}\n\n" + content
        return content

    # ── 配置热更新 ──────────────────────────────────────────
    def update_config(self, **kwargs):
        for k, v in kwargs.items():
            if hasattr(self.config, k):
                setattr(self.config, k, v)
        self.client = AIClient(self.config)
        self._ke = None  # recreate knowledge engine with new config on next access

    def reload_model_config_from_db(self):
        """从 system_configs 表重载模型配置并重建客户端（管理后台保存后热更新）。"""
        self.config.load_model_config_from_db(force=True)
        self.client = AIClient(self.config)
        self._ke = None

    def load_rag_config_from_db(self):
        """从 system_configs 表读取 RAG 配置并覆盖默认值；缺失/异常时保留默认。"""
        db_vals = _db_rag_config_values()
        if not db_vals:
            return
        for attr, key in DB_RAG_KEY_MAP.items():
            raw = db_vals.get(key)
            if raw is None:
                continue
            try:
                setattr(self, attr, _coerce_rag_value(attr, raw))
            except (ValueError, TypeError):
                continue


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("PYTHON_HOST", "127.0.0.1")
    port = int(os.getenv("PYTHON_PORT", "8000"))
    uvicorn.run("api:app", host=host, port=port, reload=True)
