"""
Intent Recognition Module
Detects when users want to navigate to SEO/GEO-configured content pages,
and exposes the content catalog as prompt context so the AI can
dynamically match user requests to the correct content jump links.

Matching pipeline:
1. Fast regex → lead intent (demo/solution/case/consult form actions)
2. Embedding-based semantic match → user input embedded, cosine similarity
   against catalog items (title + keywords + geoSummary + FAQ), reranked
   by RerankerClient when available. Only top-N matched items are injected
   into the prompt (smaller prompt, more precise links).
3. Fallback → full catalog injection when embedding is unavailable.

The recommendation catalog is sourced from the SEO/GEO config table
`seo_configs` (enabled=1, canonical_url present), so links are always the
configured Canonical URLs verbatim.
"""

import re
import time
import math
import logging
from typing import Optional, List, Dict, Any

from db import get_db
from sqlalchemy import text

logger = logging.getLogger("AIConsultant.IntentRecognizer")

# All quotation characters to detect
_QUOTES = r"""['""""''「》""<<]"""
_QUOTES_CLOSE = r"""['""""''」《"">>]"""

# Intent action verbs
_LOOK_VERBS = r'(?:看看|看一下|查看|浏览|了解|我想看|我想了解一下|我想看看|我看下|我想查看|我想浏览|打开|跳转到|进入|搜索|查找|查询|找一下|帮我看看|帮我查一下)'

# ── Intent Patterns ──────────────────────────────────────────
# Priority-ordered: (compiled pattern, entity_type or None, name_group_index)
# Used only to detect whether the user wants to view/open some content.
_INTENT_PATTERNS = [
    # 1. Quoted entity with known type: 看一下"测试产品", 查看"xxx"解决方案
    (re.compile(r'{}\s*{}?\s*(.+?)\s*{}?\s*(?:的)?\s*(?:{})'.format(
        _LOOK_VERBS, _QUOTES, _QUOTES_CLOSE,
        '产品|解决方案|方案|案例|客户案例|白皮书|报告'
    )), None, 1),
    # 2. Quoted entity alone: "测试产品", 'xxx'
    (re.compile(r'{}(.+?){}'.format(_QUOTES, _QUOTES_CLOSE)), None, 1),
    # 3. No quotes, explicit type: 看一下测试产品, 了解xxx解决方案
    (re.compile(r'{}\s*(.+?)\s*(?:的)?\s*(?:产品|解决方案|方案|案例|客户案例|白皮书|报告)\s*$'.format(_LOOK_VERBS)), None, 1),
    # 4. No quotes, implicit: 看一下xxx, 我想了解xxx
    (re.compile(r'{}\s*(.+?)\s*$'.format(_LOOK_VERBS)), None, 1),
]

# ── Lead Intent Patterns ──────────────────────────────────────
# When user wants to book demo, request solution, or consult cases
_LEAD_PATTERNS = [
    # 预约演示 / 申请演示 / 产品演示
    (r'(?:预约|申请|想要|我想|我要|请安排)\s*预约\s*(?:产品)?\s*(?:演示|demo|Demo)', 'demo'),
    (r'(?:预约|申请|想要|我想|我要|请安排)\s*(?:产品)?\s*(?:演示|demo|Demo|产品介绍|功能演示)', 'demo'),
    (r'(?:预约|演示|demo|Demo)\s*(?:预约|申请|我想看|想了解)', 'demo'),
    (r'演示\s*(?:预约|申请)', 'demo'),
    # 获取方案 / 定制方案 / 解决方案咨询
    (r'(?:获取|生成|想要|我想|我要|定制|申请|咨询)\s*(?:定制)?\s*(?:解决方案|方案|技术方案|项目方案)', 'solution'),
    (r'(?:解决方案|方案)\s*(?:咨询|了解|获取|定制)', 'solution'),
    # 咨询案例 / 同类案例 / 客户案例
    (r'(?:咨询|查看|看看|了解|我想看)\s*(?:同类)?\s*(?:案例|客户案例|成功案例|相似案例)', 'case'),
    (r'(?:案例|客户案例)\s*(?:咨询|了解|查看)', 'case'),
    # 联系顾问 / 联系销售 / 商务咨询
    (r'(?:联系|咨询|找)\s*(?:顾问|销售|商务|客服|专家)', 'consult'),
    (r'(?:我想|我要)\s*(?:咨询|联系|找)\s*(?:人|顾问|销售)', 'consult'),
]

# Catalog cache TTL (seconds): new/edited content shows up within this window
_CATALOG_TTL = 60.0

# Embedding-based match threshold (cosine similarity) below which we fall back
_EMBED_THRESHOLD = 0.25
# How many top matches to keep after embedding + rerank
_MATCH_TOP_N = 3


def _cosine_sim(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class IntentRecognizer:
    """Detect content-viewing / lead intents and expose the content catalog to the AI."""

    def __init__(self):
        self._catalog: Optional[List[Dict]] = None
        self._catalog_loaded_at: float = 0.0
        self._pages: Optional[List[Dict]] = None
        self._pages_loaded_at: float = 0.0
        self._embeddings: Optional[List[List[float]]] = None
        self._config = None
        self._embedder = None
        self._reranker = None

    def configure(self, config) -> None:
        """Attach AI consultant config so embedding/rerank clients can be created lazily."""
        if self._config is None:
            self._config = config
        # always refresh clients in case config changed (reload)
        from knowledge import EmbeddingClient, RerankerClient
        self._embedder = EmbeddingClient(config)
        self._reranker = RerankerClient(config)

    @property
    def embedding_available(self) -> bool:
        if not self._embedder:
            return False
        return bool(self._embedder.base_url and self._embedder.model)

    def _load_catalog(self) -> List[Dict]:
        """Load recommendable content items (TTL cached).

        The authoritative source is the SEO/GEO config table `seo_configs`
        (enabled=1, canonical_url + title present) joined with live content
        items (page_id IS NOT NULL). This makes any SEO-configured content
        recommendable regardless of its module status (a soft-deleted module
        with an enabled seo_configs row still recommends).

        Each item is enriched with SEO/GEO data from the word bank:
        keywords (keyword + intent_note), geo_summary, and FAQ questions.
        These fields are combined into `match_text` used for embedding matching.
        """
        now = time.time()
        if self._catalog is not None and (now - self._catalog_loaded_at) < _CATALOG_TTL:
            return self._catalog

        catalog: List[Dict] = []
        try:
            with get_db() as db:
                # Load GEO word bank data per content item (page_id = content id).
                # The SEO/GEO tables may not exist on older deployments, so each
                # enrichment query is guarded and the catalog still loads without them.
                kw_map: Dict[int, List[str]] = {}
                geo_map: Dict[int, str] = {}
                faq_map: Dict[int, List[str]] = {}
                for q, target in (
                    ("SELECT page_id, keyword, intent_note FROM seo_keywords "
                     "WHERE page_id IS NOT NULL AND keyword IS NOT NULL AND keyword != ''",
                     "kw"),
                    ("SELECT page_id, geo_summary FROM seo_configs "
                     "WHERE page_id IS NOT NULL AND geo_summary IS NOT NULL AND geo_summary != ''",
                     "geo"),
                    ("SELECT page_id, question FROM seo_faqs "
                     "WHERE page_id IS NOT NULL AND question IS NOT NULL AND question != ''",
                     "faq"),
                ):
                    try:
                        erows = db.execute(text(q)).fetchall()
                    except Exception:
                        logger.warning("GEO word bank table unavailable, skipping enrichment query")
                        continue
                    for r in erows:
                        pid = r[0]
                        if pid is None:
                            continue
                        if target == "kw":
                            note = (f"（{r[2]}）" if r[2] else "")
                            kw_map.setdefault(pid, []).append(f"{r[1]}{note}")
                        elif target == "geo":
                            geo_map[pid] = r[1]
                        elif target == "faq":
                            faq_map.setdefault(pid, []).append(r[1])

                # Authoritative recommendation source: seo_configs rows (enabled=1)
                # that reference live content items, grouped by module for display.
                rows = db.execute(
                    text(
                        "SELECT s.page_id, s.canonical_url, s.title, s.description, "
                        "       s.keywords, s.geo_summary, "
                        "       ci.module_key, ci.slug, cc.slug AS category_slug "
                        "FROM seo_configs s "
                        "JOIN content_items ci ON ci.id = s.page_id "
                        "  AND ci.status = 1 AND ci.deleted = 0 "
                        "LEFT JOIN content_categories cc "
                        "  ON cc.id = ci.category_id AND cc.status = 1 AND cc.deleted = 0 "
                        "WHERE s.enabled = 1 AND s.page_id IS NOT NULL "
                        "  AND s.canonical_url IS NOT NULL AND s.canonical_url != '' "
                        "  AND s.title IS NOT NULL AND s.title != '' "
                        "ORDER BY ci.module_key, ci.sort_order, ci.id"
                    )
                ).fetchall()

                # Module names for display. Modules may be soft-deleted while their
                # content stays recommendable via seo_configs, so look up all.
                mod_names: Dict[str, str] = {}
                try:
                    for mr in db.execute(text(
                        "SELECT module_key, module_name FROM core_modules"
                    )).fetchall():
                        mod_names[mr[0]] = mr[1]
                except Exception:
                    pass

                module_map: Dict[str, Dict[str, Any]] = {}

                def _module(key: str) -> Dict[str, Any]:
                    mod = module_map.get(key)
                    if mod is None:
                        mod = {
                            "moduleKey": key,
                            "moduleName": mod_names.get(key, key),
                            "moduleType": 0,
                            "items": [],
                        }
                        module_map[key] = mod
                    return mod

                for r in rows:
                    pid, canonical, title, desc, s_kws, s_geo = r[0], r[1], r[2], r[3], r[4], r[5]
                    mod_key, slug, cat_slug = r[6], r[7], r[8]
                    keywords = list(kw_map.get(pid, []))
                    for k in (s_kws or "").split(","):
                        k = k.strip()
                        if k and k not in keywords:
                            keywords.append(k)
                    geo = geo_map.get(pid) or (s_geo or "").strip()
                    faqs = faq_map.get(pid, [])
                    parts = [title or ""]
                    if desc:
                        parts.append(desc)
                    if keywords:
                        parts.append("关键词：" + "，".join(keywords))
                    if geo:
                        parts.append(geo)
                    if faqs:
                        parts.append("常见问题：" + "；".join(faqs))
                    _module(mod_key or "content")["items"].append({
                        "id": pid,
                        "title": title,
                        "slug": slug or "",
                        "categorySlug": cat_slug,
                        "keywords": keywords,
                        "geoSummary": geo,
                        "faqs": faqs,
                        "canonicalUrl": canonical.strip(),
                        "matchText": "。".join([p for p in parts if p]),
                    })
                catalog = list(module_map.values())
        except Exception as e:
            logger.warning("Failed to load content catalog: %s", e)

        self._catalog = catalog
        self._catalog_loaded_at = now
        self._embeddings = None  # invalidate embeddings
        return catalog

    def _load_pages(self) -> List[Dict]:
        """Load static pages (home/about/faq) & module-list pages from SEO/GEO config.

        These are the seo_configs rows with page_id IS NULL (enabled=1). Each carries
        the authoritative canonicalUrl so intent-recognition link recommendations use
        the SEO/GEO configured URLs verbatim instead of constructed ones.
        """
        now = time.time()
        if self._pages is not None and (now - self._pages_loaded_at) < _CATALOG_TTL:
            return self._pages
        pages: List[Dict] = []
        try:
            with get_db() as db:
                rows = db.execute(text(
                    "SELECT canonical_url, title, page_type, geo_summary, description, keywords "
                    "FROM seo_configs WHERE enabled = 1 AND page_id IS NULL "
                    "AND canonical_url IS NOT NULL AND canonical_url != '' "
                    "AND title IS NOT NULL AND title != '' ORDER BY id"
                )).fetchall()
                for r in rows:
                    url = (r[0] or "").strip()
                    title = (r[1] or "").strip()
                    if not url or not title:
                        continue
                    ptype = (r[2] or "").strip() or "__pages__"
                    geo = (r[3] or "").strip()
                    desc = (r[4] or "").strip()
                    kws = (r[5] or "").strip()
                    parts = [title]
                    if desc:
                        parts.append(desc)
                    if kws:
                        parts.append("关键词：" + kws)
                    if geo:
                        parts.append(geo)
                    pages.append({
                        "moduleKey": ptype,
                        "moduleName": "官网页面",
                        "id": None,
                        "title": title,
                        "slug": "",
                        "categorySlug": None,
                        "keywords": [k.strip() for k in kws.split(",") if k.strip()],
                        "geoSummary": geo,
                        "faqs": [],
                        "canonicalUrl": url,
                        "isPage": True,
                        "matchText": "。".join([p for p in parts if p]),
                    })
        except Exception as e:
            logger.warning("Failed to load SEO/GEO static pages: %s", e)
        self._pages = pages
        self._pages_loaded_at = now
        return pages

    def _all_items(self) -> List[Dict]:
        """Content items + static/module-list pages, used for embedding matching."""
        items = [it for mod in self._load_catalog() for it in mod["items"]]
        items += self._load_pages()
        return items

    def _load_embeddings(self) -> Optional[List[List[float]]]:
        """Batch-embed all candidate match_text entries, cached alongside catalog."""
        if self._embeddings is not None:
            return self._embeddings
        if not self.embedding_available:
            return None
        try:
            items = self._all_items()
            texts = [it["matchText"] for it in items]
            if not texts:
                self._embeddings = []
                return self._embeddings
            self._embeddings = self._embedder.embed_batch(texts)
            return self._embeddings
        except Exception as e:
            logger.warning("Catalog embedding failed: %s", e)
            return None

    def detect_view_intent(self, user_input: str) -> bool:
        """Return True when the user likely wants to view/open some content."""
        for pattern, _fixed_type, _name_group in _INTENT_PATTERNS:
            if pattern.search(user_input):
                return True
        return False

    def match_content(self, user_input: str, top_n: int = _MATCH_TOP_N) -> List[Dict]:
        """Semantically match user input to catalog items via embedding + rerank.

        Returns list of {moduleKey, moduleName, id, title, slug, categorySlug,
        keywords, geoSummary, faqs, canonicalUrl, similarity} sorted by score.
        Empty when embedding unavailable or nothing passes the threshold.
        """
        catalog = self._load_catalog()
        if not catalog and not self._load_pages():
            return []
        if not self.embedding_available:
            return []
        embeddings = self._load_embeddings()
        if not embeddings:
            return []
        items = self._all_items()
        if not items:
            return []

        try:
            query_emb = self._embedder.embed(user_input)
        except Exception as e:
            logger.warning("Query embedding failed: %s", e)
            return []

        scored = []
        for item, emb in zip(items, embeddings):
            sim = _cosine_sim(query_emb, emb)
            scored.append((item, sim))
        scored.sort(key=lambda x: x[1], reverse=True)
        scored = [s for s in scored if s[1] >= _EMBED_THRESHOLD][:top_n * 3]

        if not scored:
            return []

        # Rerank top candidates for precision
        if self._reranker and self._reranker.enabled and len(scored) > 1:
            docs = [it["matchText"] for it, _ in scored]
            try:
                reranked = self._reranker.rerank(user_input, docs, top_n=top_n)
                if reranked:
                    ordered = []
                    used = set()
                    for rr in reranked:
                        idx = rr.get("index")
                        if idx is not None and idx < len(scored) and idx not in used:
                            item, _sim = scored[idx]
                            ordered.append({**item, "similarity": rr.get("relevance_score", 0.0)})
                            used.add(idx)
                    if ordered:
                        return ordered
            except Exception as e:
                logger.warning("Catalog rerank failed: %s", e)

        return [{**item, "similarity": round(sim, 4)} for item, sim in scored[:top_n]]

    def recognize(self, user_input: str) -> Dict:
        """Analyze user input and return detected intent (view_content or lead action).

        For view_content, includes top matched items for targeted link generation.
        """
        if self.detect_view_intent(user_input):
            matches = self.match_content(user_input)
            return {"intent": "view_content", "matches": matches}

        lead = self.detect_lead_intent(user_input)
        if lead:
            return lead

        # Semantic fallback: even without explicit look verbs, a strong
        # embedding match can indicate a content-view intent.
        matches = self.match_content(user_input)
        if matches:
            return {"intent": "view_content", "matches": matches}

        return {}

    def detect_lead_intent(self, user_input: str) -> Optional[Dict]:
        """Check if user wants to book demo, get solution, or consult cases."""
        for pattern, mode in _LEAD_PATTERNS:
            if re.search(pattern, user_input):
                return {"action": "showForm", "actionData": {"mode": mode}}
        return None

    def format_lead_context(self, mode: str, has_user_info: bool = False) -> str:
        """Generate AI prompt context for collecting lead info."""
        mode_names = {"demo": "产品演示预约", "solution": "定制方案咨询", "case": "案例咨询", "consult": "商务咨询"}
        mode_name = mode_names.get(mode, "咨询")
        if has_user_info:
            return (
                f"\n\n## 用户意图：{mode_name}\n"
                f"用户想要{mode_name}，用户的个人信息已由系统自动获取，无需询问。\n"
                f"请直接询问用户的具体需求描述，收集到需求后告知用户信息已提交，系统会自动处理。"
            )
        else:
            return (
                f"\n\n## 用户意图：{mode_name}\n"
                f"用户想要{mode_name}，请引导用户填写页面上的表单完成提交。"
            )

    def format_catalog_context(self, matches: Optional[List[Dict]] = None) -> str:
        """Render the content catalog for the AI prompt.

        When `matches` is provided (embedding/rerank results), only those items
        are rendered so the AI generates a precise jump link with a smaller prompt.
        Otherwise the full catalog is rendered (fallback).
        """
        if matches:
            return self._format_matches_context(matches)

        catalog = self._load_catalog()
        lines = [
            "",
            "## 内容目录（官网内容，用于生成跳转链接）",
            "当用户想查看/打开某条具体内容时，请从以下目录中挑选与用户描述最匹配的一项，并生成可点击的 Markdown 链接。",
            "",
            "链接生成规则：",
            "- 目录项带有「URL」时，链接必须逐字使用该 URL（来自 SEO/GEO 配置的 Canonical URL），不得改写或编造。",
            "- 没有「URL」时，再按以下规则拼装：",
            "  - 带有 categorySlug 时：/list/category/detail?moduleKey={moduleKey}&categorySlug={categorySlug}&slug={slug}",
            "  - 没有 categorySlug 时：/list/detail?moduleKey={moduleKey}&slug={slug}",
            "- 若只匹配到模块而匹配不到具体内容，可提供模块列表链接：/list/category?moduleKey={moduleKey}",
            "",
            "目录（格式：标题｜模块名（moduleKey）｜URL｜slug｜categorySlug｜关键词）：",
        ]
        for mod in catalog:
            for item in mod["items"]:
                title = item.get("title", "")
                slug = item.get("slug", "")
                if not title or not slug:
                    continue
                cat = item.get("categorySlug") or "无"
                kws = "，".join(item.get("keywords", [])) or "无"
                url = item.get("canonicalUrl", "") or "无"
                lines.append(
                    f"- {title}｜{mod['moduleName']}（{mod['moduleKey']}）｜URL：{url}｜{slug}｜{cat}｜{kws}"
                )
        for item in self._load_pages():
            title = item.get("title", "")
            url = item.get("canonicalUrl", "") or "无"
            kws = "，".join(item.get("keywords", [])) or "无"
            lines.append(
                f"- {title}｜{item.get('moduleName', '官网页面')}（{item.get('moduleKey', '')}）｜URL：{url}｜-｜-｜{kws}"
            )
        lines.append("")
        lines.append("重要规则：")
        lines.append("1. 仅当用户明确想查看/打开某条内容时才生成链接。")
        lines.append("2. 链接必须逐字使用条目中给出的 URL（来自 SEO/GEO 配置的 Canonical URL），不得改写或编造。")
        lines.append("3. 若目录中找不到与用户描述匹配的内容，请如实说明未找到，不要编造链接。")
        return "\n".join(lines)

    def _format_matches_context(self, matches: List[Dict]) -> str:
        """Render only the semantically-matched items, ranked by similarity."""
        lines = [
            "",
            "## 用户可能想查看的内容（已按语义匹配排序）",
            "请从以下候选内容中选择与用户描述最匹配的一项，并生成可点击的 Markdown 链接。",
            "",
            "链接生成规则：",
            "- 候选带有「URL」时，链接必须逐字使用该 URL（来自 SEO/GEO 配置的 Canonical URL），不得改写或编造。",
            "- 没有「URL」时，再按以下规则拼装：",
            "  - 带有 categorySlug 时：/list/category/detail?moduleKey={moduleKey}&categorySlug={categorySlug}&slug={slug}",
            "  - 没有 categorySlug 时：/list/detail?moduleKey={moduleKey}&slug={slug}",
            "- 若只匹配到模块而匹配不到具体内容，可提供模块列表链接：/list/category?moduleKey={moduleKey}",
            "",
            "候选（格式：标题｜URL｜slug｜categorySlug｜关键词｜匹配度）：",
        ]
        for item in matches:
            title = item.get("title", "")
            url = item.get("canonicalUrl", "") or "无"
            cat = item.get("categorySlug") or "无"
            kws = "，".join(item.get("keywords", [])) or "无"
            sim = item.get("similarity", 0.0)
            summary = item.get("geoSummary", "")
            if summary:
                summary = summary[:120]
            slug = item.get("slug", "") or "-"
            lines.append(
                f"- {title}｜URL：{url}｜{slug}｜{cat}｜{kws}｜{sim:.2f}"
            )
            if summary:
                lines.append(f"  摘要：{summary}")
        lines.append("")
        lines.append("重要规则：")
        lines.append("1. 仅当匹配内容确实符合用户描述时才生成链接，不要强行推荐。")
        lines.append("2. 链接必须逐字使用候选中给出的 URL（来自 SEO/GEO 配置的 Canonical URL），不得改写或编造。")
        lines.append("3. 若候选中没有与用户描述匹配的内容，请如实说明未找到，不要编造链接。")
        return "\n".join(lines)

    def clear_cache(self):
        self._catalog = None
        self._catalog_loaded_at = 0.0
        self._pages = None
        self._pages_loaded_at = 0.0
        self._embeddings = None


# Singleton
_recognizer: Optional[IntentRecognizer] = None


def get_intent_recognizer() -> IntentRecognizer:
    global _recognizer
    if _recognizer is None:
        _recognizer = IntentRecognizer()
    return _recognizer
