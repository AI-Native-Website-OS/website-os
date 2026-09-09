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
        try {
            SystemConfig cfg = systemConfigMapper.findByKey(SITE_BRAND_KEY);
            if (cfg != null && StringUtils.hasText(cfg.getConfigValue())) {
                Map<String, Object> parsed = objectMapper.readValue(
                        cfg.getConfigValue(), new TypeReference<Map<String, Object>>() {});
                if (parsed != null) {
                    config.putAll(parsed);
                }
            }
        } catch (Exception ignored) {
        }
        return config;
    }

    public String getSiteName() {
        return getString("siteName", "示例科技");
    }

    public String getFullName() {
        return getString("siteFullName", "示例科技有限公司");
    }

    private String getString(String key, String fallback) {
        Object value = getSiteConfig().get(key);
        return value != null && StringUtils.hasText(value.toString()) ? value.toString() : fallback;
    }
}