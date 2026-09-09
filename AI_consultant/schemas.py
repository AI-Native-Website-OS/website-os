from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class ChatRequest(BaseModel):
    user_input: str
    session_id: Optional[str] = None
    images: Optional[List[str]] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    username: Optional[str] = None
    role: Optional[str] = None
    original_input: Optional[str] = None
    visitor_id: Optional[str] = None
    use_knowledge: Optional[bool] = None
    use_thinking: Optional[bool] = None


class ChatResponse(BaseModel):
    content: str
    reasoning: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    model: str
    finish_reason: Optional[str] = None
    recommendations: Optional[Dict[str, Any]] = None


class SessionCreateRequest(BaseModel):
    title: str = ""
    system_prompt: Optional[str] = None
    model: Optional[str] = None


class SessionOut(BaseModel):
    session_id: str
    title: str
    username: Optional[str] = None
    message_count: int
    created_at: str
    last_active: str


class MessageOut(BaseModel):
    role: str
    content: Any
    reasoning: Optional[Any] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    images: Optional[List[str]] = None
    display_content: Optional[str] = None
    timestamp: Optional[float] = None


class SessionHistoryOut(BaseModel):
    session_id: str
    messages: List[MessageOut]


class StatsOut(BaseModel):
    prompt: int
    completion: int
    total: int


class TokenLogEntryOut(BaseModel):
    timestamp: str
    session_id: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float


class ConfigOut(BaseModel):
    # LLM
    llm_provider: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_model: Optional[str] = None
    system_prompt: str = ""
    llm_temperature: float = 0.7
    llm_max_tokens: int = 4096
    llm_top_p: float = 1.0
    llm_frequency_penalty: float = 0.0
    llm_presence_penalty: float = 0.0
    llm_stop: Optional[List[str]] = None
    llm_seed: Optional[int] = None
    llm_thinking_auto_collapse: bool = True
    # Embedding
    embedding_provider: Optional[str] = None
    embedding_base_url: Optional[str] = None
    embedding_model: Optional[str] = None
    embedding_dimension: Optional[int] = None
    # VL
    vl_provider: Optional[str] = None
    vl_base_url: Optional[str] = None
    vl_model: Optional[str] = None
    vl_temperature: float = 0.7
    vl_max_tokens: int = 4096
    vl_image_size: str = "1024x1024"
    vl_image_quality: str = "standard"
    # Rerank
    reranker_provider: Optional[str] = None
    reranker_base_url: Optional[str] = None
    reranker_model: Optional[str] = None
    reranker_enabled: bool = False
    reranker_top_k: int = 6
    # AI 顾问限流（来自 system_configs 表，管理后台「系统配置」页维护）
    ai_user_rate_limit: int = 30
    ai_guest_daily_limit: int = 5


class ConfigUpdateRequest(BaseModel):
    llm_provider: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    llm_temperature: Optional[float] = None
    llm_max_tokens: Optional[int] = None
    llm_top_p: Optional[float] = None
    llm_frequency_penalty: Optional[float] = None
    llm_presence_penalty: Optional[float] = None
    llm_stop: Optional[str] = None
    llm_seed: Optional[int] = None
    llm_thinking_keyword: Optional[str] = None
    llm_thinking_auto_collapse: Optional[bool] = None
    embedding_provider: Optional[str] = None
    embedding_base_url: Optional[str] = None
    embedding_api_key: Optional[str] = None
    embedding_model: Optional[str] = None
    embedding_dimension: Optional[int] = None
    vl_provider: Optional[str] = None
    vl_base_url: Optional[str] = None
    vl_api_key: Optional[str] = None
    vl_model: Optional[str] = None
    vl_temperature: Optional[float] = None
    vl_max_tokens: Optional[int] = None
    vl_image_size: Optional[str] = None
    vl_image_quality: Optional[str] = None
    reranker_provider: Optional[str] = None
    reranker_base_url: Optional[str] = None
    reranker_api_key: Optional[str] = None
    reranker_model: Optional[str] = None
    reranker_enabled: Optional[bool] = None
    reranker_top_k: Optional[int] = None


class MemorySearchOut(BaseModel):
    results: List[Dict[str, Any]]


class MemoryFileInfo(BaseModel):
    username: str
    filename: str
    size: int
    line_count: int
    updated_at: str
    file_type: str = ""
    content: str = ""
    role: str = ""


class MemoryFileListOut(BaseModel):
    files: List[MemoryFileInfo]


class MemoryFileContentOut(BaseModel):
    username: str
    filename: str = "MEMORY.md"
    content: str


class MemoryFileSaveRequest(BaseModel):
    content: str


class MemoryInitRequest(BaseModel):
    role: str = ""


class ForbiddenDetectRequest(BaseModel):
    user_input: str


class ForbiddenDetectResult(BaseModel):
    blocked: bool = False
    matched_topic: Optional[str] = None
    similarity: float = 0.0
    answer: str = ""


class StatusOut(BaseModel):
    status: str
    message: str


class PromptConfigItem(BaseModel):
    type: str  # 'system_prompt', 'suggestion', 'banned_word'
    content: str
    sort_order: int = 0


class PromptConfigOut(BaseModel):
    system_prompt: str = ""
    suggestions: List[str] = []
    banned_words: List[str] = []
    banned_threshold: float = 0.82
    welcome_message: str = ""
    input_placeholder: str = ""


class PromptConfigSaveRequest(BaseModel):
    system_prompt: str = ""
    suggestions: List[str] = []
    banned_words: List[str] = []
    banned_threshold: Optional[float] = None
    welcome_message: Optional[str] = None
    input_placeholder: Optional[str] = None


class ModelConfigItem(BaseModel):
    key: str
    value: str


class ModelConfigOut(BaseModel):
    items: List[ModelConfigItem] = []


class ModelConfigSaveRequest(BaseModel):
    items: List[ModelConfigItem] = []

class TestConnectivityRequest(BaseModel):
    model_type: str = "llm"  # llm / embedding / vl / rerank

class TestConnectivityResult(BaseModel):
    success: bool
    model_type: str
    message: str
    latency_ms: float = 0


# ── 知识库 ────────────────────────────────────────────────────────

class KnowledgeBaseCreateRequest(BaseModel):
    name: str
    description: str = ""
    chunk_size: int = 1024
    chunk_overlap: int = 50
    chunk_separator: str = "\n\n"
    text_preprocessing_rules: List[str] = Field(default_factory=list)
    embedding_model: Optional[str] = None
    embedding_dimension: Optional[int] = None
    top_k: int = 6
    threshold_min: float = 0.5
    threshold_max: float = 0.7
    reranker_model: Optional[str] = None
    reranker_enabled: bool = False


class KnowledgeBaseUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    chunk_separator: Optional[str] = None
    text_preprocessing_rules: Optional[List[str]] = None
    embedding_model: Optional[str] = None
    embedding_dimension: Optional[int] = None
    top_k: Optional[int] = None
    threshold_min: Optional[float] = None
    threshold_max: Optional[float] = None
    reranker_model: Optional[str] = None
    reranker_enabled: Optional[bool] = None


class KnowledgeBaseOut(BaseModel):
    id: int
    name: str
    description: str = ""
    status: int = 1
    chunk_size: int = 1024
    chunk_overlap: int = 50
    chunk_separator: str = "\n\n"
    text_preprocessing_rules: List[str] = Field(default_factory=list)
    embedding_model: str = ""
    embedding_dimension: int = 0
    top_k: int = 6
    threshold_min: float = 0.5
    threshold_max: float = 0.7
    reranker_model: str = ""
    reranker_enabled: bool = False
    created_at: str = ""
    updated_at: str = ""


class KnowledgeBaseListOut(BaseModel):
    items: List[KnowledgeBaseOut] = []


class KnowledgeDocumentOut(BaseModel):
    id: int
    knowledge_base_id: int
    title: str
    file_name: str = ""
    file_size: int = 0
    status: int = 0
    chunk_count: int = 0
    created_at: str = ""
    updated_at: str = ""


class KnowledgeDocumentListOut(BaseModel):
    items: List[KnowledgeDocumentOut] = []


class KnowledgeChunkOut(BaseModel):
    id: int
    content: str
    media_type: str = "text"
    chunk_index: int = 0
    tokens: int = 0
    document_id: int
    doc_title: str = ""
    similarity: float = 0.0


class KnowledgeSearchRequest(BaseModel):
    query: str
    kb_id: Optional[int] = None
    top_k: int = 5
    threshold: float = 0.0
    max_threshold: float = 1.0


class KnowledgeSearchOut(BaseModel):
    results: List[KnowledgeChunkOut] = []


class KnowledgeProcessOut(BaseModel):
    status: str
    message: str = ""
    chunks: int = 0
    document_id: int = 0


class KnowledgeReembedOut(BaseModel):
    status: str
    reembedded: int = 0


class SyncDocumentRequest(BaseModel):
    kb_id: int
    source_type: str
    source_id: int
    title: str
    content: str
    file_path: str = ""
    images: Optional[List[Dict[str, Any]]] = None


# ── SEO/GEO 内容生成 ────────────────────────────────────────────────

class SeoGeneratePage(BaseModel):
    key: str
    title: str = ""
    page_type: str = "static"  # static / list / content
    module_name: str = ""
    context: str = ""


class SeoGenerateRequest(BaseModel):
    pages: List[SeoGeneratePage] = Field(default_factory=list)
    max_concurrency: int = 4


class SeoGenerateResult(BaseModel):
    key: str
    description: str = ""
    keywords: List[str] = Field(default_factory=list)
    geo_summary: str = ""
    keyword_entries: List[Dict[str, Any]] = Field(default_factory=list)
    faqs: List[Dict[str, Any]] = Field(default_factory=list)


class SeoGenerateResponse(BaseModel):
    results: List[SeoGenerateResult] = Field(default_factory=list)
    failed: List[str] = Field(default_factory=list)
