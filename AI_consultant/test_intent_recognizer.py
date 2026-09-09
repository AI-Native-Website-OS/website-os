"""Tests for intent_recognizer.IntentRecognizer (dynamic catalog + AI-driven links)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest
from sqlalchemy import text

from db import get_db
from intent_recognizer import IntentRecognizer


@pytest.fixture()
def recognizer():
    r = IntentRecognizer()
    r.clear_cache()
    yield r
    r.clear_cache()


def _existing_module_keys():
    with get_db() as db:
        rows = db.execute(
            text("SELECT module_key FROM core_modules WHERE status = 1 AND deleted = 0")
        ).fetchall()
    return {r[0] for r in rows}


def _any_item(module_key: str):
    """Return (title, slug, category_slug) of any published item for the module, or None."""
    with get_db() as db:
        row = db.execute(
            text(
                "SELECT ci.title, ci.slug, cc.slug AS category_slug "
                "FROM content_items ci "
                "LEFT JOIN content_categories cc "
                "  ON cc.id = ci.category_id AND cc.status = 1 AND cc.deleted = 0 "
                "WHERE ci.module_key = :m AND ci.status = 1 AND ci.deleted = 0 "
                "ORDER BY ci.sort_order, ci.id LIMIT 1"
            ),
            {"m": module_key},
        ).fetchone()
    return (row[0], row[1], row[2]) if row else None


# ── catalog structure ─────────────────────────────────────────────

def test_catalog_sourced_from_seo_configs(recognizer):
    with get_db() as db:
        rows = db.execute(text(
            "SELECT s.page_id, s.canonical_url FROM seo_configs s "
            "JOIN content_items ci ON ci.id = s.page_id AND ci.status = 1 AND ci.deleted = 0 "
            "WHERE s.enabled = 1 AND s.page_id IS NOT NULL "
            "AND s.canonical_url IS NOT NULL AND s.canonical_url != '' "
            "AND s.title IS NOT NULL AND s.title != ''"
        )).fetchall()
    if not rows:
        pytest.skip("no enabled seo_configs content rows in DB")
    catalog = recognizer._load_catalog()
    items = [it for m in catalog for it in m["items"]]
    by_id = {it["id"]: it for it in items}
    for pid, url in rows:
        assert pid in by_id, f"seo_configs page_id {pid} missing from catalog"
        assert by_id[pid]["canonicalUrl"] == url.strip()
    assert len(items) == len(rows)


def test_catalog_items_normalized(recognizer):
    catalog = recognizer._load_catalog()
    for m in catalog:
        for item in m["items"]:
            assert set(item.keys()) >= {"id", "title", "slug", "categorySlug", "canonicalUrl"}
            assert isinstance(item["title"], str) and item["title"]
            assert isinstance(item["slug"], str) and item["slug"]
            assert isinstance(item["canonicalUrl"], str) and item["canonicalUrl"]


def test_catalog_ttl_cached(recognizer):
    c1 = recognizer._load_catalog()
    c2 = recognizer._load_catalog()
    assert c1 is c2
    recognizer.clear_cache()
    c3 = recognizer._load_catalog()
    assert c3 is not c1


def test_catalog_includes_all_seo_configured_content(recognizer):
    with get_db() as db:
        expected = db.execute(text(
            "SELECT COUNT(*) FROM seo_configs s "
            "JOIN content_items ci ON ci.id = s.page_id AND ci.status = 1 AND ci.deleted = 0 "
            "WHERE s.enabled = 1 AND s.page_id IS NOT NULL "
            "AND s.canonical_url IS NOT NULL AND s.canonical_url != '' "
            "AND s.title IS NOT NULL AND s.title != ''"
        )).scalar()
    if not expected:
        pytest.skip("no enabled seo_configs content rows in DB")
    catalog = recognizer._load_catalog()
    total = sum(len(m["items"]) for m in catalog)
    assert total == expected


def test_catalog_items_carry_seo_canonical_url(recognizer):
    catalog = recognizer._load_catalog()
    with get_db() as db:
        rows = db.execute(text(
            "SELECT page_id, canonical_url FROM seo_configs "
            "WHERE enabled = 1 AND page_id IS NOT NULL "
            "AND canonical_url IS NOT NULL AND canonical_url != ''"
        )).fetchall()
    url_by_page = {r[0]: r[1].strip() for r in rows}
    for m in catalog:
        for item in m["items"]:
            if item["id"] in url_by_page:
                assert item["canonicalUrl"] == url_by_page[item["id"]]


# ── intent recognition with real data ─────────────────────────────

@pytest.mark.parametrize("module_key", ["products", "solutions", "cases", "resources"])
def test_recognize_view_intent_builtin_module(recognizer, module_key):
    item = _any_item(module_key)
    if not item:
        pytest.skip(f"no published content in {module_key}")
    title, slug, _cat = item
    recs = recognizer.recognize(f"我想查看{title}")
    assert recs.get("intent") == "view_content"


def test_recognize_view_intent_custom_module(recognizer):
    custom = [k for k in _existing_module_keys()
              if k not in ("products", "solutions", "cases", "resources")]
    if not custom:
        pytest.skip("no custom core modules in DB")
    item = None
    for k in custom:
        it = _any_item(k)
        if it:
            item = it
            break
    if not item:
        pytest.skip("no custom core module with published content in DB")
    title, slug, _cat = item
    recs = recognizer.recognize(f"我想了解一下{title}")
    assert recs.get("intent") == "view_content"


def test_recognize_no_intent_returns_empty(recognizer):
    recs = recognizer.recognize("今天天气怎么样")
    assert not recs


# ── lead intent ───────────────────────────────────────────────────

def test_recognize_lead_demo(recognizer):
    recs = recognizer.recognize("我想预约产品演示")
    assert recs.get("action") == "showForm"
    assert recs.get("actionData", {}).get("mode") == "demo"


# ── catalog context ───────────────────────────────────────────────

def test_format_catalog_context_contains_link_rules(recognizer):
    ctx = recognizer.format_catalog_context()
    assert "内容目录" in ctx
    assert "Canonical URL" in ctx
    assert "URL" in ctx
    assert "/list/detail?moduleKey={moduleKey}&slug={slug}" in ctx
    assert "/list/category/detail?moduleKey={moduleKey}&categorySlug={categorySlug}&slug={slug}" in ctx


def test_format_catalog_context_contains_items(recognizer):
    catalog = recognizer._load_catalog()
    items = [i for m in catalog for i in m["items"]]
    if not items:
        pytest.skip("no published content in DB")
    ctx = recognizer.format_catalog_context()
    first = items[0]
    assert first["title"] in ctx
    assert first["slug"] in ctx


def test_format_matches_context_ranks_candidates(recognizer):
    matches = [
        {"moduleKey": "products", "moduleName": "产品中心", "id": 1,
         "title": "智慧招采平台", "slug": "smart-procurement",
         "categorySlug": None, "keywords": ["招采"], "geoSummary": "全流程采购管理平台",
         "faqs": [], "similarity": 0.92,
         "canonicalUrl": "https://www.example.cn/list/detail?moduleKey=products&slug=smart-procurement"},
        {"moduleKey": "solutions", "moduleName": "解决方案", "id": 2,
         "title": "国企采购数字化方案", "slug": "state-procurement",
         "categorySlug": "finance", "keywords": ["采购数字化"],
         "geoSummary": "", "faqs": [], "similarity": 0.71,
         "canonicalUrl": "https://www.example.cn/list/category/detail?moduleKey=solutions&categorySlug=finance&slug=state-procurement"},
    ]
    ctx = recognizer.format_catalog_context(matches=matches)
    assert "语义匹配" in ctx
    assert "智慧招采平台" in ctx
    assert "https://www.example.cn/list/detail?moduleKey=products&slug=smart-procurement" in ctx
    assert "https://www.example.cn/list/category/detail?moduleKey=solutions&categorySlug=finance&slug=state-procurement" in ctx
    assert "Canonical URL" in ctx
    assert "/list/detail?moduleKey={moduleKey}&slug={slug}" in ctx
    assert "/list/category/detail?moduleKey={moduleKey}&categorySlug={categorySlug}&slug={slug}" in ctx
    assert "全流程采购管理平台" in ctx


def test_match_text_contains_word_bank_fields(recognizer):
    catalog = recognizer._load_catalog()
    for m in catalog:
        for item in m["items"]:
            assert "matchText" in item
            assert isinstance(item["matchText"], str)
