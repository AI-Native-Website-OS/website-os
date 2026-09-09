import time
from datetime import datetime
from sqlalchemy import Boolean, Column, String, Integer, Float, DateTime, Text, JSON, BigInteger, ForeignKey, Index
from sqlalchemy.orm import declarative_base

Base = declarative_base()


def auto_upgrade(engine):
    """Idempotently bring already-created tables up to date (add missing columns)."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns("ai_message")} if insp.has_table("ai_message") else set()
    if insp.has_table("ai_message"):
        additions = []
        if "reasoning" not in cols:
            additions.append("ALTER TABLE ai_message ADD COLUMN IF NOT EXISTS reasoning JSON")
        if "attachments" not in cols:
            additions.append("ALTER TABLE ai_message ADD COLUMN IF NOT EXISTS attachments JSON")
        if "images" not in cols:
            additions.append("ALTER TABLE ai_message ADD COLUMN IF NOT EXISTS images JSON")
        if "display_content" not in cols:
            additions.append("ALTER TABLE ai_message ADD COLUMN IF NOT EXISTS display_content JSON")
        if additions:
            with engine.begin() as conn:
                for stmt in additions:
                    conn.execute(text(stmt))


class AiSession(Base):
    __tablename__ = "ai_session"
    session_id = Column(String(128), primary_key=True)
    title = Column(String(256), default="", server_default="")
    username = Column(String(128), default="", server_default="")
    system_prompt = Column(Text, default="", server_default="")
    model = Column(String(128), default="", server_default="")
    created_at = Column(Float, default=time.time)
    updated_at = Column(Float, default=time.time)


class AiMessage(Base):
    __tablename__ = "ai_message"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(128), ForeignKey("ai_session.session_id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), nullable=False)
    content = Column(JSON, nullable=False)
    reasoning = Column(JSON, nullable=True)
    attachments = Column(JSON, nullable=True)
    images = Column(JSON, nullable=True)
    display_content = Column(JSON, nullable=True)
    timestamp = Column(Float, default=time.time, index=True)


class AiTokenUsage(Base):
    __tablename__ = "ai_token_usage"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(128), ForeignKey("ai_session.session_id", ondelete="SET NULL"), nullable=True, index=True)
    model = Column(String(128), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow)


class AiLongTermMemory(Base):
    __tablename__ = "ai_long_term_memory"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(128), nullable=True, index=True)
    type = Column(String(32), default="summary")
    content = Column(Text, nullable=False)
    timestamp = Column(Float, default=time.time, index=True)


class AiPromptConfig(Base):
    __tablename__ = "ai_prompt_config"
    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(32), nullable=False, index=True)
    content = Column(Text, nullable=False)
    sort_order = Column(Integer, default=0)
    updated_at = Column(Float, default=time.time)


class SystemConfig(Base):
    """与 Java 端共享的 system_configs 表（管理后台「系统配置」读写）"""
    __tablename__ = "system_configs"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    config_key = Column(String(128), nullable=False, index=True)
    config_value = Column(Text, default="")
    config_type = Column(String(64), default="system")
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════
#  知识库相关模型
# ═══════════════════════════════════════════════════════════════

class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    status = Column(Integer, default=1)

    # 分块配置
    chunk_size = Column(Integer, default=1024)
    chunk_overlap = Column(Integer, default=50)
    chunk_separator = Column(String(50), default="\n\n")

    # 文本预处理规则（JSON 数组）
    text_preprocessing_rules = Column(JSON, default=lambda: [])

    # 嵌入模型（可选覆盖全局配置）
    embedding_model = Column(String(255), nullable=True)
    embedding_dimension = Column(Integer, nullable=True)

    # 请求文档片段数（检索时默认拉取数）
    top_k = Column(Integer, default=6)

    # 匹配阈值范围
    threshold_min = Column(Float, default=0.5)
    threshold_max = Column(Float, default=0.7)

    # 重排模型（可选）
    reranker_model = Column(String(255), nullable=True)
    reranker_enabled = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    knowledge_base_id = Column(BigInteger, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    file_path = Column(String(500), default="")
    file_name = Column(String(500), default="")
    file_size = Column(BigInteger, default=0)
    content = Column(Text, default="")
    images = Column(JSON, nullable=True)
    source_type = Column(String(50), nullable=True)
    source_id = Column(BigInteger, nullable=True)
    status = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_docs_source", "source_type", "source_id", unique=True),
    )


class ForbiddenTopic(Base):
    __tablename__ = "forbidden_topics"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(String, default="")
    threshold = Column(Float, default=0.5)
    enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ForbiddenTopicExample(Base):
    __tablename__ = "forbidden_topic_examples"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    topic_id = Column(BigInteger, ForeignKey("forbidden_topics.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    document_id = Column(BigInteger, ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    knowledge_base_id = Column(BigInteger, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    media_type = Column(String(20), default="text")
    chunk_index = Column(Integer, default=0)
    tokens = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_chunks_kb", "knowledge_base_id"),
        Index("idx_chunks_doc", "document_id"),
    )

