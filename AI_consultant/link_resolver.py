"""Link Resolver
Maps knowledge-base retrieval hits back to their website content pages so the
AI can recommend clickable jump links (inline Markdown + structured chips).

Each KB document carries `source_type` / `source_id` (see KnowledgeSyncService):
- content item:  source_type = <moduleKey>,  source_id = content_items.id
- category:      source_type = "content_category", source_id = content_categories.id
- module:        source_type = "core_module",       source_id = core_modules.id
- static pages:  source_type in home/about/faq/version_config/...

Resolution prefers the SEO/GEO configured Canonical URL (`seo_configs`) and
otherwise constructs the detail URL from the content tables, mirroring the
frontend `moduleConfig.ts` URL patterns.
"""

import time
import logging
from typing import Optional, List, Dict, Any, Tuple
from urllib.parse import urlsplit, urlunsplit

from db import get_db
from sqlalchemy import text

logger = logging.getLogger("AIConsultant.LinkResolver")

# source_type values that are NOT content-item module keys
_RESERVED_SOURCES = {
    "core_module", "content_category", "faq", "home", "about",
    "contact_info", "banner", "home_section", "home_footer", "version_config",
}

# static source_type -> fallback URL when seo_configs has no canonical URL
_STATIC_URLS = {
    "home": "/",
    "about": "/about",
    "faq": "/faqs",
    "version_config": "/version",
}

_STATIC_MODULE_NAMES = {
    "home": "首页",
    "about": "关于我们",
    "faq": "常见问题",
    "version_config": "版本配置",
}

# cache TTL matches the intent-recognition catalog so new content shows up quickly
_CACHE_TTL = 60.0


def to_relative_url(url: str) -> str:
    """Strip scheme+host so links resolve against the current frontend origin.

    Canonical URLs in seo_configs may carry a configured/stale base domain
    (e.g. a demo or internal host). Recommendation links must always use the
    address the visitor is currently browsing, so we emit path-relative URLs.
    """
    if not url:
        return url
    try:
        parts = urlsplit(url.strip())
        if parts.scheme or parts.netloc:
            return urlunsplit(("", "", parts.path or "/", parts.query, parts.fragment))
    except Exception:
        pass
    return url


def _detail_url(module_key: str, category_slug: Optional[str], slug: str) -> str:
    from urllib.parse import quote
    mk = quote(module_key or "")
    if category_slug:
        return f"/list/category/detail?moduleKey={mk}&categorySlug={quote(category_slug)}&slug={quote(slug or '')}"
    return f"/list/detail?moduleKey={mk}&slug={quote(slug or '')}"


def _category_url(module_key: str, category_slug: Optional[str]) -> str:
    from urllib.parse import quote
    mk = quote(module_key or "")
    if category_slug:
        return f"/list/category?moduleKey={mk}&categorySlug={quote(category_slug)}"
    return f"/list/category?moduleKey={mk}"


class LinkResolver:
    """Resolve KB hit sources to website content pages with jump URLs (TTL cached)."""

    def __init__(self):
        self._cache: Dict[Tuple[str, int], Optional[Dict]] = {}
        self._cache_loaded_at: float = 0.0
        self._seo: Optional[Tuple[Dict[int, str], Dict[str, str]]] = None

    def clear_cache(self) -> None:
        self._cache = {}
        self._cache_loaded_at = 0.0
        self._seo = None

    def _ensure_cache(self) -> None:
        if (time.time() - self._cache_loaded_at) >= _CACHE_TTL:
            self._cache = {}
            self._cache_loaded_at = time.time()
            self._seo = None

    def _seo_urls(self, db) -> Tuple[Dict[int, str], Dict[str, str]]:
        """Return (canonical_url by content page_id, canonical_url by page_type for static/module pages)."""
        if self._seo is not None:
            return self._seo
        by_page_id: Dict[int, str] = {}
        by_type: Dict[str, str] = {}
        try:
            rows = db.execute(text(
                "SELECT page_id, page_type, canonical_url FROM seo_configs "
                "WHERE enabled = 1 AND canonical_url IS NOT NULL AND canonical_url != ''"
            )).fetchall()
        except Exception:
            logger.warning("seo_configs unavailable, falling back to constructed URLs")
            self._seo = (by_page_id, by_type)
            return self._seo
        for r in rows:
            pid, ptype, url = r[0], (r[1] or "").strip(), (r[2] or "").strip()
            if not url:
                continue
            if pid is not None:
                by_page_id[pid] = url
            elif ptype:
                by_type.setdefault(ptype, url)
        self._seo = (by_page_id, by_type)
        return self._seo

    def _resolve_one(self, db, source_type: str, source_id: int,
                     doc_title: str = "") -> Optional[Dict]:
        seo_by_id, seo_by_type = self._seo_urls(db)

        # ── Static pages ─────────────────────────────────────────
        if source_type in ("home", "about", "faq", "version_config"):
            url = seo_by_type.get(source_type) or _STATIC_URLS.get(source_type)
            if not url:
                return None
            return {
                "id": None,
                "moduleKey": source_type,
                "moduleName": _STATIC_MODULE_NAMES.get(source_type, "官网页面"),
                "title": doc_title or _STATIC_MODULE_NAMES.get(source_type, "官网页面"),
                "slug": "",
                "categorySlug": None,
                "url": url,
                "canonicalUrl": url,
            }

        # other non-page sources (banner / home_section / footer / contact_info)
        if source_type in _RESERVED_SOURCES:
            return None

        # ── Module catalog ───────────────────────────────────────
        if source_type == "core_module":
            row = db.execute(text(
                "SELECT module_key, module_name, path, is_system FROM core_modules "
                "WHERE id = :id AND deleted = 0"
            ), {"id": source_id}).fetchone()
            if not row:
                return None
            module_key, module_name, path, is_system = row[0], row[1], row[2], row[3]
            url = (path if is_system and path else None) \
                or seo_by_type.get(module_key) \
                or _category_url(module_key, None)
            return {
                "id": None,
                "moduleKey": module_key,
                "moduleName": module_name or module_key,
                "title": doc_title or (module_name or module_key),
                "slug": "",
                "categorySlug": None,
                "url": url,
                "canonicalUrl": url,
            }

        # ── Category catalog ─────────────────────────────────────
        if source_type == "content_category":
            row = db.execute(text(
                "SELECT cc.module_key, cc.name, cc.slug, cm.module_name "
                "FROM content_categories cc "
                "LEFT JOIN core_modules cm ON cm.module_key = cc.module_key AND cm.deleted = 0 "
                "WHERE cc.id = :id AND cc.status = 1 AND cc.deleted = 0"
            ), {"id": source_id}).fetchone()
            if not row:
                return None
            module_key, cat_name, cat_slug, module_name = row[0], row[1], row[2], row[3]
            url = _category_url(module_key, cat_slug)
            return {
                "id": None,
                "moduleKey": module_key,
                "moduleName": module_name or module_key,
                "title": doc_title or cat_name or module_key,
                "slug": "",
                "categorySlug": cat_slug,
                "url": url,
                "canonicalUrl": url,
            }

        # ── Content item (source_type is the module key) ─────────
        row = db.execute(text(
            "SELECT ci.module_key, ci.title, ci.slug, ci.summary, cc.slug AS category_slug, "
            "       cm.module_name "
            "FROM content_items ci "
            "LEFT JOIN content_categories cc ON cc.id = ci.category_id "
            "  AND cc.status = 1 AND cc.deleted = 0 "
            "LEFT JOIN core_modules cm ON cm.module_key = ci.module_key AND cm.deleted = 0 "
            "WHERE ci.id = :id AND ci.status = 1 AND ci.deleted = 0"
        ), {"id": source_id}).fetchone()
        if not row:
            return None
        module_key, title, slug, summary, category_slug, module_name = \
            row[0], row[1], row[2], row[3], row[4], row[5]
        url = seo_by_id.get(source_id) or _detail_url(module_key, category_slug, slug)
        return {
            "id": source_id,
            "moduleKey": module_key,
            "moduleName": module_name or module_key,
            "title": doc_title or title or "",
            "slug": slug or "",
            "categorySlug": category_slug,
            "summary": summary or "",
            "url": url,
            "canonicalUrl": url,
        }

    def resolve(self, hits: List[Dict], max_items: int = 3) -> List[Dict]:
        """Resolve ordered RAG hits to unique website pages, best matches first.

        Returns candidates with keys: id, moduleKey, moduleName, title, slug,
        categorySlug, url, canonicalUrl (+ similarity when available).
        Unresolvable hits are dropped.
        """
        if not hits:
            return []
        self._ensure_cache()
        resolved: List[Dict] = []
        seen: set = set()
        try:
            with get_db() as db:
                for hit in hits:
                    source_type = (hit.get("source_type") or "").strip()
                    source_id = hit.get("source_id")
                    if not source_type or source_id is None:
                        continue
                    try:
                        source_id = int(source_id)
                    except (TypeError, ValueError):
                        continue
                    key = (source_type, source_id)
                    if key not in self._cache:
                        self._cache[key] = self._resolve_one(
                            db, source_type, source_id, hit.get("doc_title") or "")
                    candidate = self._cache[key]
                    if not candidate:
                        continue
                    url = candidate.get("url")
                    if not url or url in seen:
                        continue
                    seen.add(url)
                    item = dict(candidate)
                    item["url"] = to_relative_url(item.get("url", ""))
                    if item.get("canonicalUrl"):
                        item["canonicalUrl"] = to_relative_url(item["canonicalUrl"])
                    sim = hit.get("similarity")
                    if sim is not None:
                        item["similarity"] = sim
                    resolved.append(item)
                    if len(resolved) >= max_items:
                        break
        except Exception as e:
            logger.warning("Link resolution failed: %s", e)
            return []
        return resolved


_resolver: Optional[LinkResolver] = None


def get_link_resolver() -> LinkResolver:
    global _resolver
    if _resolver is None:
        _resolver = LinkResolver()
    return _resolver
