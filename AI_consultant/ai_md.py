"""
/ai/md 动态 Markdown 页面（GEO .md 版本）。

为每个可导航页面提供纯净的 Markdown 版本，遵循 llmstxt.org 提案：
原始页面 URL → Markdown 版本：base + /ai/md + 原路径与查询。
内容由数据库实时渲染（seo_configs / core_modules / content_categories /
content_items / about_sections / faqs / contacts），无需前端构建。

顶部使用 llms-txt 包解析 llms.txt（parse_llms_file），提取站点标题/摘要
作为 Markdown 页面的统一上下文头（站点身份 + blockquote 摘要）。
"""
import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from db import get_db

logger = logging.getLogger("ai_md")

router = APIRouter()

SITE_NAME = "圣诺联合"
SITE_FULL_NAME = "河北圣诺联合科技有限公司"
SITE_DESCRIPTION = (
    "中国领先的企业数字基础设施服务商，专注于为政府、国企和企业客户提供智慧招采平台、"
    "可信数据空间、分布式数据治理、区块链可信基础设施和AI智能体应用等数字化转型解决方案。"
)
SITE_URL = "https://www.example.cn"
BASE_URL_CONFIG_KEY = "seo_site_url"

MD_CTX_HEADER = (
    "> **站点**：{site} · {desc}\n\n"
    "> 本文是 {site} 官网页面的 Markdown 版本，与网页内容一致，供大语言模型直接阅读。\n\n"
)


# ── llms.txt 读取（与 main.py 一致的探测路径） ─────────────────────

def _read_llms_txt() -> str:
    candidates = []
    env_path = os.getenv("LLMS_TXT_PATH", "").strip()
    if env_path:
        candidates.append(env_path)
    candidates += ["../frontend/dist/llms.txt", "../frontend/public/llms.txt"]
    for p in candidates:
        try:
            path = Path(p)
            if not path.is_absolute():
                path = Path.cwd() / path
            if path.exists():
                text = path.read_text(encoding="utf-8")
                if text.startswith("\ufeff"):
                    text = text[1:]
                return text
        except Exception as e:
            logger.warning("Failed to read llms.txt (%s): %s", p, e)
    return ""


def _llms_ctx() -> str:
    """用 llms-txt 包解析 llms.txt，返回站点标题 + 摘要组成的上下文头；
    包缺失或解析失败时退化为静态站点信息。"""
    content = _read_llms_txt().strip()
    title = SITE_FULL_NAME
    desc = SITE_DESCRIPTION
    if content:
        try:
            from llms_txt import parse_llms_file
            parsed = parse_llms_file(content)
            if parsed is not None:
                t = getattr(parsed, "title", None)
                if t:
                    title = str(t).strip() or title
                # sections 是 dict[section_name -> list[Link]]，无 description 字段；
                # 摘要取 blockquote 的首行（若 parse 未暴露，保留默认）。
        except Exception as e:
            logger.warning("llms-txt parse failed, using static site info: %s", e)
    return MD_CTX_HEADER.format(site=title, desc=desc)


# ── 站点基址（与后端 SeoSyncService.currentBaseUrl 同源） ───────────

def _base_url() -> str:
    try:
        with get_db() as db:
            row = db.execute(
                "SELECT config_value FROM system_configs WHERE config_key = :k",
                {"k": BASE_URL_CONFIG_KEY},
            ).fetchone()
            if row and row[0] and str(row[0]).strip():
                return str(row[0]).strip()
    except Exception as e:
        logger.warning("Failed to read seo_site_url: %s", e)
    return SITE_URL


# ── HTML → Markdown ──────────────────────────────────────────────

def _html_to_md(html: str) -> str:
    if not html or not html.strip():
        return ""
    try:
        from markdownify import markdownify as _m2md
        return _m2md(html, heading_style="ATX", bullets="-").strip()
    except Exception:
        pass
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        return soup.get_text("\n").strip()
    except Exception:
        import re
        return re.sub(r"<[^>]+>", "", html).strip()


# ── URL 辅助 ─────────────────────────────────────────────────────

def _query(param: str) -> str:
    return f"?{param}" if param else ""


def _category_url(base: str, module_key: str, category_slug: str = "") -> str:
    if category_slug:
        return f"{base}/list/category?moduleKey={module_key}&categorySlug={category_slug}"
    return f"{base}/list/category?moduleKey={module_key}"


def _md_url(base: str, path: str, query: str = "") -> str:
    q = _query(query)
    return f"{base}/ai/md{path}{q}"


def _append_keywords(sb: list, keywords) -> None:
    """页面 SEO 关键词（seo_configs.keywords，逗号分隔）输出为独立段，便于 LLM 理解页面主题。"""
    if keywords and str(keywords).strip():
        sb.append(f"**关键词**：{str(keywords).strip()}\n")


# ── 数据查询（表缺失时静默降级） ─────────────────────────────────

def _q(db, sql: str, params=None) -> list:
    try:
        return db.execute(sql, params or {}).fetchall()
    except Exception as e:
        logger.warning("ai_md query failed: %s", e)
        return []


def _q1(db, sql: str, params=None):
    rows = _q(db, sql, params)
    return rows[0] if rows else None


# ── 各页面渲染 ────────────────────────────────────────────────────

def _render_home() -> str:
    base = _base_url()
    with get_db() as db:
        modules = _q(db, "SELECT module_key, module_name, module_title, module_description "
                         "FROM core_modules WHERE status = 1 AND deleted = 0 ORDER BY sort_order, id")
        contacts = _q(db, "SELECT type, value FROM contacts ORDER BY sort_order, id")

        cfg = _q1(db, "SELECT title, description, geo_summary, keywords FROM seo_configs "
                      "WHERE page_type = 'home' AND enabled = 1 ORDER BY id LIMIT 1")

    sb = [_llms_ctx()]
    title = (cfg[0] if cfg else None) or "企业数字基础设施服务商"
    desc = (cfg[1] if cfg else None) or SITE_DESCRIPTION
    if cfg and cfg[2] and str(cfg[2]).strip():
        desc = str(cfg[2]).strip()
    sb.append(f"# {SITE_FULL_NAME}\n")
    sb.append(f"> {desc}\n")
    _append_keywords(sb, cfg[3] if cfg else None)
    sb.append("\n## 核心业务\n")
    for m in modules:
        title_m = (m[2] or m[1])
        desc_m = m[3] or ""
        link = _md_url(base, "/list/category", f"moduleKey={m[0]}")
        sb.append(f"- [{title_m}]({link})" + (f": {desc_m}" if desc_m else ""))
    sb.append("\n## 关于我们\n")
    sb.append(f"- [关于我们]({_md_url(base, '/about')})")
    sb.append("\n## 常见问题\n")
    sb.append(f"- [常见问题]({_md_url(base, '/faqs')})")
    if contacts:
        sb.append("\n## 联系方式\n")
        for c in contacts:
            sb.append(f"- **{c[0]}**：{c[1]}")
    return "\n".join(sb) + "\n"


def _render_about() -> str:
    base = _base_url()
    with get_db() as db:
        sections = _q(db, "SELECT section_type, title, subtitle, description, extra_data "
                          "FROM about_sections WHERE status = 1 ORDER BY sort_order, id")
        contacts = _q(db, "SELECT type, value FROM contacts ORDER BY sort_order, id")
        cfg = _q1(db, "SELECT title, description, geo_summary, keywords FROM seo_configs "
                      "WHERE page_type = 'about' AND enabled = 1 ORDER BY id LIMIT 1")

    sb = [_llms_ctx()]
    if cfg:
        sb.append(f"# {cfg[0] or '关于我们'}\n")
        if cfg[2] and str(cfg[2]).strip():
            sb.append(f"> {cfg[2]}\n")
        elif cfg[1]:
            sb.append(f"> {cfg[1]}\n")
        _append_keywords(sb, cfg[3])
    else:
        sb.append("# 关于我们\n")

    desc_paras = []
    culture = []
    milestones = []
    contact_items = []
    for s in sections:
        st = s[0] or ""
        title = s[1] or ""
        subtitle = s[2] or ""
        description = s[3] or ""
        extra = s[4] or ""
        if st == "description":
            if description:
                desc_paras.append(description)
            elif title:
                desc_paras.append(title)
        elif st == "culture":
            culture.append((title, subtitle or description))
        elif st == "milestone":
            milestones.append((title, subtitle, description))
        elif st == "contact":
            contact_items.append((title, subtitle or description, extra))
    for c in contacts:
        contact_items.append((c[0], c[1], ""))

    if desc_paras:
        sb.append("\n".join(f"{p}\n" for p in desc_paras))
    if culture:
        sb.append("\n## 企业文化\n")
        for t, d in culture:
            sb.append(f"- **{t}**：{d}")
    if milestones:
        sb.append("\n## 发展历程\n")
        for year, t, d in milestones:
            line = f"- **{year}** {t}" if t else f"- **{year}**"
            if d:
                line += f"：{d}"
            sb.append(line)
    if contact_items:
        sb.append("\n## 联系我们\n")
        for label, value, _icon in contact_items:
            sb.append(f"- **{label}**：{value}")
    return "\n".join(sb) + "\n"


def _render_faqs() -> str:
    base = _base_url()
    with get_db() as db:
        faqs = _q(db, "SELECT question, answer, category FROM faqs "
                      "WHERE status = 1 AND deleted = 0 ORDER BY sort_order, id")
        cfg = _q1(db, "SELECT title, description, geo_summary, keywords FROM seo_configs "
                      "WHERE page_type = 'faq' AND enabled = 1 ORDER BY id LIMIT 1")

    sb = [_llms_ctx()]
    if cfg:
        sb.append(f"# {cfg[0] or '常见问题'}\n")
        if cfg[2] and str(cfg[2]).strip():
            sb.append(f"> {cfg[2]}\n")
        elif cfg[1]:
            sb.append(f"> {cfg[1]}\n")
        _append_keywords(sb, cfg[3])
    else:
        sb.append("# 常见问题\n")

    if not faqs:
        sb.append("暂无常见问题。")
    for f in faqs:
        sb.append(f"**问：{f[0]}**\n\n{f[1]}\n")
    return "\n".join(sb) + "\n"


def _render_list(module_key: str, category_slug: str = "") -> str:
    base = _base_url()
    with get_db() as db:
        module = _q1(db, "SELECT module_key, module_name, module_title, module_description, module_type "
                         "FROM core_modules WHERE module_key = :k AND status = 1 AND deleted = 0",
                     {"k": module_key})
        if not module:
            raise HTTPException(status_code=404, detail="模块不存在或已禁用")

        cats = _q(db, "SELECT id, name, slug, description FROM content_categories "
                      "WHERE module_key = :k AND status = 1 AND deleted = 0 ORDER BY sort_order, id",
                  {"k": module_key})

        cat_id = None
        if category_slug:
            cat = _q1(db, "SELECT id, name FROM content_categories "
                          "WHERE module_key = :k AND slug = :s AND status = 1 AND deleted = 0",
                      {"k": module_key, "s": category_slug})
            if not cat:
                raise HTTPException(status_code=404, detail="分类不存在")
            cat_id = cat[0]

        sql_items = ("SELECT ci.title, ci.slug, ci.summary, cc.slug AS cat_slug "
                     "FROM content_items ci "
                     "LEFT JOIN content_categories cc ON cc.id = ci.category_id AND cc.status = 1 AND cc.deleted = 0 "
                     "WHERE ci.module_key = :k AND ci.status = 1 AND ci.deleted = 0")
        params = {"k": module_key}
        if cat_id:
            sql_items += " AND ci.category_id = :cid"
            params["cid"] = cat_id
        sql_items += " ORDER BY ci.sort_order, ci.id"
        items = _q(db, sql_items, params)

        cfg = _q1(db, "SELECT title, description, geo_summary, keywords FROM seo_configs "
                      "WHERE page_type = :k AND enabled = 1 ORDER BY id LIMIT 1", {"k": module_key})

    module_type = module[4]
    title_m = module[2] or module[1]
    desc_m = module[3] or ""

    sb = [_llms_ctx()]
    if cfg:
        sb.append(f"# {cfg[0] or title_m}\n")
        summary = (cfg[2] if cfg[2] and str(cfg[2]).strip() else None) or cfg[1] or desc_m
        if summary:
            sb.append(f"> {summary}\n")
        _append_keywords(sb, cfg[3])
    else:
        sb.append(f"# {title_m}\n")
        if desc_m:
            sb.append(f"> {desc_m}\n")

    if cats and not category_slug:
        sb.append("\n## 分类\n")
        for c in cats:
            link = _category_url(base, module_key, c[2])
            sb.append(f"- [{c[1]}]({link})" + (f": {c[3]}" if c[3] else ""))

    if not items:
        sb.append("\n暂无内容。")
    else:
        sb.append("\n## 内容\n")
        for it in items:
            title_i = it[0]
            summary_i = it[2] or ""
            if it[3] and module_type == 1:
                link = _md_url(base, "/list/category/detail",
                               f"moduleKey={module_key}&categorySlug={it[3]}&slug={it[1]}")
            else:
                link = _md_url(base, "/list/detail", f"moduleKey={module_key}&slug={it[1]}")
            sb.append(f"- [{title_i}]({link})" + (f": {summary_i}" if summary_i else ""))
    return "\n".join(sb) + "\n"


def _render_detail(module_key: str, slug: str) -> str:
    base = _base_url()
    with get_db() as db:
        item = _q1(db, "SELECT title, summary, content, module_key, author, published_at "
                       "FROM content_items WHERE module_key = :k AND slug = :s "
                       "AND status = 1 AND deleted = 0",
                   {"k": module_key, "s": slug})
        if not item:
            raise HTTPException(status_code=404, detail="内容不存在")
        item_id = _q1(db, "SELECT id FROM content_items WHERE module_key = :k AND slug = :s",
                      {"k": module_key, "s": slug})
        faqs = []
        if item_id:
            faqs = _q(db, "SELECT question, answer FROM seo_faqs WHERE page_id = :pid "
                          "ORDER BY sort_order, id", {"pid": item_id[0]})
        cfg = None
        if item_id:
            cfg = _q1(db, "SELECT title, description, geo_summary, keywords FROM seo_configs "
                          "WHERE page_type = :k AND page_id = :pid AND enabled = 1 ORDER BY id LIMIT 1",
                      {"k": module_key, "pid": item_id[0]})

    sb = [_llms_ctx()]
    sb.append(f"# {item[0]}\n")
    if item[1] and str(item[1]).strip():
        sb.append(f"> {item[1]}\n")
    _append_keywords(sb, cfg[3] if cfg else None)
    body = _html_to_md(item[2] or "")
    if body:
        sb.append("\n" + body + "\n")
    if faqs:
        sb.append("\n## 常见问题\n")
        for f in faqs:
            sb.append(f"**问：{f[0]}**\n\n{f[1]}\n")
    sb.append(f"\n- [返回列表]({_md_url(base, '/list/category', f'moduleKey={module_key}')})")
    return "\n".join(sb) + "\n"


# ── 路由 ──────────────────────────────────────────────────────────

@router.get("/md/", response_class=PlainTextResponse)
def md_home():
    return _render_home()


@router.get("/md/about", response_class=PlainTextResponse)
def md_about():
    return _render_about()


@router.get("/md/faqs", response_class=PlainTextResponse)
def md_faqs():
    return _render_faqs()


@router.get("/md/list/category", response_class=PlainTextResponse)
def md_list(moduleKey: str = Query(""), categorySlug: str = Query("")):
    if not moduleKey:
        raise HTTPException(status_code=400, detail="缺少 moduleKey 参数")
    return _render_list(moduleKey, categorySlug or "")


@router.get("/md/list/detail", response_class=PlainTextResponse)
def md_detail(moduleKey: str = Query(""), slug: str = Query("")):
    if not moduleKey or not slug:
        raise HTTPException(status_code=400, detail="缺少 moduleKey 或 slug 参数")
    return _render_detail(moduleKey, slug)


@router.get("/md/list/category/detail", response_class=PlainTextResponse)
def md_nested_detail(moduleKey: str = Query(""), categorySlug: str = Query(""), slug: str = Query("")):
    if not moduleKey or not categorySlug or not slug:
        raise HTTPException(status_code=400, detail="缺少 moduleKey / categorySlug / slug 参数")
    return _render_detail(moduleKey, slug)