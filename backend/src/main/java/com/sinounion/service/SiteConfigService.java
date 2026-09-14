package com.sinounion.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 品牌/站点设置服务：读取 system_configs.site_brand 并合并硬编码中性默认值。
 * 后台修改 site_brand 后运行时生效，SEO/GEO/llms 生成均读取本服务。
 */
@Service
@RequiredArgsConstructor
public class SiteConfigService {

    public static final String SITE_BRAND_KEY = "site_brand";

    private final SystemConfigMapper systemConfigMapper;
    private final ObjectMapper objectMapper;

    /** 硬编码中性默认品牌，DB 未配置或解析失败时兜底。 */
    public static Map<String, Object> defaultConfig() {
        Map<String, Object> defaults = new LinkedHashMap<>();
        defaults.put("siteName", "示例科技");
        defaults.put("siteFullName", "示例科技有限公司");
        defaults.put("siteDescription", "");
        defaults.put("copyright", "示例科技有限公司 版权所有");
        defaults.put("companyName", "示例科技有限公司");
        defaults.put("contactPhone", "010-00000000");
        defaults.put("contactEmail", "demo@example.com");
        defaults.put("icpNumber", "ICP备案号待配置");
        defaults.put("icpUrl", "https://beian.miit.gov.cn/#/Integrated/recordQuery");
        defaults.put("url", "https://demo.example.com");
        defaults.put("logo", "/logo.png");
        defaults.put("favicon", "/logo-lable.png");
        defaults.put("githubUrl", "");
        defaults.put("giteeUrl", "");
        defaults.put("docsUrl", "");
        defaults.put("pilotUrl", "");
        defaults.put("githubIcon", "github");
        defaults.put("giteeIcon", "gitee");
        defaults.put("docsIcon", "book");
        defaults.put("pilotIcon", "rocket");
        defaults.put("versionEnabled", false);
        return defaults;
    }

    public Map<String, Object> getSiteConfig() {
        Map<String, Object> config = defaultConfig();
        config.putAll(getDbConfig());
        return config;
    }

    /** 仅读取 DB 中 site_brand 已配置的键值（不含默认值）；未配置或解析失败返回空。 */
    private Map<String, Object> getDbConfig() {
        try {
            SystemConfig cfg = systemConfigMapper.findByKey(SITE_BRAND_KEY);
            if (cfg != null && StringUtils.hasText(cfg.getConfigValue())) {
                Map<String, Object> parsed = objectMapper.readValue(
                        cfg.getConfigValue(), new TypeReference<Map<String, Object>>() {});
                if (parsed != null) {
                    return parsed;
                }
            }
        } catch (Exception ignored) {
        }
        return new LinkedHashMap<>();
    }

    private String getDbString(String key) {
        Object value = getDbConfig().get(key);
        return value != null && StringUtils.hasText(value.toString()) ? value.toString().trim() : "";
    }

    /** SEO/GEO 面向的站点身份：仅取 DB 已配置值，未配置返回空，不注入占位文案。 */
    public String getSiteName() {
        return getDbString("siteName");
    }

    public String getFullName() {
        return getDbString("siteFullName");
    }

    public String getSiteDescription() {
        return getDbString("siteDescription");
    }

    public String getSiteUrl() {
        return getDbString("url");
    }

    /** 以下 getter 供管理后台/UI 使用，保留中性默认值。 */
    public String getCopyright() {
        return getString("copyright", "");
    }

    public String getCompanyName() {
        return getString("companyName", "");
    }

    public String getContactPhone() {
        return getString("contactPhone", "");
    }

    public String getContactEmail() {
        return getString("contactEmail", "");
    }

    private String getString(String key, String fallback) {
        Object value = getSiteConfig().get(key);
        return value != null && StringUtils.hasText(value.toString()) ? value.toString() : fallback;
    }
}