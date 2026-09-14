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
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable
from sqlalchemy import select, func, delete as sa_delete, update as sa_update

from db import get_db, get_redis, cache_active_session, cache_short_term, clear_short_term_cache
from models import AiSession, AiMessage, AiTokenUsage, AiPromptConfig

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

MEMORY_MD = "MEMORY.md"


def _warmup_threshold(level: int, max_interval: int) -> int:
    """记忆提取 warmup 阈值：1→2→4→8→… 翻倍，封顶 max_interval（参考 TencentDB pipeline.enableWarmup）。"""
    return min(2 ** level, max_interval)

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
        # 媒体根目录直接复用 UPLOAD_PATH；对话附件存于其 temp 子目录，代码中按需组合 UPLOAD_PATH + "/temp"
        self.upload_path = _str("UPLOAD_PATH", "uploads")
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
        self.memory_dedup_threshold = _float("MEMORY_DEDUP_THRESHOLD", 0.90)
        self.memory_recall_top_k = _int("MEMORY_RECALL_TOP_K", 8)
        self.memory_extract_max_interval = _int("MEMORY_EXTRACT_MAX_INTERVAL", 16)
        self.memory_warmup_enabled = True
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
    """读取敏感配置 AES 落盘密钥（与后端 CONFIG_CRYPTO_AES_KEY 一致）。

    兼容 Base64(16/24/32 字节) 与普通字符串两种写法；普通字符串经 SHA-256 派生。
    """
    raw = os.getenv("CONFIG_CRYPTO_AES_KEY", "").strip()
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
        raise RuntimeError("检测到加密敏感配置(enc:v1:)，但缺少 CONFIG_CRYPTO_AES_KEY 环境变量")
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
    """短期记忆（内存缓存）+ 长期记忆（每个用户一个 memories/{role}/{username}/MEMORY.md 文件）"""

    MEMORY_DIR = Path(__file__).parent / "memories"
    MEMORY_FILE_TYPES = ["profile", "preferences", "knowledge", "conversation", "decisions", "timeline"]
    MEMORY_FILE_NAMES = {
        "profile": "profile.md",
        "preferences": "preferences.md",
        "knowledge": "knowledge.md",
        "conversation": "conversation.md",
        "decisions": "decisions.md",
        "timeline": "timeline.md",
    }
    INDEX_VERSION = 1
    INDEX_FILENAME = ".index.json"
    _ENTRY_RE = re.compile(r'^-\s*\[([^\]]+)\]\s*(.*)')

    def __init__(self, config: Config):
        self.config = config
        self.short_term: List[Dict] = []
        app_memories = Path("/app/memories")
        if app_memories.is_dir():
            self.MEMORY_DIR = app_memories
        else:
            self.MEMORY_DIR = Path(__file__).parent / "memories"
        self.MEMORY_DIR.mkdir(exist_ok=True)
        self._embedder_obj = None
        self._index_lock = threading.Lock()
        self._index_cache: Dict[tuple, tuple] = {}  # (role, uname) -> (file_state, entries)

    def _user_files(self) -> Dict[str, str]:
        """file_type → filename, 含 legacy MEMORY.md（兼容老数据）。"""
        files = dict(self.MEMORY_FILE_NAMES)
        files["legacy"] = MEMORY_MD
        return files

    @staticmethod
    def _sanitize(name: str) -> str:
        safe = re.sub(r'[\\/:*?"<>|]', '_', str(name))
        return safe or "anonymous"

    def _safe_memory_filename(self, filename: str) -> str:
        """记忆文件名白名单校验：仅允许预定义的记忆文件名，杜绝 ../ 等路径穿越。"""
        base = os.path.basename(str(filename or "").replace("\\", "/")).strip()
        allowed = set(self.MEMORY_FILE_NAMES.values()) | {MEMORY_MD}
        if base not in allowed:
            raise ValueError(f"invalid memory filename: {filename!r}")
        return base

    def _memory_path(self, username: str, role: str = "", filename: str = MEMORY_MD) -> Path:
        role, uname = self._parse_user(username, role)
        role_dir = self._sanitize(role) if role else "_"
        safe_name = self._safe_memory_filename(filename)
        path = self.MEMORY_DIR / role_dir / self._sanitize(uname) / safe_name
        # 二次兜底：resolve 后必须仍位于 MEMORY_DIR 内
        try:
            resolved = path.resolve()
            root = self.MEMORY_DIR.resolve()
            if resolved != root and root not in resolved.parents:
                raise ValueError(f"memory path escapes root: {filename!r}")
        except (OSError, ValueError) as e:
            raise ValueError(f"invalid memory path: {filename!r}") from e
        return path

    def _list_user_paths(self) -> List[Dict]:
        """Return [{role, username, path}] for all user dirs under role dirs."""
        results = []
        for role_dir in sorted(self.MEMORY_DIR.iterdir()):
            if not role_dir.is_dir():
                continue
            role_name = role_dir.name
            for user_dir in sorted(role_dir.iterdir()):
                if user_dir.is_dir() and any((user_dir / fn).exists() for fn in self.MEMORY_FILE_NAMES.values()):
                    results.append({
                        "role": role_name,
                        "username": user_dir.name,
                        "path": user_dir,
                    })
        return results

    def _read_memory(self, username: str, role: str = "") -> List[Dict]:
        role, uname = self._parse_user(username, role)
        path = self._memory_path(uname, role)
        if not path.exists():
            return []
        entries = []
        for line in path.read_text("utf-8").splitlines():
            line = line.strip()
            if not line.startswith("- [") or "**" not in line:
                continue
            m = re.match(r'^- \[(.*?)\]\s+\*\*(.*?)\*\*:\s*(.*)', line)
            if m:
                try:
                    ts = datetime.fromisoformat(m.group(1)).timestamp()
                except ValueError:
                    ts = 0
                entries.append({
                    "type": "summary",
                    "content": f"[{m.group(2)}]: {m.group(3)}",
                    "timestamp": ts,
                    "username": uname,
                    "role": role,
                })
        return entries

    def _read_all_memories(self) -> List[Dict]:
        entries = []
        for info in self._list_user_paths():
            entries.extend(self._read_memory(info["username"], info["role"]))
        entries.sort(key=lambda e: e.get("timestamp", 0), reverse=True)
        return entries

    def _parse_user(self, username: str, role: str = "") -> tuple:
        """Split 'role/username' format or return (role, username) as given."""
        if not role and "/" in username:
            parts = username.split("/", 1)
            return parts[0], parts[1]
        return role, username

    def _ensure_user_dir(self, username: str, role: str = "") -> Path:
        role, uname = self._parse_user(username, role)
        role_dir = self.MEMORY_DIR / (self._sanitize(role) if role else "_")
        user_dir = role_dir / self._sanitize(uname)
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    def _append_memory(self, username: str, role_type: str, content: str, timestamp: float, user_role: str = ""):
        path = self._memory_path(username, user_role)
        self._ensure_user_dir(username, user_role)
        ts_str = datetime.fromtimestamp(timestamp).isoformat()
        display = content[:200].replace("\n", " ").replace("\r", "")
        line = f"- [{ts_str}] **{role_type}**: {display}\n"
        if path.exists():
            with path.open("a", encoding="utf-8") as f:
                f.write(line)
        else:
            header = f"# {username} 的记忆\n> 自动生成的长期记忆文件\n\n"
            with path.open("w", encoding="utf-8") as f:
                f.write(header + line)

    def add(self, role_type: str, content: str, session_id: str = "", username: str = "", user_role: str = ""):
        entry = {"role": role_type, "content": content, "timestamp": time.time(),
                 "session_id": session_id, "username": username, "user_role": user_role}
        self.short_term.append(entry)
        cache_short_term(session_id, entry)
        max_sz = self.config.memory_short_term_size
        if len(self.short_term) > max_sz:
            removed = self.short_term.pop(0)
            if self.config.memory_long_term_enabled:
                self._append_memory(
                    username=removed.get("username", ""),
                    role_type=removed["role"],
                    content=removed["content"],
                    timestamp=removed["timestamp"],
                    user_role=removed.get("user_role", ""),
                )

    def clear_short(self):
        self.short_term.clear()
        clear_short_term_cache()

    def clear_long(self):
        for info in self._list_user_paths():
            for f in info["path"].iterdir():
                f.unlink()
            info["path"].rmdir()

    def search(self, keyword: str) -> List[Dict]:
        results = []
        for entry in self._read_all_memories():
            if keyword.lower() in entry["content"].lower():
                results.append(entry)
        return results[:50]

    def list_files(self) -> List[Dict]:
        files = []
        for info in self._list_user_paths():
            for f in sorted(info["path"].iterdir()):
                if not f.is_file():
                    continue
                if f.name == self.INDEX_FILENAME or f.name.endswith(".index.json.tmp"):
                    continue
                content = f.read_text("utf-8")
                lines = content.strip().splitlines()
                files.append({
                    "username": f"{info['role']}/{info['username']}",
                    "filename": f.name,
                    "role": info["role"],
                    "size": len(content),
                    "line_count": len(lines),
                    "updated_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                })
        return files

    def init_user(self, username: str, role: str = ""):
        """Create the directory structure and all 6 memory files for a new user."""
        role, uname = self._parse_user(username, role)
        user_dir = self._ensure_user_dir(uname, role)
        display_role = role if role else "默认"
        templates = {
            "profile": f"# {username} 的用户画像\n> 角色: {display_role}\n> 姓名、职业、年龄、身份等长期不变的信息\n\n",
            "preferences": f"# {username} 的用户偏好\n> 角色: {display_role}\n> 回答风格、语言、开发偏好、习惯等\n\n",
            "knowledge": f"# {username} 的长期事实\n> 角色: {display_role}\n> AI已确认的事实（如「用户使用Laravel」「服务器在东京」）\n\n",
            "conversation": f"# {username} 的对话摘要\n> 角色: {display_role}\n> 历史聊天摘要（不保存全文）\n\n",
            "decisions": f"# {username} 的决策历史\n> 角色: {display_role}\n> 重要决策及原因，方便后续保持一致\n\n",
            "timeline": f"# {username} 的时间线\n> 角色: {display_role}\n> 事件发生时间记录\n\n",
        }
        for file_type, header in templates.items():
            path = user_dir / self.MEMORY_FILE_NAMES[file_type]
            if not path.exists():
                path.write_text(header, "utf-8")
        # Also create legacy MEMORY.md for backward compatibility
        legacy = user_dir / MEMORY_MD
        if not legacy.exists():
            legacy.write_text(f"# {username} 的记忆\n> 角色: {display_role}\n> 自动生成的长期记忆文件\n\n", "utf-8")

    def read_all_user_files(self, username: str, role: str = "") -> Dict[str, str]:
        result = {}
        for file_type in self.MEMORY_FILE_TYPES:
            path = self._memory_path(username, role, self.MEMORY_FILE_NAMES[file_type])
            if path.exists():
                result[file_type] = path.read_text("utf-8")
            else:
                result[file_type] = ""
        return result

    def append_to_file(self, username: str, file_type: str, content: str, role: str = ""):
        path = self._memory_path(username, role, self.MEMORY_FILE_NAMES.get(file_type, MEMORY_MD))
        self._ensure_user_dir(username, role)
        if path.exists():
            with path.open("a", encoding="utf-8") as f:
                f.write(content + "\n")
        else:
            header = f"# {username} 的{file_type}\n> 角色: {role if role else '默认'}\n\n"
            path.write_text(header + content + "\n", "utf-8")

    def find_user_role(self, username: str) -> str:
        """Search all role directories for existing memory files of this user."""
        safe = self._sanitize(username)
        for role_dir in sorted(self.MEMORY_DIR.iterdir()):
            if not role_dir.is_dir():
                continue
            user_dir = role_dir / safe
            if user_dir.is_dir() and any((user_dir / fn).exists() for fn in self.MEMORY_FILE_NAMES.values()):
                return role_dir.name
        return ""

    def read_file(self, username: str, filename: str = MEMORY_MD, role: str = "") -> str:
        path = self._memory_path(username, role, filename)
        if path.exists():
            return path.read_text("utf-8")
        return ""

    def write_file(self, username: str, content: str, filename: str = MEMORY_MD, role: str = ""):
        self._ensure_user_dir(username, role)
        path = self._memory_path(username, role, filename)
        path.write_text(content, "utf-8")

    # ── 分层记忆索引（参考 TencentDB Agent Memory L1 原子层）──────
    @staticmethod
    def _parse_ts(ts_str: str) -> float:
        s = ts_str.strip()
        try:
            return datetime.fromisoformat(s).timestamp()
        except ValueError:
            pass
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(s, fmt).timestamp()
            except ValueError:
                continue
        return 0.0

    def _parse_entries_from_text(self, text: str) -> List[Dict]:
        entries = []
        for line in text.splitlines():
            line = line.strip()
            if not line.startswith("- ["):
                continue
            m = self._ENTRY_RE.match(line)
            if not m:
                continue
            content = m.group(2).strip()
            content = re.sub(r'^\*\*[^*]+\*\*:\s*', '', content)
            if not content:
                continue
            entries.append({
                "content": content,
                "timestamp": self._parse_ts(m.group(1)),
            })
        return entries

    def _snapshot_files(self, user_dir: Path) -> Dict[str, List[float]]:
        state = {}
        for ft, fn in self._user_files().items():
            p = user_dir / fn
            if p.exists():
                st = p.stat()
                state[ft] = [round(st.st_mtime, 4), st.st_size]
        return state

    def _read_index(self, path: Path) -> Optional[Dict]:
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text("utf-8"))
        except Exception:
            return None

    def _write_index(self, path: Path, file_state: Dict[str, List[float]], entries: List[Dict]):
        payload = {
            "version": self.INDEX_VERSION,
            "files": file_state,
            "entries": entries,
        }
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), "utf-8")
        tmp.replace(path)

    def _build_entries(self, user_dir: Path) -> List[Dict]:
        entries = []
        for ft, fn in self._user_files().items():
            p = user_dir / fn
            if not p.exists():
                continue
            for e in self._parse_entries_from_text(p.read_text("utf-8")):
                e["file_type"] = ft
                entries.append(e)
        return entries

    def _embedder(self):
        if self._embedder_obj is None:
            from knowledge import EmbeddingClient
            self._embedder_obj = EmbeddingClient(self.config)
        return self._embedder_obj

    def _embedder_available(self) -> bool:
        try:
            e = self._embedder
            return bool(e.base_url and e.model)
        except Exception:
            return False

    def _fill_embeddings(self, entries: List[Dict], old_index: Optional[Dict] = None):
        """为缺少 embedding 的条目补算向量；优先复用旧索引同 hash 的向量。"""
        old_by_hash = {}
        if old_index:
            for e in old_index.get("entries", []):
                if e.get("embedding"):
                    old_by_hash[e.get("hash")] = e["embedding"]
        missing = []
        for e in entries:
            h = hashlib.md5((e["file_type"] + "\x00" + e["content"]).encode("utf-8"), usedforsecurity=False).hexdigest()
            e["hash"] = h
            e["embedding"] = old_by_hash.get(h)
            if not e.get("embedding"):
                missing.append(e)
        if missing:
            try:
                embs = self._embedder.embed_batch([m["content"] for m in missing])
                for m, emb in zip(missing, embs):
                    m["embedding"] = emb
            except Exception as exc:
                logger.warning("memory embedding failed: %s", exc)

    def _load_entries(self, username: str, role: str = "") -> List[Dict]:
        """读取某用户全部记忆条目（.index.json 懒重建 + 内存缓存）。"""
        role, uname = self._parse_user(username, role)
        role_dir = self.MEMORY_DIR / (self._sanitize(role) if role else "_")
        user_dir = role_dir / self._sanitize(uname)
        if not user_dir.is_dir():
            return []
        file_state = self._snapshot_files(user_dir)
        key = (role, uname)
        with self._index_lock:
            if key in self._index_cache and self._index_cache[key][0] == file_state:
                return self._index_cache[key][1]
        index_path = user_dir / self.INDEX_FILENAME
        old = self._read_index(index_path)
        if old and old.get("version") == self.INDEX_VERSION and old.get("files") == file_state:
            entries = old.get("entries", [])
        else:
            entries = self._build_entries(user_dir)
            if self._embedder_available():
                self._fill_embeddings(entries, old)
            try:
                self._write_index(index_path, file_state, entries)
            except Exception as exc:
                logger.warning("write memory index failed: %s", exc)
        with self._index_lock:
            self._index_cache[key] = (file_state, entries)
        return entries

    # ── 混合召回（关键词 BM25 + 向量余弦，RRF 融合）─────────────
    @staticmethod
    def _tokenize(text: str) -> List[str]:
        tokens = []
        for w in re.findall(r'[A-Za-z0-9_+\-\.#]+', text):
            tokens.append(w.lower())
        for ch in re.findall(r'[\u4e00-\u9fff]', text):
            tokens.append(ch)
        return tokens

    @staticmethod
    def _cosine(a, b) -> float:
        if not a or not b:
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(y * y for y in b))
        if not na or not nb:
            return 0.0
        return dot / (na * nb)

    def _bm25_scores(self, entries: List[Dict], query_tokens: List[str], k1: float = 1.5, b: float = 0.75) -> List[float]:
        from collections import Counter
        n = max(len(entries), 1)
        docs = [self._tokenize(e["content"]) for e in entries]
        avgdl = sum(len(d) for d in docs) / n if n else 0.0
        df = Counter()
        for d in docs:
            df.update(set(d))
        idf = {t: math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5)) for t in query_tokens}
        scores = []
        for d in docs:
            dl = len(d) or 1
            freq = Counter(d)
            s = 0.0
            for t in set(query_tokens) & set(d):
                s += idf.get(t, 0.0) * (freq[t] * (k1 + 1)) / (freq[t] + k1 * (1 - b + b * dl / avgdl))
            scores.append(s)
        return scores

    def _query_embedding(self, query: str) -> Optional[List[float]]:
        if not self._embedder_available():
            return None
        try:
            return self._embedder.embed(query)
        except Exception as exc:
            logger.warning("memory query embedding failed: %s", exc)
            return None

    def _vector_scores(self, entries: List[Dict], query: str) -> List[float]:
        vec_scores = [0.0] * len(entries)
        query_emb = self._query_embedding(query)
        if not query_emb:
            return vec_scores
        for i, e in enumerate(entries):
            if e.get("embedding"):
                vec_scores[i] = self._cosine(query_emb, e["embedding"])
        return vec_scores

    def _recall_item(self, entry: Dict, score: float, username: str, role: str, include_scores: bool) -> Dict:
        item = {
            "content": entry["content"],
            "file_type": entry["file_type"],
            "timestamp": entry.get("timestamp", 0),
            "username": self._sanitize(username),
            "role": role,
        }
        if include_scores:
            item["score"] = round(score, 4)
        return item

    def recall(self, username: str, query: str, role: str = "", top_k: Optional[int] = None,
               include_scores: bool = True) -> List[Dict]:
        """仅对当前用户做混合召回（关键词 + 向量，RRF 融合）。"""
        top_k = top_k or self.config.memory_recall_top_k
        entries = self._load_entries(username, role)
        if not entries or not query or not query.strip():
            return []
        query_tokens = self._tokenize(query)
        kw_scores = self._bm25_scores(entries, query_tokens)
        vec_scores = self._vector_scores(entries, query)
        k = 60
        rk_kw = {i: r + 1 for r, (i, _) in enumerate(sorted(enumerate(kw_scores), key=lambda x: -x[1]))}
        rk_vec = {i: r + 1 for r, (i, _) in enumerate(sorted(enumerate(vec_scores), key=lambda x: -x[1]))}
        fused = []
        for i in range(len(entries)):
            s = (1.0 / (k + rk_kw[i]) if kw_scores[i] > 0 else 0.0) + (1.0 / (k + rk_vec[i]) if vec_scores[i] > 0 else 0.0)
            if s > 0:
                fused.append((s, i))
        fused.sort(key=lambda x: (-x[0], -entries[x[1]].get("timestamp", 0)))
        return [self._recall_item(entries[i], s, username, role, include_scores) for s, i in fused[:top_k]]

    # ── 提取去重（精确 hash + 向量相似度）───────────────────────
    def is_duplicate(self, username: str, role: str, file_type: str, content: str) -> bool:
        entries = self._load_entries(username, role)
        for e in entries:
            if e.get("file_type") == file_type and e.get("content") == content:
                return True
        if not content.strip() or not self._embedder_available():
            return False
        try:
            emb = self._embedder.embed(content)
        except Exception:
            return False
        for e in entries:
            if e.get("file_type") != file_type or not e.get("embedding"):
                continue
            if self._cosine(emb, e["embedding"]) >= self.config.memory_dedup_threshold:
                return True
        return False

    # ── 记忆块构建（persona 常驻 + 相关召回 + 预算裁剪）──────────
    @staticmethod
    def _file_lines(text: str) -> List[str]:
        return [l.strip() for l in text.splitlines()
                if l.strip() and not l.startswith("#") and not l.startswith(">")]

    @staticmethod
    def _content_text(c) -> str:
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            parts = []
            for p in c:
                if isinstance(p, dict):
                    parts.append(p.get("text", "") or "")
                else:
                    parts.append(str(p))
            return " ".join(p for p in parts if p)
        if c:
            return str(c)
        return ""

    @staticmethod
    def _last_user_text(messages: List[Dict]) -> str:
        for m in reversed(messages):
            if not isinstance(m, dict) or m.get("role") != "user":
                continue
            c = m.get("content")
            if isinstance(c, (str, list)):
                return MemoryManager._content_text(c)
            if c:
                return str(c)
        return ""

    def _collect_memory_entries(self, username: str, role: str, query: str, budget: int, files: Dict[str, str]) -> List[tuple]:
        ordered = []  # (file_type, content)
        seen = set()

        def _push(ft: str, content: str):
            h = hashlib.md5((ft + "\x00" + content).encode("utf-8"), usedforsecurity=False).hexdigest()
            if h in seen:
                return
            seen.add(h)
            ordered.append((ft, content))

        # 1. 画像层：profile + preferences 常驻
        for ft in ("profile", "preferences"):
            for ln in self._file_lines(files.get(ft, "")):
                ln = re.sub(r'^-\s*\[[^\]]+\]\s*', '', ln).strip()
                if ln:
                    _push(ft, ln)
        # 2. 相关召回（对应当前问题）
        if query:
            for r in self.recall(username, query, role, top_k=self.config.memory_recall_top_k):
                _push(r["file_type"], r["content"])
        # 3. 预算有剩余时补充最近条目
        if len("\n".join(c for _, c in ordered)) < budget:
            recent = sorted(self._load_entries(username, role), key=lambda e: e.get("timestamp", 0), reverse=True)
            for e in recent:
                _push(e["file_type"], e["content"])
        return ordered

    @staticmethod
    def _trim_to_budget(ordered: List[tuple], budget: int) -> List[str]:
        # 4. 按预算硬裁剪
        lines = []
        total = 0
        for ft, content in ordered:
            add = f"[{ft}] {content}" if ft in ("profile", "preferences") else f"- {content}"
            if total > 0 and total + len(add) + 1 > budget:
                break
            lines.append(add)
            total += len(add) + 1
        return lines

    def _build_memory_block(self, username: str, role: str, query: str, budget: int) -> List[str]:
        files = self.read_all_user_files(username, role)
        ordered = self._collect_memory_entries(username, role, query, budget, files)
        return self._trim_to_budget(ordered, budget)

    def get_context(self, session_messages: List[Dict], username: str = "", role: str = "",
                    max_recent: int = 20, query: str = "") -> List[Dict]:
        ctx: List[Dict] = []
        if self.config.memory_long_term_enabled and username:
            if not role:
                role = self.find_user_role(username)
            if not query:
                query = self._last_user_text(session_messages)
            lines = self._build_memory_block(username, role, query, self.config.memory_context_budget_chars)
            if lines:
                ctx.append({"role": "system", "content": "[用户记忆]\n" + "\n".join(lines)})
        ctx.extend(session_messages[-max_recent:])
        return ctx




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
            session.messages = [{"role": m.role, "content": m.content, "reasoning": m.reasoning, "attachments": m.attachments, "images": m.images, "display_content": m.display_content, "timestamp": m.timestamp} for m in msg_rows]
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
            result = [{"role": r.role, "content": r.content, "reasoning": r.reasoning, "attachments": r.attachments, "images": r.images, "display_content": r.display_content, "timestamp": r.timestamp} for r in rows]
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
        # Merge any system messages in history (e.g. memory context) into the
        # main system prompt so the request carries exactly one system message.
        system_parts = []
        non_system = []
        for m in history:
            if m.get("role") == "system":
                system_parts.append(m.get("content", ""))
            else:
                non_system.append(m)
        if system_parts:
            sp = "\n\n".join(p for p in [sp, *system_parts] if p)
        msgs = [{"role": "system", "content": sp}]
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
        kwargs = dict(
            model=self.config.vl_model or self.config.llm_model,
            messages=msgs,
            max_tokens=self.config.vl_max_tokens,
            temperature=self.config.vl_temperature,
        )
        self._log_request(kwargs, "VL chat",
                          base_url=self.config.vl_base_url,
                          api_key=self.config.vl_api_key)
        return self._vl_client.chat.completions.create(**kwargs) if extra is None \
            else self._vl_client.chat.completions.create(**kwargs, extra_body=extra)

    def _chat_completion(self, msgs: List[Dict], extra: Optional[Dict],
                         max_tokens: Optional[int], temperature: Optional[float]):
        kwargs = self._build_kwargs(stream=False)
        kwargs["messages"] = msgs
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        if temperature is not None:
            kwargs["temperature"] = temperature
        self._log_request(kwargs, "LLM chat")
        return self.client.chat.completions.create(**kwargs) if extra is None \
            else self.client.chat.completions.create(**kwargs, extra_body=extra)

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
            kwargs = dict(
                model=self.config.vl_model or self.config.llm_model,
                messages=msgs,
                max_tokens=self.config.vl_max_tokens,
                temperature=self.config.vl_temperature,
                stream=True,
            )
            self._log_request(kwargs, "VL stream",
                              base_url=self.config.vl_base_url,
                              api_key=self.config.vl_api_key)
            return self._vl_client.chat.completions.create(**kwargs) if extra is None \
                else self._vl_client.chat.completions.create(**kwargs, extra_body=extra)
        else:
            kwargs = self._build_kwargs(stream=True)
            kwargs["messages"] = msgs
            self._log_request(kwargs, "LLM stream")
            return self.client.chat.completions.create(**kwargs) if extra is None \
                else self.client.chat.completions.create(**kwargs, extra_body=extra)

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
        self._memory_extract_interval = 2  # Extract memory every N messages
        self._memory_msg_count: Dict[str, int] = {}  # session_id -> message count
        self._memory_extract_level: Dict[str, int] = {}  # session_id -> warmup level

        # RAG 配置（可通过 API 动态调整）
        # 默认关闭知识库：仅当后台「知识库管理」页开关打开时（rag_enabled=true）才使用
        self.rag_enabled = False
        self.rag_kb_ids: List[int] = []
        self.rag_top_k = 6
        self.rag_threshold = 0.5
        self.rag_max_threshold = 1.0
        self.rag_reranker_enabled = self.config.reranker_enabled
        self.rag_reranker_model = self.config.reranker_model
        self._ke = None

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
        return self.memory.recall(username, keyword, role, top_k=top_k or 50)

    def clear_memory(self):
        self.memory.clear_short()
        self.memory.clear_long()

    def list_memory_files(self) -> List[Dict]:
        return self.memory.list_files()

    def read_memory_file(self, username: str, filename: str = MEMORY_MD, role: str = "") -> str:
        return self.memory.read_file(username, filename, role)

    def write_memory_file(self, username: str, content: str, filename: str = MEMORY_MD, role: str = ""):
        self.memory.write_file(username, content, filename, role)

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

    def _inject_rag_context(self, user_input: str, sp: str) -> str:
        if not self.rag_enabled:
            return sp
        try:
            ctx = self.ke.build_rag_context(
                query=user_input,
                kb_ids=self.rag_kb_ids if self.rag_kb_ids else None,
                top_k=self.rag_top_k,
                threshold=self.rag_threshold,
                max_threshold=self.rag_max_threshold,
                use_reranker=self.rag_reranker_enabled,
            )
            if ctx:
                sp = f"""{sp}

## 知识库参考信息
以下是与用户问题相关的知识库内容，请优先参考这些信息来回答问题：

{ctx}

请基于以上知识库内容回答用户问题。如果知识库信息不足以回答，可以结合你自身知识补充，但请说明哪些是知识库来源。
"""
        except Exception as e:
            logger.warning("RAG context injection failed: %s", e)
        return sp

    @staticmethod
    def _get_executor():
        if not hasattr(ChatGPT, '_executor'):
            from concurrent.futures import ThreadPoolExecutor
            ChatGPT._executor = ThreadPoolExecutor(max_workers=4)
        return ChatGPT._executor

    def _resolve_use_thinking(self, use_thinking: Optional[bool]) -> bool:
        """思考过程默认由后台「模型参数配置」的 LLM_THINKING_ENABLED 控制；未显式传入时取配置值。"""
        if use_thinking is None:
            return bool(self.config.llm_thinking_enabled)
        return use_thinking

    def _resolve_session(self, session_id: Optional[str]) -> Session:
        if session_id:
            session = self.sessions.switch(session_id)
        else:
            session = self.current_session()
        if not session:
            session = self.sessions.create()
        return session

    def _run_intent_tasks(self, user_input: str, sp: str, use_knowledge: Optional[bool]) -> tuple:
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
            futures["intent"] = pool.submit(irec.recognize, user_input)
            futures["rag"] = pool.submit(self._inject_rag_context, user_input, sp)
        else:
            # 知识库关闭：仅做线索意图检测（预约/咨询等），不触发内容目录 rerank
            futures["intent"] = pool.submit(irec.detect_lead_intent, user_input)
        rag_sp = futures["rag"].result() if "rag" in futures else sp
        recommendations = futures["intent"].result() or {}
        forbidden = futures["forbidden"].result()
        return irec, rag_sp, recommendations, forbidden

    @staticmethod
    def _apply_catalog_context(irec, recommendations: Dict, sp: str) -> str:
        if recommendations.get("intent") != "view_content":
            return sp
        matches = recommendations.get("matches") or []
        catalog_ctx = irec.format_catalog_context(matches=matches if matches else None)
        if catalog_ctx:
            sp += catalog_ctx
        return sp

    def _resolve_session_role(self, session: Session):
        if not (session and session.username):
            return
        role = session.role or ""
        if not role or not self.memory._memory_path(session.username, role, "profile.md").exists():
            found = self.memory.find_user_role(session.username)
            if found:
                session.role = found

    def _apply_lead_context(self, irec, recommendations: Dict, username: Optional[str],
                            session: Session, sid: str, sp: str, user_input: str) -> str:
        if recommendations.get("action") == "showForm":
            mode = recommendations.get("actionData", {}).get("mode", "demo")
            has_user = bool(username) or bool(session and session.username)
            lead_ctx = irec.format_lead_context(mode, has_user_info=has_user)
            if lead_ctx:
                sp += lead_ctx
            if has_user:
                self._pending_leads[sid] = mode
                del recommendations["action"]
                if "actionData" in recommendations:
                    del recommendations["actionData"]
        elif sid in self._pending_leads:
            recommendations["action"] = "showForm"
            recommendations["actionData"] = {
                "mode": self._pending_leads.pop(sid),
                "requirement": user_input,
            }
        return sp

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

    @staticmethod
    def _has_memory_content(memories: Dict[str, str]) -> bool:
        return any(
            any(l.strip() and not l.startswith("#") and not l.startswith(">")
                for l in content.splitlines())
            for content in memories.values()
        )

    def _memory_extract_check(self, sid: str, count: int, has_content: bool) -> bool:
        # warmup 策略（参考 TencentDB Agent Memory）：阈值 1→2→4→8→… 翻倍递增
        if self.config.memory_warmup_enabled:
            level = self._memory_extract_level.get(sid, 0)
            return count >= _warmup_threshold(level, self.config.memory_extract_max_interval)
        return count >= self._memory_extract_interval or (count == 1 and not has_content)

    def _maybe_extract_memory(self, session: Session, user_input: str, result: Dict):
        if not session.username:
            return
        sid = session.session_id
        role = session.role or self.memory.find_user_role(session.username)
        if not role:
            role = "_"
        has_content = self._has_memory_content(self.memory.read_all_user_files(session.username, role))
        count = self._memory_msg_count.get(sid, 0) + 1
        self._memory_msg_count[sid] = count
        should_extract = self._memory_extract_check(sid, count, has_content)
        if should_extract and role != "_":
            self._memory_msg_count[sid] = 0
            if self.config.memory_warmup_enabled:
                self._memory_extract_level[sid] = self._memory_extract_level.get(sid, 0) + 1
            import threading as _t
            _t.Thread(target=self._extract_and_update_memory,
                      args=(session.username, role, user_input, result.get("content", "")),
                      daemon=True).start()

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
             stop_event: Optional["threading.Event"] = None) -> Dict:
        session = self._resolve_session(session_id)
        sp = system_prompt or session.system_prompt or self.config.system_prompt

        # ── 并行执行 RAG, 意图识别, 违禁检测 ──
        irec, sp, recommendations, forbidden = self._run_intent_tasks(user_input, sp, use_knowledge)

        # ── 注入跳转链接来源 ──
        sp = self._apply_catalog_context(irec, recommendations, sp)

        # Resolve user role from existing memory files
        self._resolve_session_role(session)

        sid = session.session_id if session else ""
        sp = self._apply_lead_context(irec, recommendations, username, session, sid, sp, user_input)

        forbidden_result = self._handle_forbidden(forbidden, on_chunk, session, user_input, images, attachments, original_input, recommendations)
        if forbidden_result is not None:
            return forbidden_result

        ctx = self.memory.get_context(session.messages, username=session.username or "", role=session.role or "", query=user_input)
        # 思考过程默认由后台「模型参数配置」的 LLM_THINKING_ENABLED 控制；未显式传入时取配置值
        use_thinking = self._resolve_use_thinking(use_thinking)
        if use_thinking is False:
            sp += """
## 思考过程已关闭
本次回答请直接给出最终答案，不要输出任何思考、推理或过程性的内容（不要输出 <thinking>、<reasoning> 等思考块）。
"""
        result = self._do_stream(session, sp, ctx, user_input, images, on_chunk, on_reasoning, stop_event, use_thinking=use_thinking)

        result["recommendations"] = recommendations

        self._save_exchange(session, user_input, attachments, images, original_input, result)

        self.memory.add("user", user_input, session.session_id, session.username, session.role)
        self.memory.add("assistant", result["content"], session.session_id, session.username, session.role)

        # Trigger memory extraction (first message immediately if files empty, then every N messages)
        self._maybe_extract_memory(session, user_input, result)

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

    # ── 记忆提取（AI分析对话，更新6个记忆文件）─────────────
    def _build_memory_summary(self, memories: Dict[str, str]) -> str:
        current_summary = ""
        for ft in self.memory.MEMORY_FILE_TYPES:
            c = memories.get(ft, "").strip()
            if not c:
                continue
            lines = [l for l in c.splitlines() if l.strip() and not l.startswith("#") and not l.startswith(">")]
            if lines:
                current_summary += f"[{ft}]\n" + "\n".join(lines[-5:]) + "\n\n"
        return current_summary

    def _apply_memory_updates(self, updates: Dict, username: str, role: str, now: str):
        for file_type, new_content in updates.items():
            if not (new_content and new_content.strip()):
                continue
            new_content = new_content.strip()
            if self.memory.is_duplicate(username, role, file_type, new_content):
                logger.debug("memory dedup skipped: [%s] %s", file_type, new_content[:40])
                continue
            line = f"- [{now}] {new_content}"
            self.memory.append_to_file(username, file_type, line, role)

    def _extract_and_update_memory(self, username: str, role: str, user_input: str, assistant_response: str):
        if not username:
            return
        try:
            memories = self.memory.read_all_user_files(username, role)
            current_summary = self._build_memory_summary(memories)

            extraction_prompt = f"""分析以下对话，提取需要记录到用户记忆的新信息。

已有记忆：
{current_summary}

最新对话：
用户: {user_input[:1000]}
助手: {assistant_response[:1000]}

输出JSON，包含需要更新的字段（没有更新则为空字符串）：
{{"profile": "", "preferences": "", "knowledge": "", "conversation": "", "decisions": "", "timeline": ""}}

profile: 姓名/职业/年龄/身份等长期不变信息
preferences: 回答风格/语言/开发偏好/习惯等
knowledge: 已确认的事实（如"用户使用Laravel"）
conversation: 本轮对话摘要（1-2句话）
decisions: 重要决策及原因
timeline: 事件及时间
每条不超过50字，只返回JSON。"""

            resp = self.client.chat(
                sp="你是一个记忆提取助手，只提取明确的新信息，不要重复已有内容。输出纯JSON。",
                history=[],
                user_input=extraction_prompt,
            )
            content = resp.get("content", "").strip()
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                updates = json.loads(json_match.group())
                now = datetime.fromtimestamp(time.time()).strftime("%Y-%m-%d %H:%M")
                self._apply_memory_updates(updates, username, role, now)
        except Exception as e:
            logger.warning(f"Memory extraction failed: {e}")

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


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("PYTHON_HOST", "127.0.0.1")
    port = int(os.getenv("PYTHON_PORT", "8000"))
    uvicorn.run("api:app", host=host, port=port, reload=True)
