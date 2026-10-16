package com.sinounion.service;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.entity.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 将「内容管理」下的各来源内容写入 AI 知识库。
 *
 * <p>每个来源路由到独立的知识库（通过稳定的 kb_code 标识）：
 * <ul>
 *   <li>首页信息 / 关于页信息 / 联系方式 / FAQ / 版本配置：固定库</li>
 *   <li>每个核心模块：module:&lt;moduleKey&gt;（模块目录 + 无分类内容项）</li>
 *   <li>每个内容分类：category:&lt;categoryId&gt;（分类目录 + 该分类下内容项）</li>
 * </ul>
 * 内容项正文标注所属菜单/模块/分类/层级，模块与分类各生成一份目录文档记录其下子项。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeSyncService {

    // 固定知识库 code / 名称
    private static final String KB_HOME = "home";
    private static final String KB_HOME_NAME = "首页信息";
    private static final String KB_ABOUT = "about";
    private static final String KB_ABOUT_NAME = "关于页信息";
    private static final String KB_CONTACT = "contact";
    private static final String KB_CONTACT_NAME = "联系方式";
    private static final String KB_FAQ = "faq";
    private static final String KB_FAQ_NAME = "FAQ";
    private static final String KB_VERSION = "version";
    private static final String KB_VERSION_NAME = "版本配置";

    private static final String UNCATEGORIZED = "未分类";

    /** 单文档同步（含向量化）超时：足够长，避免大批量向量化被中断 */
    private static final int SYNC_TIMEOUT_MS = 1_800_000;

    private final AiRequestSigner aiRequestSigner;
    private final CoreModuleService coreModuleService;
    private final ContentCategoryService contentCategoryService;
    private final ContentItemService contentItemService;

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    @javax.annotation.PostConstruct
    public void init() {
        if (aiServiceUrl != null) {
            aiServiceUrl = aiServiceUrl.trim();
        }
    }

    // ── 内容项 ────────────────────────────────────────────────

    public void syncContentItem(ContentItem item) {
        if (item.getStatus() == null || item.getStatus() != 1) {
            deleteContent(item.getModuleKey(), item.getId());
            return;
        }
        CoreModule module = coreModuleService.getByKey(item.getModuleKey());
        String moduleName = module != null ? notNull(module.getModuleName()) : notNull(item.getModuleKey());
        ContentCategory category = item.getCategoryId() != null ? contentCategoryService.getById(item.getCategoryId()) : null;
        boolean hasCategory = category != null && (category.getStatus() == null || category.getStatus() == 1);
        String categoryName = hasCategory ? notNull(category.getName()) : notNull(item.getGroupName());
        if (!hasCategory) category = null;

        StringBuilder sb = new StringBuilder();
        sb.append("菜单/模块：").append(moduleName).append("（").append(notNull(item.getModuleKey())).append("）\n");
        sb.append("分类：").append(categoryName.isEmpty() ? UNCATEGORIZED : categoryName).append("\n");
        sb.append("层级：").append(moduleName).append(" > ").append(categoryName.isEmpty() ? UNCATEGORIZED : categoryName).append("\n");
        sb.append("标题：").append(notNull(item.getTitle())).append("\n");
        sb.append("摘要：").append(notNull(item.getSummary())).append("\n");
        sb.append("作者：").append(notNull(item.getAuthor())).append("\n");
        sb.append("来源：").append(notNull(item.getSource())).append("\n");
        if (item.getCoverImage() != null && !item.getCoverImage().isEmpty()) {
            sb.append("封面图：").append(item.getCoverImage()).append("\n");
        }
        if (item.getFilePath() != null && !item.getFilePath().isEmpty()) {
            sb.append("关联文档路径：").append(item.getFilePath());
            if (item.getFileName() != null && !item.getFileName().isEmpty()) {
                sb.append("（").append(item.getFileName()).append("）");
            }
            sb.append("\n");
        }
        String block = blockText(item.getExtraData());
        if (block.isEmpty()) block = stripHtml(item.getContent());
        if (!block.isEmpty()) sb.append("详细内容：").append(block).append("\n");

        // 收集需要向量化的图片（封面图 + 富文本正文图片），按 URL 去重
        String ctx = "模块：" + moduleName + " 标题：" + notNull(item.getTitle());
        Map<String, Map<String, Object>> images = new java.util.LinkedHashMap<>();
        if (item.getCoverImage() != null && !item.getCoverImage().isEmpty()) {
            images.put(item.getCoverImage(), imageEntry(item.getCoverImage(), "封面图。" + ctx));
        }
        if (item.getContent() != null && !item.getContent().isEmpty()) {
            for (Map<String, Object> img : extractImagesFromHtml(item.getContent(), "内容图片。" + ctx)) {
                images.putIfAbsent(String.valueOf(img.get("url")), img);
            }
        }
        if (item.getExtraData() != null && !item.getExtraData().isEmpty()) {
            for (Map<String, Object> img : extractImagesFromHtml(item.getExtraData(), "内容图片。" + ctx)) {
                images.putIfAbsent(String.valueOf(img.get("url")), img);
            }
            for (Map<String, Object> img : extractImagesFromSections(item.getExtraData(), "内容图片。" + ctx)) {
                images.putIfAbsent(String.valueOf(img.get("url")), img);
            }
        }

        String kbCode;
        String kbName;
        if (hasCategory) {
            kbCode = "category:" + category.getId();
            kbName = moduleName + " - " + categoryName;
        } else {
            kbCode = "module:" + item.getModuleKey();
            kbName = moduleName;
        }
        syncDocument(item.getModuleKey(), item.getId(), item.getTitle(), sb.toString(),
                item.getFilePath(), new ArrayList<>(images.values()), kbCode, kbName);
    }

    // ── 核心模块 / 内容分类（目录文档）─────────────────────────

    public void syncCoreModule(CoreModule module) {
        if (module == null) return;
        boolean enabled = module.getStatus() != null && module.getStatus() == 1;
        if (!enabled) {
            deleteModuleKnowledge(module);
            return;
        }
        String moduleName = notNull(module.getModuleName());
        List<ContentCategory> categories = contentCategoryService.getActive(module.getModuleKey());
        List<ContentItem> items = contentItemService.getItems(
                module.getModuleKey(), 1, Integer.MAX_VALUE, null, null, null, 1, null).getRecords();

        StringBuilder sb = new StringBuilder();
        sb.append("模块名称：").append(moduleName).append("\n");
        sb.append("模块标识：").append(notNull(module.getModuleKey())).append("\n");
        if (module.getModuleTitle() != null && !module.getModuleTitle().isEmpty()) {
            sb.append("模块标题：").append(module.getModuleTitle()).append("\n");
        }
        if (module.getModuleDescription() != null && !module.getModuleDescription().isEmpty()) {
            sb.append("模块描述：").append(stripHtml(module.getModuleDescription())).append("\n");
        }
        if (module.getPath() != null && !module.getPath().isEmpty()) {
            sb.append("页面路径：").append(module.getPath()).append("\n");
        }
        sb.append("下属分类：\n");
        if (categories.isEmpty()) {
            sb.append("- （无）\n");
        } else {
            for (ContentCategory c : categories) {
                sb.append("- ").append(notNull(c.getName())).append("（分类id：").append(c.getId()).append("）\n");
            }
        }
        sb.append("直属内容项（无分类）：\n");
        boolean anyDirect = false;
        for (ContentItem i : items) {
            if (i.getCategoryId() == null) {
                sb.append("- ").append(notNull(i.getTitle())).append("（id：").append(i.getId()).append("）\n");
                anyDirect = true;
            }
        }
        if (!anyDirect) sb.append("- （无）\n");

        syncDocument("core_module", module.getId(), "模块目录：" + moduleName, sb.toString().trim(),
                null, null, "module:" + module.getModuleKey(), moduleName,
                "核心模块「" + moduleName + "」的模块信息与目录");
    }

    public void syncContentCategory(ContentCategory category) {
        if (category == null) return;
        boolean enabled = category.getStatus() == null || category.getStatus() == 1;
        if (!enabled) {
            deleteCategoryKnowledge(category);
            return;
        }
        CoreModule module = coreModuleService.getByKey(category.getModuleKey());
        String moduleName = module != null ? notNull(module.getModuleName()) : notNull(category.getModuleKey());
        String categoryName = notNull(category.getName());
        List<ContentItem> items = contentItemService.getItems(
                category.getModuleKey(), 1, Integer.MAX_VALUE, null, null, category.getId(), 1, null).getRecords();

        StringBuilder sb = new StringBuilder();
        sb.append("分类名称：").append(categoryName).append("\n");
        sb.append("所属模块：").append(moduleName).append("（").append(notNull(category.getModuleKey())).append("）\n");
        sb.append("分类标识：").append(notNull(category.getSlug())).append("\n");
        if (category.getDescription() != null && !category.getDescription().isEmpty()) {
            sb.append("分类描述：").append(stripHtml(category.getDescription())).append("\n");
        }
        sb.append("本分类内容项：\n");
        if (items.isEmpty()) {
            sb.append("- （无）\n");
        } else {
            for (ContentItem i : items) {
                sb.append("- ").append(notNull(i.getTitle())).append("（id：").append(i.getId()).append("）\n");
            }
        }

        syncDocument("content_category", category.getId(),
                "分类目录：" + moduleName + " - " + categoryName, sb.toString().trim(),
                null, null, "category:" + category.getId(), moduleName + " - " + categoryName,
                "内容分类「" + moduleName + " - " + categoryName + "」的分类信息与目录");
    }

    // ── 固定来源 ──────────────────────────────────────────────

    public void syncFaq(Faq f) {
        if (f.getStatus() == null || f.getStatus() != 1) {
            deleteContent("faq", f.getId());
            return;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("菜单/模块：FAQ\n");
        sb.append("问题：").append(notNull(f.getQuestion())).append("\n");
        sb.append("答案：").append(notNull(f.getAnswer())).append("\n");
        sb.append("分类：").append(notNull(f.getCategory())).append("\n");
        if (f.getProductId() != null) {
            sb.append("关联产品ID：").append(f.getProductId()).append("\n");
        }
        syncDocument("faq", f.getId(), f.getQuestion(), sb.toString(), null, null, KB_FAQ, KB_FAQ_NAME);
    }

    public void syncHomeSection(HomeSection s) {
        if (s.getStatus() == null || s.getStatus() != 1) {
            deleteContent("home_section", s.getId());
            return;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("菜单/模块：首页信息\n");
        sb.append("区块类型：").append(notNull(s.getSectionType())).append("\n");
        sb.append("标题：").append(notNull(s.getTitle())).append("\n");
        sb.append("副标题：").append(notNull(s.getSubtitle())).append("\n");
        sb.append("描述：").append(notNull(s.getDescription())).append("\n");
        if (s.getImage() != null && !s.getImage().isEmpty()) {
            sb.append("图片：").append(s.getImage()).append("\n");
        }
        sb.append("排序：").append(s.getSortOrder() != null ? s.getSortOrder() : 0).append("\n");
        sb.append("扩展数据：").append(notNull(s.getExtraData()));
        List<Map<String, Object>> images = new ArrayList<>();
        if (s.getImage() != null && !s.getImage().isEmpty()) {
            images.add(imageEntry(s.getImage(), "首页区块图片。标题：" + notNull(s.getTitle())));
        }
        syncDocument("home_section", s.getId(), s.getTitle(), sb.toString(), null, images, KB_HOME, KB_HOME_NAME);
    }

    public void syncAboutSection(AboutSection s) {
        if (s.getStatus() == null || s.getStatus() != 1) {
            deleteContent("about_section", s.getId());
            return;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("菜单/模块：关于页信息\n");
        sb.append("区块类型：").append(notNull(s.getSectionType())).append("\n");
        sb.append("标题：").append(notNull(s.getTitle())).append("\n");
        sb.append("副标题：").append(notNull(s.getSubtitle())).append("\n");
        sb.append("描述：").append(notNull(s.getDescription())).append("\n");
        if (s.getImage() != null && !s.getImage().isEmpty()) {
            sb.append("图片：").append(s.getImage()).append("\n");
        }
        sb.append("排序：").append(s.getSortOrder() != null ? s.getSortOrder() : 0).append("\n");
        sb.append("扩展数据：").append(notNull(s.getExtraData()));
        List<Map<String, Object>> images = new ArrayList<>();
        if (s.getImage() != null && !s.getImage().isEmpty()) {
            images.add(imageEntry(s.getImage(), "关于区块图片。标题：" + notNull(s.getTitle())));
        }
        syncDocument("about_section", s.getId(), s.getTitle(), sb.toString(), null, images, KB_ABOUT, KB_ABOUT_NAME);
    }

    public void syncHomePage(String content) {
        syncDocument("home", 0L, "首页", notNull(content), null, null, KB_HOME, KB_HOME_NAME);
    }

    public void syncAboutPage(String content) {
        syncDocument("about", 0L, "关于我们", notNull(content), null, null, KB_ABOUT, KB_ABOUT_NAME);
    }

    public void syncBanner(Banner b) {
        if (b.getStatus() == null || b.getStatus() != 1) {
            deleteContent("banner", b.getId());
            return;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("菜单/模块：首页信息\n");
        sb.append("Banner标题：").append(notNull(b.getTitle())).append("\n");
        sb.append("副标题：").append(notNull(b.getSubtitle())).append("\n");
        if (b.getImage() != null && !b.getImage().isEmpty()) {
            sb.append("图片：").append(b.getImage()).append("\n");
        }
        if (b.getLinkUrl() != null && !b.getLinkUrl().isEmpty()) {
            sb.append("链接：").append(b.getLinkUrl()).append("\n");
        }
        List<Map<String, Object>> images = new ArrayList<>();
        if (b.getImage() != null && !b.getImage().isEmpty()) {
            images.add(imageEntry(b.getImage(), "Banner图片。标题：" + notNull(b.getTitle())));
        }
        syncDocument("banner", b.getId(), b.getTitle(), sb.toString(), null, images, KB_HOME, KB_HOME_NAME);
    }

    public void syncContactInfo(List<ContactInfo> contacts) {
        StringBuilder sb = new StringBuilder();
        sb.append("菜单/模块：联系方式\n\n");
        sb.append("## 联系方式\n\n");
        for (ContactInfo c : contacts) {
            sb.append("- ").append(notNull(c.getType())).append("：").append(notNull(c.getValue())).append("\n");
        }
        syncDocument("contact_info", 0L, "联系方式", sb.toString(), null, null, KB_CONTACT, KB_CONTACT_NAME);
    }

    public void syncFooterConfig(String content) {
        if (content == null || content.trim().isEmpty()) {
            deleteContent("home_footer", 0L);
            return;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("菜单/模块：首页信息（页脚）\n");
        try {
            cn.hutool.json.JSONObject o = JSONUtil.parseObj(content);
            appendLine(sb, "版权信息", o.getStr("copyright"));
            appendLine(sb, "ICP备案号", o.getStr("icpNumber"));
            appendLine(sb, "公安备案号", o.getStr("policeNumber"));
            cn.hutool.json.JSONArray extra = o.getJSONArray("extra");
            if (extra != null) {
                for (Object it : extra) {
                    if (!(it instanceof cn.hutool.json.JSONObject)) continue;
                    cn.hutool.json.JSONObject e = (cn.hutool.json.JSONObject) it;
                    appendLine(sb, e.getStr("label"), e.getStr("value"));
                }
            }
            cn.hutool.json.JSONArray qrcodes = o.getJSONArray("qrcodes");
            if (qrcodes != null) {
                for (Object it : qrcodes) {
                    if (!(it instanceof cn.hutool.json.JSONObject)) continue;
                    cn.hutool.json.JSONObject q = (cn.hutool.json.JSONObject) it;
                    appendLine(sb, "二维码", q.getStr("label"));
                }
            }
            cn.hutool.json.JSONArray links = o.getJSONArray("links");
            if (links != null) {
                for (Object it : links) {
                    if (!(it instanceof cn.hutool.json.JSONObject)) continue;
                    cn.hutool.json.JSONObject l = (cn.hutool.json.JSONObject) it;
                    appendLine(sb, l.getStr("name"), l.getStr("url"));
                }
            }
        } catch (Exception e) {
            sb.append(notNull(content));
        }
        syncDocument("home_footer", 0L, "页脚", sb.toString().trim(), null, null, KB_HOME, KB_HOME_NAME);
    }

    /** 版本管理配置（ai_website_config）同步到「版本配置」库 */
    public void syncVersionConfig(String content) {
        if (content == null || content.trim().isEmpty()) {
            deleteContent("version_config", 0L);
            return;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("菜单/模块：版本管理\n");
        sb.append("版本配置：\n").append(content);
        syncDocument("version_config", 0L, "版本配置", sb.toString(), null, null, KB_VERSION, KB_VERSION_NAME);
    }

    // ── 删除 ──────────────────────────────────────────────────

    /** 删除单个来源的知识库文档。 */
    public void deleteContent(String sourceType, Long sourceId) {
        try {
            String url = aiServiceUrl + "/ai/knowledge/sync-document/" + sourceType + "/" + sourceId;
            HttpRequest request = HttpRequest.delete(url).timeout(5000);
            aiRequestSigner.sign(request);
            HttpResponse response = request.execute();
            log.debug("Knowledge delete: sourceType={}, sourceId={}, status={}", sourceType, sourceId, response.getStatus());
        } catch (Exception e) {
            log.warn("Knowledge delete failed: sourceType={}, sourceId={}, error={}", sourceType, sourceId, e.getMessage());
        }
    }

    /** 删除模块相关知识库：模块目录、其下分类目录与内容项文档，并删除对应知识库。 */
    public void deleteModuleKnowledge(CoreModule module) {
        if (module == null) return;
        String moduleKey = module.getModuleKey();
        deleteContent("core_module", module.getId());
        deleteKbByCode("module:" + moduleKey);
        if (moduleKey != null && !moduleKey.isEmpty()) {
            for (ContentCategory c : contentCategoryService.getCategories(moduleKey)) {
                deleteContent("content_category", c.getId());
                deleteKbByCode("category:" + c.getId());
            }
            for (ContentItem item : contentItemService.getItems(
                    moduleKey, 1, Integer.MAX_VALUE, null, null, null, null, null).getRecords()) {
                deleteContent(moduleKey, item.getId());
            }
        }
    }

    /** 删除分类相关知识库：分类目录与知识库。 */
    public void deleteCategoryKnowledge(ContentCategory category) {
        if (category == null) return;
        deleteContent("content_category", category.getId());
        deleteKbByCode("category:" + category.getId());
    }

    /** 清空旧的「网站内容」（id=1）知识库。 */
    public void clearWebsiteKb() {
        try {
            String url = aiServiceUrl + "/ai/knowledge-bases/1/clear";
            HttpRequest request = HttpRequest.post(url).timeout(10000);
            aiRequestSigner.sign(request);
            HttpResponse response = request.execute();
            log.info("Cleared website knowledge base, status={}", response.getStatus());
        } catch (Exception e) {
            log.warn("Clear website knowledge base failed: {}", e.getMessage());
        }
    }

    /** 按 code 删除知识库（模块/分类删除时调用）。 */
    public void deleteKbByCode(String code) {
        if (code == null || code.isEmpty()) return;
        try {
            String url = aiServiceUrl + "/ai/knowledge-bases/by-code/" + code;
            HttpRequest request = HttpRequest.delete(url).timeout(5000);
            aiRequestSigner.sign(request);
            HttpResponse response = request.execute();
            log.debug("Delete knowledge base by code: code={}, status={}", code, response.getStatus());
        } catch (Exception e) {
            log.warn("Delete knowledge base by code failed: code={}, error={}", code, e.getMessage());
        }
    }

    // ── 底层同步 ──────────────────────────────────────────────

    private void syncDocument(String sourceType, Long sourceId, String title, String content,
                              String filePath, List<Map<String, Object>> images,
                              String kbCode, String kbName) {
        syncDocument(sourceType, sourceId, title, content, filePath, images, kbCode, kbName, null);
    }

    private void syncDocument(String sourceType, Long sourceId, String title, String content,
                              String filePath, List<Map<String, Object>> images,
                              String kbCode, String kbName, String kbDescription) {
        try {
            String url = aiServiceUrl + "/ai/knowledge/sync-document";
            Map<String, Object> body = new HashMap<>();
            body.put("source_type", sourceType);
            body.put("source_id", sourceId);
            body.put("title", title);
            body.put("content", content);
            if (kbCode != null && !kbCode.isEmpty()) {
                body.put("kb_code", kbCode);
                body.put("kb_name", kbName);
                if (kbDescription != null && !kbDescription.isEmpty()) {
                    body.put("kb_description", kbDescription);
                }
            } else {
                body.put("kb_id", 1);
            }
            if (filePath != null && !filePath.isEmpty()) {
                body.put("file_path", filePath);
            }
            if (images != null && !images.isEmpty()) {
                body.put("images", images);
            }

            String json = JSONUtil.toJsonStr(body);
            HttpRequest request = HttpRequest.post(url)
                    .body(json, "application/json")
                    .timeout(SYNC_TIMEOUT_MS);
            aiRequestSigner.sign(request);
            HttpResponse response = request.execute();
            log.debug("Knowledge sync: sourceType={}, sourceId={}, kbCode={}, status={}",
                    sourceType, sourceId, kbCode, response.getStatus());
        } catch (Exception e) {
            log.warn("Knowledge sync failed: sourceType={}, sourceId={}, error={}", sourceType, sourceId, e.getMessage());
        }
    }

    private static void appendLine(StringBuilder sb, String label, String value) {
        if (label != null && !label.trim().isEmpty() && value != null && !value.trim().isEmpty()) {
            sb.append(label).append("：").append(value).append("\n");
        }
    }

    private static Map<String, Object> imageEntry(String url, String caption) {
        Map<String, Object> m = new HashMap<>();
        m.put("url", url);
        m.put("caption", caption);
        return m;
    }

    /** 从富文本 HTML 中提取 <img src="..."> 图片地址（跳过 data: 内联图） */
    private static List<Map<String, Object>> extractImagesFromHtml(String html, String caption) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (html == null || html.isEmpty()) return out;
        Pattern p = Pattern.compile("<img[^>]+src=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(html);
        while (m.find()) {
            String src = m.group(1);
            if (src == null || src.startsWith("data:")) continue;
            out.add(imageEntry(src, caption));
        }
        return out;
    }

    private static String notNull(String s) {
        return s == null ? "" : s;
    }

    /** 从区块 extraData JSON 中提取可读文本，用于知识库同步（兼容 sections 多组 / {data} 旧格式） */
    private static String blockText(String extraData) {
        if (extraData == null || extraData.trim().isEmpty()) return "";
        try {
            StringBuilder sb = new StringBuilder();
            Object obj = JSONUtil.parse(extraData);
            if (obj instanceof cn.hutool.json.JSONObject) {
                cn.hutool.json.JSONObject o = (cn.hutool.json.JSONObject) obj;
                cn.hutool.json.JSONArray sections = o.getJSONArray("sections");
                if (sections != null) {
                    for (Object s : sections) {
                        if (!(s instanceof cn.hutool.json.JSONObject)) continue;
                        cn.hutool.json.JSONObject sec = (cn.hutool.json.JSONObject) s;
                        Object dataObj = sec.get("data");
                        if (dataObj instanceof cn.hutool.json.JSONObject) {
                            appendSectionText(sb, (cn.hutool.json.JSONObject) dataObj);
                        }
                    }
                    return sb.toString().trim();
                }
                Object dataObj = o;
                if (o.containsKey("data")) dataObj = o.get("data");
                if (dataObj instanceof cn.hutool.json.JSONObject) {
                    appendSectionText(sb, (cn.hutool.json.JSONObject) dataObj);
                }
            }
            return sb.toString().trim();
        } catch (Exception e) {
            return "";
        }
    }

    private static void appendSectionText(StringBuilder sb, cn.hutool.json.JSONObject d) {
        if (d.getStr("content") != null) {
            sb.append(stripHtml(d.getStr("content"))).append("\n");
        }
        if (d.getJSONArray("rows") != null) {
            d.getJSONArray("rows").forEach(r -> sb.append(JSONUtil.toJsonStr(r)).append("\n"));
        }
        if (d.getJSONArray("items") != null) {
            for (Object it : d.getJSONArray("items")) {
                cn.hutool.json.JSONObject item = (cn.hutool.json.JSONObject) it;
                sb.append(notNull(item.getStr("title"))).append("：").append(stripHtml(notNull(item.getStr("description")))).append("\n");
            }
        }
        if (d.getJSONArray("groups") != null) {
            for (Object g : d.getJSONArray("groups")) {
                cn.hutool.json.JSONObject grp = (cn.hutool.json.JSONObject) g;
                sb.append(notNull(grp.getStr("title"))).append("：").append(stripHtml(notNull(grp.getStr("description")))).append("\n");
            }
        }
        if (d.getJSONArray("timeline") != null) {
            for (Object t : d.getJSONArray("timeline")) {
                cn.hutool.json.JSONObject node = (cn.hutool.json.JSONObject) t;
                sb.append(notNull(node.getStr("date"))).append("：").append(stripHtml(notNull(node.getStr("content")))).append("\n");
            }
        }
    }

    /** 从内容项 extraData 的 sections 中提取结构化图片（图文组/轮播项），供图片向量化 */
    private static List<Map<String, Object>> extractImagesFromSections(String extraData, String caption) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (extraData == null || extraData.trim().isEmpty()) return out;
        try {
            Object obj = JSONUtil.parse(extraData);
            if (!(obj instanceof cn.hutool.json.JSONObject)) return out;
            cn.hutool.json.JSONObject o = (cn.hutool.json.JSONObject) obj;
            cn.hutool.json.JSONArray sections = o.getJSONArray("sections");
            if (sections == null) return out;
            for (Object s : sections) {
                if (!(s instanceof cn.hutool.json.JSONObject)) continue;
                cn.hutool.json.JSONObject sec = (cn.hutool.json.JSONObject) s;
                Object dataObj = sec.get("data");
                if (!(dataObj instanceof cn.hutool.json.JSONObject)) continue;
                cn.hutool.json.JSONObject d = (cn.hutool.json.JSONObject) dataObj;
                if (d.getJSONArray("groups") != null) {
                    for (Object g : d.getJSONArray("groups")) {
                        cn.hutool.json.JSONObject grp = (cn.hutool.json.JSONObject) g;
                        String img = grp.getStr("image");
                        if (img != null && !img.isEmpty()) out.add(imageEntry(img, caption));
                    }
                }
                if (d.getJSONArray("items") != null) {
                    for (Object it : d.getJSONArray("items")) {
                        cn.hutool.json.JSONObject item = (cn.hutool.json.JSONObject) it;
                        String img = item.getStr("image");
                        if (img != null && !img.isEmpty()) out.add(imageEntry(img, caption));
                    }
                }
            }
        } catch (Exception e) {
            // 忽略解析失败
        }
        return out;
    }

    private static String stripHtml(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }
}
