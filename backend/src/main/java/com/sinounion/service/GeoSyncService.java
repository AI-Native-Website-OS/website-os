package com.sinounion.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.entity.CoreModule;
import com.sinounion.entity.SeoConfig;
import com.sinounion.entity.SeoFaq;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.CoreModuleMapper;
import com.sinounion.mapper.SeoConfigMapper;
import com.sinounion.mapper.SeoFaqMapper;
import com.sinounion.mapper.SystemConfigMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GEO 文件生成器：依据 seo_configs（enabled=1）生成 llms.txt / llms-full.txt / robots.txt / sitemap.xml，
 * 并同步写入前端 public 与 dist 目录（与 AdminFileController 双写逻辑一致）。
 *
 * llms.txt 遵循 llmstxt.org 开放提案：H1(站点全称) → blockquote(核心摘要) → 要点列表(intro) →
 * ## Table of Contents 下 ### 链接分组（品牌/各模块标题/常见问题）→ 联系方式 → 追加段 →
 * ## Optional(geo_optional=1，置于文件末尾)。
 * llms-full.txt 将 Optional 条目内联回各自分组（等价 llms_txt2ctx --optional True）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GeoSyncService {

    public static final String LLMS_INTRO_KEY = "geo_llms_intro";
    public static final String LLMS_APPEND_KEY = "geo_llms_append";

    private final SeoConfigMapper seoConfigMapper;
    private final CoreModuleMapper coreModuleMapper;
    private final SeoFaqMapper seoFaqMapper;
    private final SystemConfigMapper systemConfigMapper;
    private final SeoSyncService seoSyncService;
    private final SiteConfigService siteConfigService;

    @Value("${APP_FRONTEND_PUBLIC_DIR}")
    private String frontendPublicDir;

    @Value("${app.frontend-dist-dir:../frontend/dist}")
    private String frontendDistDir;

    public static class GeoFilesContent {
        public final String llmsTxt;
        public final String llmsFullTxt;
        public final String robotsTxt;
        public final String sitemapXml;

        GeoFilesContent(String llmsTxt, String llmsFullTxt, String robotsTxt, String sitemapXml) {
            this.llmsTxt = llmsTxt;
            this.llmsFullTxt = llmsFullTxt;
            this.robotsTxt = robotsTxt;
            this.sitemapXml = sitemapXml;
        }
    }

    /** 生成四份文件内容（不落盘），供后台预览。 */
    public GeoFilesContent generate() {
        String llms = buildLlmsTxt(false);
        String llmsFull = buildLlmsTxt(true);
        String robots = buildRobotsTxt();
        String sitemap = buildSitemapXml();
        return new GeoFilesContent(llms, llmsFull, robots, sitemap);
    }

    /** 生成并写入 public 与 dist 目录（四份全部双写），返回写入路径。 */
    public Map<String, String> generateAndWrite() throws IOException {
        GeoFilesContent content = generate();
        Map<String, String> paths = new LinkedHashMap<>();
        paths.put("llms.txt", writeFile("llms.txt", content.llmsTxt, true));
        paths.put("llms-full.txt", writeFile("llms-full.txt", content.llmsFullTxt, true));
        paths.put("robots.txt", writeFile("robots.txt", content.robotsTxt, true));
        paths.put("sitemap.xml", writeFile("sitemap.xml", content.sitemapXml, false));
        return paths;
    }

    /** 容错版自动重生成：SEO 配置增/删/改后调用，写盘失败仅告警不抛错。 */
    public void refreshFilesQuietly() {
        try {
            generateAndWrite();
        } catch (IOException e) {
            log.warn("自动重生成 llms.txt / llms-full.txt / robots.txt / sitemap.xml 失败: {}", e.getMessage());
        }
    }

    /**
     * 写 UTF-8 文本到 public 与 dist 双份。llms.txt / robots.txt 需前置 UTF-8 BOM
     * （nginx 以 text/plain 无 charset 头静态服务，否则浏览器按本地默认编码解码导致中文乱码）；
     * sitemap.xml 为带 encoding 声明的 XML，无需 BOM。
     */
    private String writeFile(String filename, String content, boolean bom) throws IOException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bom) {
            byte[] withBom = new byte[bytes.length + 3];
            withBom[0] = (byte) 0xEF;
            withBom[1] = (byte) 0xBB;
            withBom[2] = (byte) 0xBF;
            System.arraycopy(bytes, 0, withBom, 3, bytes.length);
            bytes = withBom;
        }

        Path publicPath = resolvePath(frontendPublicDir, filename);
        Files.createDirectories(publicPath.getParent());
        Files.write(publicPath, bytes);

        Path distPath = resolvePath(frontendDistDir, filename);
        Files.createDirectories(distPath.getParent());
        Files.write(distPath, bytes);
        return publicPath.toAbsolutePath().toString();
    }

    private Path resolvePath(String dirStr, String filename) {
        Path dir = Paths.get(dirStr);
        if (!dir.isAbsolute()) {
            dir = Paths.get(System.getProperty("user.dir"), dirStr);
        }
        return dir.resolve(filename);
    }

    /**
     * 生成 llms.txt（includeOptional=false）或 llms-full.txt（includeOptional=true，Optional 内联回分组）。
     * 结构：H1(站点全称) → blockquote(核心摘要) → 要点列表(intro) →
     * ## Table of Contents 下 ### 链接分组（品牌/各模块标题/常见问题）→ 联系方式 → 追加段 → Optional(文件末尾)。
     */
    private String buildLlmsTxt(boolean includeOptional) {
        List<SeoConfig> configs = seoConfigMapper.selectList(new LambdaQueryWrapper<SeoConfig>()
                .eq(SeoConfig::getEnabled, 1)
                .orderByAsc(SeoConfig::getId));
        String base = seoSyncService.currentBaseUrl();

        Map<String, String> moduleNames = loadModuleNames();
        // 分组顺序：品牌 → 各模块（按模块排序）→ 常见问题 → 其他
        LinkedHashMap<String, List<String>> sections = new LinkedHashMap<>();
        sections.put("品牌", new ArrayList<>());
        for (String m : moduleNames.values()) {
            sections.putIfAbsent(m, new ArrayList<>());
        }
        sections.put("常见问题", new ArrayList<>());
        sections.put("其他", new ArrayList<>());

        List<String> optionalLines = new ArrayList<>();
        List<String> faqLines = new ArrayList<>();

        for (SeoConfig c : configs) {
            String title = c.getTitle() != null ? c.getTitle().trim() : "";
            if (title.isEmpty()) continue;
            String desc = firstNonBlank(c.getGeoSummary(), c.getDescription());
            String url = pageUrl(c.getCanonicalUrl(), base);
            String line = "- [" + title + "](" + url + ")"
                    + (desc != null && !desc.isEmpty() ? ": " + desc : "");
            // 关键词（seo_configs.keywords，逗号分隔）附加在描述后，便于 LLM 判断内容主题
            String kws = c.getKeywords() != null ? c.getKeywords().trim() : "";
            if (!kws.isEmpty()) {
                line += "（关键词：" + kws + "）";
            }

            boolean isOptional = c.getGeoOptional() != null && c.getGeoOptional() == 1;
            if (isOptional && !includeOptional) {
                optionalLines.add(line);
            } else {
                sections.get(resolveSection(c, moduleNames)).add(line);
            }

            // 该页面的常见问题（逐条追加到「常见问题」分组）
            List<SeoFaq> faqs = loadFaqsOf(c);
            if (faqs != null && !faqs.isEmpty()) {
                for (SeoFaq f : faqs) {
                    if (f.getQuestion() == null || f.getQuestion().trim().isEmpty()) continue;
                    StringBuilder block = new StringBuilder();
                    block.append("- **问：**").append(f.getQuestion().trim());
                    if (f.getAnswer() != null && !f.getAnswer().trim().isEmpty()) {
                        block.append("\n  **答：**").append(f.getAnswer().trim());
                    }
                    faqLines.add(block.toString());
                }
            }
        }

        StringBuilder sb = new StringBuilder();
        // H1：站点/公司全称（唯一必需元素）
        String fullName = siteConfigService.getFullName();
        if (fullName == null || fullName.trim().isEmpty()) {
            fullName = siteConfigService.getSiteName();
        }
        if (fullName == null || fullName.trim().isEmpty()) {
            fullName = "官网";
        }
        sb.append("# ").append(fullName).append("\n\n");
        // Blockquote：核心摘要（站点描述，由站点配置提供，可配置）
        String description = siteConfigService.getSiteDescription();
        if (description != null && !description.trim().isEmpty()) {
            sb.append("> ").append(description.trim()).append("\n\n");
        }
        // H1 与 Table of Contents 之间的自由 Markdown：站点要点列表（可配置覆盖）
        String intro = getSystemConfig(LLMS_INTRO_KEY, defaultLlmsIntro());
        if (intro != null && !intro.trim().isEmpty()) {
            sb.append(intro.trim()).append("\n\n");
        }

        // ## Table of Contents 目录（Vue.js 风格）下的 ### 链接分组（文件列表：- [名称](url): 说明）
        sb.append("## Table of Contents\n\n");
        for (Map.Entry<String, List<String>> e : sections.entrySet()) {
            if (e.getValue().isEmpty()) continue;
            sb.append("### ").append(e.getKey()).append("\n");
            for (String l : e.getValue()) sb.append(l).append("\n");
            if ("常见问题".equals(e.getKey())) {
                for (String f : faqLines) sb.append(f).append("\n");
            }
            sb.append("\n");
        }

        // 联系方式（文件列表格式，同规范约定）
        sb.append("## 联系方式\n");
        sb.append("- [官网](").append(base).append(")\n");

        // 追加段
        String append = getSystemConfig(LLMS_APPEND_KEY, "");
        if (append != null && !append.trim().isEmpty()) {
            sb.append("\n").append(append.trim()).append("\n");
        }

        // Optional：按规范置于文件最末尾，上下文紧张时可跳过
        if (!optionalLines.isEmpty()) {
            sb.append("\n## Optional\n");
            for (String l : optionalLines) sb.append(l).append("\n");
            sb.append("\n");
        }

        return sb.toString();
    }

    /** 将配置归入对应 H2 分组：home/about→品牌；faq→常见问题；模块 pageType→模块标题；其余→其他。 */
    private String resolveSection(SeoConfig c, Map<String, String> moduleNames) {
        String type = c.getPageType();
        if (type == null || type.isEmpty()) {
            return c.getCanonicalUrl() != null && c.getCanonicalUrl().contains("/about") ? "品牌" : "其他";
        }
        if ("home".equals(type) || "about".equals(type)) return "品牌";
        if ("faq".equals(type)) return "常见问题";
        String moduleTitle = moduleNames.get(type);
        return moduleTitle != null ? moduleTitle : "其他";
    }

    private Map<String, String> loadModuleNames() {
        List<CoreModule> modules = coreModuleMapper.selectList(new LambdaQueryWrapper<CoreModule>()
                .eq(CoreModule::getStatus, 1)
                .orderByAsc(CoreModule::getSortOrder));
        Map<String, String> moduleNames = new LinkedHashMap<>();
        for (CoreModule m : modules) {
            moduleNames.put(m.getModuleKey(), m.getModuleTitle() != null ? m.getModuleTitle() : m.getModuleName());
        }
        return moduleNames;
    }

    /** 配置页面对应的 Canonical 页面地址：base + 原路径与查询（不添加 /ai/md 前缀）。 */
    private static String pageUrl(String canonicalUrl, String base) {
        String path = pathAndQuery(canonicalUrl);
        if (path.isEmpty()) return base + "/";
        return base + path;
    }

    private static String pathAndQuery(String url) {
        if (url == null) return "";
        try {
            URI uri = URI.create(url.trim());
            String path = uri.getRawPath() != null ? uri.getRawPath() : "";
            String query = uri.getRawQuery();
            return (query == null || query.isEmpty()) ? path : path + "?" + query;
        } catch (Exception e) {
            return url.trim();
        }
    }

    /** 读取系统配置（键），缺省返回默认值。 */
    private String getSystemConfig(String key, String defaultValue) {
        try {
            SystemConfig cfg = systemConfigMapper.findByKey(key);
            if (cfg != null && cfg.getConfigValue() != null && !cfg.getConfigValue().trim().isEmpty()) {
                return cfg.getConfigValue().trim();
            }
        } catch (Exception ignored) {
        }
        return defaultValue;
    }

    /** 默认站点要点：基于站点配置动态组装；未配置站点描述时退化为中性文本。 */
    private String defaultLlmsIntro() {
        String fullName = siteConfigService.getFullName();
        if (fullName == null || fullName.trim().isEmpty()) {
            fullName = siteConfigService.getSiteName();
        }
        String desc = siteConfigService.getSiteDescription();
        if (desc != null && !desc.trim().isEmpty()) {
            return "站点关键信息：\n- " + fullName.trim() + "：" + desc.trim();
        }
        return "站点关键信息：\n- " + (fullName == null || fullName.trim().isEmpty()
                ? "本站"
                : fullName.trim()) + "。具体栏目与页面详见下方目录。";
    }

    /** 加载某 SEO 配置对应的 FAQ：优先按 page_type+page_id，page_type 为空时退化为按 page_id 匹配。 */
    private List<SeoFaq> loadFaqsOf(SeoConfig c) {
        LambdaQueryWrapper<SeoFaq> qw = new LambdaQueryWrapper<>();
        boolean hasType = c.getPageType() != null && !c.getPageType().isEmpty();
        boolean hasId = c.getPageId() != null;
        if (hasType && hasId) {
            qw.eq(SeoFaq::getPageType, c.getPageType()).eq(SeoFaq::getPageId, c.getPageId());
        } else if (hasType) {
            qw.eq(SeoFaq::getPageType, c.getPageType());
        } else if (hasId) {
            qw.eq(SeoFaq::getPageId, c.getPageId());
        } else {
            return null;
        }
        qw.orderByAsc(SeoFaq::getSortOrder);
        return seoFaqMapper.selectList(qw);
    }

    /**
     * 依据 seo_configs（enabled=1 且非 noindex）生成 sitemap.xml：
     * 首页 1.0/daily、about 0.7/weekly、faqs 0.6/weekly、
     * 模块列表页 0.8/weekly、内容详情页 0.6/weekly；lastmod 取配置 updatedAt。
     */
    private String buildSitemapXml() {
        List<SeoConfig> configs = seoConfigMapper.selectList(new LambdaQueryWrapper<SeoConfig>()
                .eq(SeoConfig::getEnabled, 1)
                .orderByAsc(SeoConfig::getId));
        String base = seoSyncService.currentBaseUrl();
        List<UrlEntry> entries = new ArrayList<>();
        Map<String, SeoConfig> byUrl = new LinkedHashMap<>();
        for (SeoConfig c : configs) {
            if (c.getCanonicalUrl() != null) byUrl.put(c.getCanonicalUrl().trim(), c);
        }

        addEntry(entries, base + "/", "1", "daily", byUrl.get(base + "/"));

        for (SeoConfig c : configs) {
            if (isNoIndex(c)) continue;
            String url = c.getCanonicalUrl() != null ? c.getCanonicalUrl().trim() : "";
            if (url.isEmpty() || url.equals(base + "/")) continue;
            String priority = "0.7";
            String freq = "weekly";
            if (url.contains("/list/detail") || url.contains("/list/category/detail")) {
                priority = "0.6";
            } else if (url.contains("/list/category")) {
                priority = "0.8";
            } else if (url.contains("/faqs")) {
                priority = "0.6";
            } else if (url.contains("/about")) {
                priority = "0.7";
            }
            entries.add(new UrlEntry(url, priority, freq, c.getUpdatedAt()));
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        for (UrlEntry e : entries) {
            sb.append("<url>\n");
            sb.append("<loc>").append(xmlEscape(e.url)).append("</loc>\n");
            String lastmod = e.lastmod != null
                    ? e.lastmod.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) + "Z"
                    : LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) + "Z";
            sb.append("<lastmod>").append(lastmod).append("</lastmod>\n");
            sb.append("<changefreq>").append(e.freq).append("</changefreq>\n");
            sb.append("<priority>").append(e.priority).append("</priority>\n");
            sb.append("</url>\n");
        }
        sb.append("</urlset>\n");
        return sb.toString();
    }

    private static void addEntry(List<UrlEntry> entries, String url, String priority, String freq, SeoConfig c) {
        entries.add(new UrlEntry(url, priority, freq, c != null ? c.getUpdatedAt() : null));
    }

    private static boolean isNoIndex(SeoConfig c) {
        String robots = c.getRobots();
        return robots != null && robots.toLowerCase().contains("noindex");
    }

    private static String xmlEscape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }

    private static class UrlEntry {
        final String url;
        final String priority;
        final String freq;
        final LocalDateTime lastmod;

        UrlEntry(String url, String priority, String freq, LocalDateTime lastmod) {
            this.url = url;
            this.priority = priority;
            this.freq = freq;
            this.lastmod = lastmod;
        }
    }

    private String buildRobotsTxt() {
        StringBuilder sb = new StringBuilder();
        sb.append("# robots.txt\n");
        sb.append("# AI 引擎爬虫放行，提升外部 AI 推荐可见度（GEO）\n\n");
        sb.append("User-agent: GPTBot\nAllow: /\n\n");
        sb.append("User-agent: OAI-SearchBot\nAllow: /\n\n");
        sb.append("User-agent: ChatGPT-User\nAllow: /\n\n");
        sb.append("User-agent: PerplexityBot\nAllow: /\n\n");
        sb.append("User-agent: ClaudeBot\nAllow: /\n\n");
        sb.append("User-agent: Claude-SearchBot\nAllow: /\n\n");
        sb.append("User-agent: Google-Extended\nAllow: /\n\n");
        sb.append("User-agent: Bingbot\nAllow: /\n\n");
        sb.append("User-agent: *\nAllow: /\n\n");
        sb.append("Sitemap: ").append(seoSyncService.currentBaseUrl()).append("/sitemap.xml\n");
        return sb.toString();
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.trim().isEmpty()) return a.trim();
        return b;
    }
}