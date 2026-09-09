import logging
import time
from typing import List, Optional, Dict, Any

import numpy as np
from sqlalchemy import select, text as sa_text

from db import get_db, _engine as get_db_engine
from models import ForbiddenTopicExample

logger = logging.getLogger("ForbiddenDetector")


class ForbiddenDetector:
    """禁答检测器：从 forbidden_topics + forbidden_topic_examples 读取禁答主题与示例，
       对用户输入做关键词预检 + Embedding 召回 + Rerank 打分。

       每个主题下的示例即为不同语言/不同问法的表达，命中任一示例即判定该主题禁止回答。
    """

    DEFAULT_ANSWER = "抱歉，这部分属于系统内部信息，我无法提供。如有业务相关问题，我很乐意继续帮助您。"

    EMBED_RECALL_THRESHOLD = 0.5  # Embedding 召回候选的最低余弦相似度
    EMBED_RECALL_TOP = 5          # 进入 Rerank 的候选数量

    def __init__(self, embedder, reranker=None):
        self.embedder = embedder
        self.reranker = reranker
        self._topic_cache: List[Dict[str, Any]] = []
        self._topic_cache_time = 0
        self._topic_cache_ttl = 60
        self._ensure_embedding_column()

    # ── 数据库初始化 ──────────────────────────────────────────

    def _current_embedding_dim(self) -> Optional[int]:
        try:
            engine = get_db_engine()
            with engine.connect() as conn:
                row = conn.execute(sa_text(
                    "SELECT a.atttypmod FROM pg_attribute a "
                    "JOIN pg_class t ON a.attrelid = t.oid "
                    "WHERE t.relname = 'forbidden_topic_examples' AND a.attname = 'embedding'"
                )).fetchone()
                return int(row[0]) if row and row[0] and int(row[0]) > 0 else None
        except Exception as e:
            logger.warning("read forbidden embedding column dim: %s", e)
            return None

    def _ensure_embedding_column(self):
        """确保 forbidden_topic_examples 表存在 embedding vector 列（维度与当前模型匹配）。

        向量由示例内容派生，维度不一致时可直接重建列，随后由 refresh_all_embeddings 补算。
        """
        dim = self.embedder.dimension
        try:
            engine = get_db_engine()
            with engine.connect() as conn:
                conn.execute(sa_text("CREATE EXTENSION IF NOT EXISTS vector"))
                current = self._current_embedding_dim()
                if current is not None and current != dim:
                    logger.warning(
                        "forbidden embedding column dim mismatch: current=%s target=%s, rebuilding column (stored vectors will be recomputed)",
                        current, dim,
                    )
                    conn.execute(sa_text(
                        "ALTER TABLE forbidden_topic_examples DROP COLUMN IF EXISTS embedding"
                    ))
                conn.execute(sa_text(
                    f"ALTER TABLE forbidden_topic_examples ADD COLUMN IF NOT EXISTS embedding vector({dim})"
                ))
                conn.commit()
        except Exception as e:
            logger.warning("forbidden embedding column init: %s", e)

    # ── 加载禁答主题与示例 ────────────────────────────────────

    @staticmethod
    def _parse_embedding(raw) -> Optional[List[float]]:
        if not raw:
            return None
        if isinstance(raw, str):
            s = raw.strip()
            if s.startswith("[") and s.endswith("]"):
                s = s[1:-1]
            s = s.strip()
            if not s:
                return None
            parts = [p.strip() for p in s.split(",") if p.strip() != ""]
            if not parts:
                return None
            try:
                return [float(p) for p in parts]
            except (ValueError, TypeError):
                return None
        if isinstance(raw, (list, tuple)):
            try:
                return [float(v) for v in raw]
            except (ValueError, TypeError):
                return None
        return None

    def _load_topics(self) -> List[Dict[str, Any]]:
        now = time.time()
        if self._topic_cache and (now - self._topic_cache_time) < self._topic_cache_ttl:
            return self._topic_cache
        topics: List[Dict[str, Any]] = []
        try:
            with get_db() as db:
                rows = db.execute(sa_text("""
                    SELECT t.id, t.name, t.threshold,
                           e.id AS example_id, e.content, e.embedding::text AS embedding
                    FROM forbidden_topics t
                    LEFT JOIN forbidden_topic_examples e ON e.topic_id = t.id
                    WHERE t.enabled = true
                    ORDER BY t.id, e.id
                """)).fetchall()
            by_id: Dict[int, Dict[str, Any]] = {}
            for r in rows:
                tid = r[0]
                topic = by_id.get(tid)
                if topic is None:
                    topic = {"id": tid, "name": r[1], "threshold": r[2], "examples": []}
                    by_id[tid] = topic
                    topics.append(topic)
                if r[3] is not None:
                    topic["examples"].append({
                        "id": r[3],
                        "content": r[4] or "",
                        "embedding": self._parse_embedding(r[5]),
                    })
        except Exception as e:
            logger.warning("Load forbidden topics failed: %s", e)
            return []
        self._topic_cache = topics
        self._topic_cache_time = now
        return self._topic_cache

    def _load_global_threshold(self) -> float:
        from models import AiPromptConfig
        try:
            with get_db() as db:
                row = db.execute(
                    select(AiPromptConfig.content)
                    .where(AiPromptConfig.type == "banned_threshold")
                    .limit(1)
                ).scalar()
        except Exception:
            row = None
        if row:
            try:
                return float(row)
            except (ValueError, TypeError):
                pass
        return 0.82

    @staticmethod
    def _cosine(a: List[float], b: List[float]) -> float:
        q = np.array(a)
        v = np.array(b)
        return float(np.dot(q, v) / (np.linalg.norm(q) * np.linalg.norm(v) + 1e-10))

    # ── 示例 embedding 维护 ───────────────────────────────────

    def compute_and_store_embedding(self, example_id: int) -> bool:
        """计算单个禁答示例的 embedding 并写入数据库"""
        try:
            with get_db() as db:
                example = db.execute(
                    select(ForbiddenTopicExample).where(ForbiddenTopicExample.id == example_id)
                ).scalar_one_or_none()
        except Exception as e:
            logger.warning("Load forbidden example %s failed: %s", example_id, e)
            return False
        if not example or not example.content or not example.content.strip():
            logger.warning("Forbidden example %s not found or empty", example_id)
            return False
        try:
            emb = self.embedder.embed(example.content)
        except Exception as e:
            logger.warning("Compute embedding for example %s failed: %s", example_id, e)
            return False
        dim = self.embedder.dimension
        emb_str = "[" + ",".join(str(v) for v in emb[:dim]) + "]"
        try:
            with get_db() as db:
                db.execute(sa_text("""
                    UPDATE forbidden_topic_examples SET embedding = CAST(:emb AS vector) WHERE id = :id
                """), {"emb": emb_str, "id": example_id})
        except Exception as e:
            logger.warning("Store embedding for example %s failed: %s", example_id, e)
            return False
        self._topic_cache = []
        self._topic_cache_time = 0
        return True

    def refresh_all_embeddings(self) -> int:
        """为所有缺失 embedding 的禁答示例批量补算，返回成功数量"""
        try:
            with get_db() as db:
                rows = db.execute(sa_text("""
                    SELECT id FROM forbidden_topic_examples
                    WHERE content IS NOT NULL AND trim(content) <> ''
                      AND (embedding IS NULL)
                """)).fetchall()
        except Exception as e:
            logger.warning("Refresh forbidden embeddings: %s", e)
            return 0
        count = 0
        for r in rows:
            if self.compute_and_store_embedding(r[0]):
                count += 1
        return count

    # ── 检测入口 ────────────────────────────────────────────

    def detect(self, user_input: str) -> Dict[str, Any]:
        if not user_input or not user_input.strip():
            return {"blocked": False, "matched_topic": None, "similarity": 0.0, "answer": ""}

        topics = self._load_topics()
        if not topics:
            return {"blocked": False, "matched_topic": None, "similarity": 0.0, "answer": ""}

        # 1. 关键词预检（主题名 + 示例内容的子串匹配）
        text_lower = user_input.lower()
        for t in topics:
            literals = [t["name"]] + [e["content"] for e in t["examples"]]
            for lit in literals:
                if lit and len(lit) > 1 and lit.lower() in text_lower:
                    logger.info("Forbidden keyword hit: topic=%s literal=%s", t["name"], lit)
                    return {
                        "blocked": True,
                        "matched_topic": t["name"],
                        "similarity": 1.0,
                        "answer": self.DEFAULT_ANSWER,
                    }

        # 2. Embedding 召回候选（带向量的示例）
        candidates = []
        for t in topics:
            for e in t["examples"]:
                emb = e.get("embedding")
                if emb:
                    candidates.append((t, e, emb))
        if not candidates:
            return {"blocked": False, "matched_topic": None, "similarity": 0.0, "answer": ""}

        try:
            query_emb = self.embedder.embed(user_input)
        except Exception as e:
            logger.warning("Query embedding for banned detection failed: %s", e)
            return {"blocked": False, "matched_topic": None, "similarity": 0.0, "answer": ""}
        query_emb = query_emb[:self.embedder.dimension]

        scored = []
        for t, e, emb in candidates:
            sim = self._cosine(query_emb, emb)
            scored.append((t, e, sim))
        scored.sort(key=lambda x: x[2], reverse=True)

        recall = [(t, e, s) for t, e, s in scored if s >= self.EMBED_RECALL_THRESHOLD][:self.EMBED_RECALL_TOP]
        if not recall and scored:
            recall = [scored[0]]

        # 3. Rerank 打分判定（Rerank 可用时以 Rerank 分数为准）
        best = None
        best_sim = recall[0][2] if recall else 0.0
        if self.reranker and self.reranker.enabled and recall:
            try:
                docs = [e["content"] for _, e, _ in recall]
                rr = self.reranker.rerank(user_input, docs, top_n=1)
                if rr and rr[0].get("relevance_score") is not None:
                    idx = rr[0].get("index")
                    if idx is not None and idx < len(recall):
                        best = (recall[idx][0], recall[idx][1])
                        best_sim = float(rr[0]["relevance_score"])
            except Exception as e:
                logger.warning("Banned detection rerank failed: %s", e)

        # 4. 回退：取最高余弦相似度候选
        if best is None and recall:
            best = (recall[0][0], recall[0][1])
            best_sim = recall[0][2]

        if best is None:
            return {"blocked": False, "matched_topic": None, "similarity": 0.0, "answer": ""}

        topic, example = best
        threshold = topic.get("threshold")
        if not threshold or threshold <= 0:
            threshold = self._load_global_threshold()

        if best_sim >= threshold:
            logger.info("Forbidden detection BLOCKED: topic=%s example=%s sim=%s", topic["name"], example["content"], round(best_sim, 4))
            return {
                "blocked": True,
                "matched_topic": topic["name"],
                "similarity": round(best_sim, 4),
                "answer": self.DEFAULT_ANSWER,
            }

        return {"blocked": False, "matched_topic": None, "similarity": 0.0, "answer": ""}


# singleton
_detector: Optional[ForbiddenDetector] = None


def get_detector(embedder=None, reranker=None) -> ForbiddenDetector:
    global _detector
    if _detector is None:
        if embedder is None:
            from knowledge import EmbeddingClient, RerankerClient
            from main import Config
            cfg = Config()
            embedder = EmbeddingClient(cfg)
            reranker = reranker or RerankerClient(cfg)
        _detector = ForbiddenDetector(embedder, reranker)
    return _detector
