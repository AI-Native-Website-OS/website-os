package com.sinounion.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.ContentItem;
import com.sinounion.entity.CoreModule;
import com.sinounion.entity.SeoConfig;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.ContentItemMapper;
import com.sinounion.mapper.CoreModuleMapper;
import com.sinounion.mapper.SeoConfigMapper;
import com.sinounion.mapper.SystemConfigMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * SEO 配置与内容/模块/静态页之间的自动同步。
 * 约定：内容详情页的 SEO 标题/描述以内容项为准（seoTitle||title、seoDescription||summary），
 * URL 以模块配置助手生成的详情页 URL 为准；SEO 配置按 pageId 唯一对应一条内容。
 * 站点基址（canonicalUrl 前缀）取自「一键同步」时前端访问的 origin，未设置时回退到线上域名。
 */
@Service
@RequiredArgsConstructor
public class SeoSyncService {

    public static final String SITE_URL = "https://www.example.cn";
    public static final String BASE_URL_CONFIG_KEY = "seo_site_url";

    private final SeoConfigMapper seoConfigMapper;
    private final ContentItemMapper contentItemMapper;
    private final CoreModuleMapper coreModuleMapper;
    private final SystemConfigMapper systemConfigMapper;

    /** 当前站点基址：优先取 system_configs.seo_site_url（一键同步时由前端 origin 写入），否则用线上域名。 */
    public String currentBaseUrl() {
        try {
            SystemConfig cfg = systemConfigMapper.findByKey(BASE_URL_CONFIG_KEY);
            if (cfg != null && cfg.getConfigValue() != null && !cfg.getConfigValue().trim().isEmpty()) {
                return cfg.getConfigValue().trim();
            }
        } catch (Exception ignored) {
        }
        return SITE_URL;
    }

    /**
     * 一键同步时记录当前前端访问基址（origin），例如 http://192.168.1.10:3200。
     * 规则：仅当来源为本地/内网地址（localhost、回环或私有网段）时保存当前 origin，
     * 供开发/内网环境的 sitemap 使用；公网来源一律强制使用线上域名，
     * 避免内网 IP 污染生产 sitemap/robots。
     */
    public void saveBaseUrl(String origin) {
        if (origin == null || origin.trim().isEmpty()) return;
        String base = isPrivateOrigin(origin) ? normalizeBase(origin) : SITE_URL;
        if (base == null) return;
        SystemConfig cfg = systemConfigMapper.findByKey(BASE_URL_CONFIG_KEY);
        if (cfg == null) {
            cfg = new SystemConfig();
            cfg.setConfigKey(BASE_URL_CONFIG_KEY);
            cfg.setConfigValue(base);
            cfg.setConfigType("string");
            cfg.setDescription("SEO Canonical URL 站点基址（一键同步时由前端访问 origin 写入；公网来源强制线上域名）");
            systemConfigMapper.insert(cfg);
        } else if (!Objects.equals(cfg.getConfigValue(), base)) {
            cfg.setConfigValue(base);
            systemConfigMapper.updateById(cfg);
        }
    }

    /**
     * 判断来源是否为本地/内网访问：localhost、回环地址或私有网段
     * （10.0.0.0/8、172.16.0.0/12、192.168.0.0/16）。非 http/https 或非法值返回 false。
     */
    public static boolean isPrivateOrigin(String origin) {
        String base = normalizeBase(origin);
        if (base == null) return false;
        try {
            String host = URI.create(base).getHost();
            if (host == null) return false;
            String h = host.toLowerCase();
            if ("localhost".equals(h) || "127.0.0.1".equals(h) || "::1".equals(h)) return true;
            return isPrivateIp(h);
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isPrivateIp(String host) {
        String[] parts = host.split("\\.");
        if (parts.length != 4) return false;
        for (String p : parts) {
            if (p.isEmpty() || !p.matches("\\d+")) return false;
        }
        int a = Integer.parseInt(parts[0]);
        int b = Integer.parseInt(parts[1]);
        if (a == 10) return true;
        if (a == 172 && b >= 16 && b <= 31) return true;
        return a == 192 && b == 168;
    }

    /** 归一化 origin：去空白、去结尾斜杠；非 http/https 或为空返回 null。 */
    public static String normalizeBase(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        if (s.isEmpty()) return null;
        if (!s.startsWith("http://") && !s.startsWith("https://")) return null;
        return s;
    }

    /** 内容保存时同步：按 pageId upsert 详情页 SEO 配置（标题/描述/URL/pageId 全量同步）。仅状态为启用（status=1）的内容参与同步。 */
    public void syncFromContent(ContentItem item) {
        if (item == null || item.getId() == null || item.getModuleKey() == null || item.getSlug() == null) return;
        if (item.getStatus() == null || item.getStatus() != 1) return;
        String canonical = detailUrl(item.getModuleKey(), item.getSlug(), currentBaseUrl());
        String title = firstNonBlank(item.getSeoTitle(), item.getTitle());
        String desc = firstNonBlank(item.getSeoDescription(), item.getSummary());

        SeoConfig existing = findByPageId(item.getId());
        if (existing == null) {
            SeoConfig cfg = new SeoConfig();
            cfg.setPageId(item.getId());
            cfg.setPageType(item.getModuleKey());
            cfg.setTitle(title);
            cfg.setDescription(desc);
            cfg.setCanonicalUrl(canonical);
            seoConfigMapper.insert(cfg);
        } else {
            boolean changed = false;
            if (!Objects.equals(existing.getTitle(), title)) { existing.setTitle(title); changed = true; }
            if (!Objects.equals(existing.getDescription(), desc)) { existing.setDescription(desc); changed = true; }
            if (!Objects.equals(existing.getCanonicalUrl(), canonical)) { existing.setCanonicalUrl(canonical); changed = true; }
            if (!Objects.equals(existing.getPageType(), item.getModuleKey())) { existing.setPageType(item.getModuleKey()); changed = true; }
            if (changed) seoConfigMapper.updateById(existing);
        }
    }

    /**
     * 一键同步全部：
     * 静态页（首页/关于/FAQ）与模块列表页仅「缺失则创建、已存在则修正 URL/基址」，不覆盖手工标题/描述；
     * 内容详情页全量同步（以内容项为唯一数据源，canonicalUrl 统一替换为当前基址）。
     */
    public Map<String, Integer> syncAll() {
        int created = 0;
        int updated = 0;
        String base = currentBaseUrl();

        List<String[]> staticPages = new ArrayList<>();
        staticPages.add(new String[]{base + "/", "home", "企业数字基础设施服务商", "圣诺联合为中国政府、国企和企业客户提供智慧招采平台、可信数据空间、分布式数据治理、区块链可信基础设施和AI智能体应用等企业数字基础设施解决方案。"});
        staticPages.add(new String[]{base + "/about", "about", "关于我们", "河北圣诺联合科技有限公司——企业数字基础设施服务商"});
        staticPages.add(new String[]{base + "/faqs", "faq", "常见问题 - FAQ", "圣诺联合常见问题解答：了解产品功能、服务流程、技术支持和价格方案等常见问题。"});
        for (String[] e : staticPages) {
            SyncResult r = upsertStaticOrListPage(e[0], e[1], e[2], e[3]);
            created += r.created;
            updated += r.updated;
        }

        List<CoreModule> modules = coreModuleMapper.selectList(new LambdaQueryWrapper<CoreModule>()
                .eq(CoreModule::getStatus, 1)
                .orderByAsc(CoreModule::getSortOrder));
        for (CoreModule m : modules) {
            String url = base + "/list/category?moduleKey=" + m.getModuleKey();
            String title = firstNonBlank(m.getModuleTitle(), m.getModuleName());
            SyncResult r = upsertStaticOrListPage(url, m.getModuleKey(), title, m.getModuleDescription());
            created += r.created;
            updated += r.updated;
        }

        List<ContentItem> items = contentItemMapper.selectList(new LambdaQueryWrapper<ContentItem>()
                .eq(ContentItem::getStatus, 1));
        for (ContentItem item : items) {
            SeoConfig existing = findByPageId(item.getId());
            if (existing == null) {
                syncFromContent(item);
                created++;
            } else {
                boolean changed = false;
                String canonical = detailUrl(item.getModuleKey(), item.getSlug(), base);
                String title = firstNonBlank(item.getSeoTitle(), item.getTitle());
                String desc = firstNonBlank(item.getSeoDescription(), item.getSummary());
                if (!Objects.equals(existing.getTitle(), title)) { existing.setTitle(title); changed = true; }
                if (!Objects.equals(existing.getDescription(), desc)) { existing.setDescription(desc); changed = true; }
                if (!Objects.equals(existing.getCanonicalUrl(), canonical)) { existing.setCanonicalUrl(canonical); changed = true; }
                if (!Objects.equals(existing.getPageType(), item.getModuleKey())) { existing.setPageType(item.getModuleKey()); changed = true; }
                if (changed) { seoConfigMapper.updateById(existing); updated++; }
            }
        }

        Map<String, Integer> result = new LinkedHashMap<>();
        result.put("created", created);
        result.put("updated", updated);
        return result;
    }

    /** 修改 SEO 配置时反向同步到内容自身字段：标题→content.title，URL 中 slug→content.slug。 */
    public void syncContentFromSeo(SeoConfig config) {
        if (config == null || config.getPageId() == null) return;
        ContentItem item = contentItemMapper.selectById(config.getPageId());
        if (item == null) return;
        boolean changed = false;

        if (config.getTitle() != null && !config.getTitle().trim().isEmpty() && !config.getTitle().equals(item.getTitle())) {
            item.setTitle(config.getTitle().trim());
            changed = true;
        }

        if (config.getCanonicalUrl() != null) {
            String newSlug = parseSlugFromUrl(config.getCanonicalUrl());
            if (newSlug != null && !newSlug.isEmpty() && !newSlug.equals(item.getSlug())) {
                Long count = contentItemMapper.selectCount(new LambdaQueryWrapper<ContentItem>()
                        .eq(ContentItem::getModuleKey, item.getModuleKey())
                        .eq(ContentItem::getSlug, newSlug)
                        .ne(ContentItem::getId, item.getId()));
                if (count != null && count > 0) {
                    throw new BusinessException("URL 变更失败：slug 已存在（" + newSlug + "），请换用其他 URL");
                }
                item.setSlug(newSlug);
                changed = true;
            }
        }

        if (changed) contentItemMapper.updateById(item);
    }

    /**
     * 静态页与模块列表页的 upsert：按 URL 路径（不含基址）匹配既有配置，命中则仅把 canonicalUrl 基址
     * 替换为当前基址、pageType 修正为期望值，从而跨基址同步不产生重复。
     */
    private SyncResult upsertStaticOrListPage(String canonical, String pageType, String title, String description) {
        SeoConfig existing = findByUrlPath(canonical);
        if (existing == null) {
            SeoConfig cfg = new SeoConfig();
            cfg.setTitle(title);
            cfg.setDescription(description);
            cfg.setCanonicalUrl(canonical);
            cfg.setPageType(pageType);
            seoConfigMapper.insert(cfg);
            return new SyncResult(1, 0);
        }
        boolean changed = false;
        if (!Objects.equals(existing.getCanonicalUrl(), canonical)) { existing.setCanonicalUrl(canonical); changed = true; }
        if (pageType != null && !Objects.equals(existing.getPageType(), pageType)) { existing.setPageType(pageType); changed = true; }
        if (changed) { seoConfigMapper.updateById(existing); return new SyncResult(0, 1); }
        return new SyncResult(0, 0);
    }

    private SeoConfig findByPageId(Long pageId) {
        return seoConfigMapper.selectOne(new LambdaQueryWrapper<SeoConfig>()
                .eq(SeoConfig::getPageId, pageId)
                .last("LIMIT 1"));
    }

    /** 按 URL 路径（scheme/host/port 之外的部分，含 query）匹配既有配置，跨基址复用同一配置。 */
    private SeoConfig findByUrlPath(String canonical) {
        String target = urlPath(canonical);
        if (target.isEmpty()) return null;
        List<SeoConfig> all = seoConfigMapper.selectList(new LambdaQueryWrapper<SeoConfig>());
        for (SeoConfig c : all) {
            if (c.getCanonicalUrl() != null && urlPath(c.getCanonicalUrl()).equals(target)) {
                return c;
            }
        }
        return null;
    }

    private static String urlPath(String url) {
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

    private String parseSlugFromUrl(String url) {
        try {
            URI uri = URI.create(url.trim());
            String query = uri.getRawQuery();
            if (query == null) return null;
            for (String pair : query.split("&")) {
                int idx = pair.indexOf('=');
                if (idx > 0 && "slug".equals(pair.substring(0, idx))) {
                    return pair.substring(idx + 1);
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.trim().isEmpty()) return a.trim();
        return b;
    }

    private static String detailUrl(String moduleKey, String slug, String base) {
        return base + "/list/detail?moduleKey=" + moduleKey + "&slug=" + slug;
    }

    private static class SyncResult {
        final int created;
        final int updated;

        SyncResult(int created, int updated) {
            this.created = created;
            this.updated = updated;
        }
    }
}
