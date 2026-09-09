package com.sinounion.service;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONUtil;
import com.sinounion.entity.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class KnowledgeSyncService {

    @Value("${AI_SERVICE_URL}")
    private String aiServiceUrl;

    @javax.annotation.PostConstruct
    public void init() {
        if (aiServiceUrl != null) {
            aiServiceUrl = aiServiceUrl.trim();
        }
    }

    public void syncContentItem(ContentItem item) {
        if (item.getStatus() == null || item.getStatus() != 1) {
            deleteContent(item.getModuleKey(), item.getId());
            return;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("标题：").append(notNull(item.getTitle())).append("\n");
        sb.append("模块：").append(notNull(item.getModuleKey())).append("\n");
        sb.append("摘要：").append(notNull(item.getSummary())).append("\n");
        sb.append("分组/分类：").append(notNull(item.getGroupName())).append("\n");
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
        String ctx = "模块：" + notNull(item.getModuleKey()) + " 标题：" + notNull(item.getTitle());
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
        syncDocument(item.getModuleKey(), item.getId(), item.getTitle(), sb.toString(),
                item.getFilePath(), new ArrayList<>(images.values()));
    }

    public void syncFaq(Faq f) {
        if (f.getStatus() == null || f.getStatus() != 1) {
            deleteContent("faq", f.getId());
            return;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("问题：").append(notNull(f.getQuestion())).append("\n");
        sb.append("答案：").append(notNull(f.getAnswer())).append("\n");
        sb.append("分类：").append(notNull(f.getCategory())).append("\n");
        if (f.getProductId() != null) {
            sb.append("关联产品ID：").append(f.getProductId()).append("\n");
        }
        syncDocument("faq", f.getId(), f.getQuestion(), sb.toString());
    }

    public void syncHomeSection(HomeSection s) {
        if (s.getStatus() == null || s.getStatus() != 1) {
            deleteContent("home_section", s.getId());
            return;
        }
        StringBuilder sb = new StringBuilder();
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
        syncDocument("home_section", s.getId(), s.getTitle(), sb.toString(), null, images);
    }

    public void syncAboutSection(AboutSection s) {
        if (s.getStatus() == null || s.getStatus() != 1) {
            deleteContent("about_section", s.getId());
            return;
        }
        StringBuilder sb = new StringBuilder();
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
        syncDocument("about_section", s.getId(), s.getTitle(), sb.toString(), null, images);
    }

    public void syncHomePage(String content) {
        syncDocument("home", 0L, "首页", notNull(content));
    }

    public void syncAboutPage(String content) {
        syncDocument("about", 0L, "关于我们", notNull(content));
    }

    public void syncBanner(Banner b) {
        if (b.getStatus() == null || b.getStatus() != 1) {
            deleteContent("banner", b.getId());
            return;
        }
        StringBuilder sb = new StringBuilder();
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
        syncDocument("banner", b.getId(), b.getTitle(), sb.toString(), null, images);
    }

    public void syncContactInfo(List<ContactInfo> contacts) {
        StringBuilder sb = new StringBuilder();
        sb.append("## 联系方式\n\n");
        for (ContactInfo c : contacts) {
            sb.append("- ").append(notNull(c.getType())).append("：").append(notNull(c.getValue())).append("\n");
        }
        syncDocument("contact_info", 0L, "联系方式", sb.toString());
    }

    public void deleteContent(String sourceType, Long sourceId) {
        try {
            String url = aiServiceUrl + "/ai/knowledge/sync-document/" + sourceType + "/" + sourceId;
            HttpResponse response = HttpRequest.delete(url).timeout(5000).execute();
            log.debug("Knowledge delete: sourceType={}, sourceId={}, status={}", sourceType, sourceId, response.getStatus());
        } catch (Exception e) {
            log.warn("Knowledge delete failed: sourceType={}, sourceId={}, error={}", sourceType, sourceId, e.getMessage());
        }
    }

    private void syncDocument(String sourceType, Long sourceId, String title, String content) {
        syncDocument(sourceType, sourceId, title, content, null, null);
    }

    private void syncDocument(String sourceType, Long sourceId, String title, String content,
                              String filePath, List<Map<String, Object>> images) {
        try {
            String url = aiServiceUrl + "/ai/knowledge/sync-document";
            Map<String, Object> body = new HashMap<>();
            body.put("kb_id", 1);
            body.put("source_type", sourceType);
            body.put("source_id", sourceId);
            body.put("title", title);
            body.put("content", content);
            if (filePath != null && !filePath.isEmpty()) {
                body.put("file_path", filePath);
            }
            if (images != null && !images.isEmpty()) {
                body.put("images", images);
            }

            String json = JSONUtil.toJsonStr(body);
            HttpResponse response = HttpRequest.post(url)
                    .body(json, "application/json")
                    .timeout(30000)
                    .execute();
            log.debug("Knowledge sync: sourceType={}, sourceId={}, status={}", sourceType, sourceId, response.getStatus());
        } catch (Exception e) {
            log.warn("Knowledge sync failed: sourceType={}, sourceId={}, error={}", sourceType, sourceId, e.getMessage());
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
