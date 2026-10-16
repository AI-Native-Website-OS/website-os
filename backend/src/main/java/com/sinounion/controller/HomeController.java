package com.sinounion.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.common.Result;
import com.sinounion.dto.FooterConfigDTO;
import com.sinounion.entity.ContentItem;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import com.sinounion.service.BannerService;
import com.sinounion.service.ContentItemService;
import com.sinounion.service.IndustryChainService;
import com.sinounion.service.PartnerService;
import com.sinounion.service.SiteConfigService;
import com.sinounion.translation.LocaleContext;
import com.sinounion.translation.TranslationOverlayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "首页数据", description = "首页相关接口")
@RestController
@RequestMapping("/home")
@RequiredArgsConstructor
public class HomeController {

    private final BannerService bannerService;
    private final ContentItemService contentItemService;
    private final IndustryChainService chainService;
    private final PartnerService partnerService;
    private final SystemConfigMapper systemConfigMapper;
    private final ObjectMapper objectMapper;
    private final SiteConfigService siteConfigService;
    private final TranslationOverlayService translationOverlayService;

    @Operation(summary = "获取首页综合数据")
    @GetMapping
    public Result<Map<String, Object>> getHomeData() {
        Map<String, Object> data = new HashMap<>();
        data.put("banners", bannerService.getAllActiveBanners());
        data.put("products", featured("products"));
        data.put("solutions", featured("solutions"));
        data.put("cases", featured("cases"));
        data.put("resources", featured("resources"));
        data.put("industryChains", chainService.getRootChains());
        data.put("partners", partnerService.getAllActivePartners());
        return Result.success(data);
    }

    private java.util.List<ContentItem> featured(String moduleKey) {
        return contentItemService.getItems(moduleKey, 1, 6, null, null, null, 1, true).getRecords();
    }

    @Operation(summary = "获取首页内容配置")
    @GetMapping("/config")
    public Result<SystemConfig> getHomeConfig() {
        SystemConfig config = systemConfigMapper.findByKey("home_page");
        return Result.success(config);
    }

    @Operation(summary = "获取首页页脚配置")
    @GetMapping("/footer")
    public Result<FooterConfigDTO> getFooterConfig() {
        SystemConfig config = systemConfigMapper.findByKey("home_footer");
        FooterConfigDTO dto;
        if (config == null || !StringUtils.hasText(config.getConfigValue())) {
            dto = new FooterConfigDTO();
        } else {
            try {
                dto = objectMapper.readValue(config.getConfigValue(), FooterConfigDTO.class);
            } catch (Exception e) {
                dto = new FooterConfigDTO();
            }
        }
        translationOverlayService.overlayConfigValue(LocaleContext.get(), "home_footer", dto);
        return Result.success(dto);
    }

    @Operation(summary = "获取站点/品牌配置")
    @GetMapping("/site")
    public Result<Map<String, Object>> getSiteConfig() {
        Map<String, Object> config = siteConfigService.getSiteConfig();
        translationOverlayService.overlayConfigMap(LocaleContext.get(), "site_brand", config);
        return Result.success(config);
    }

    @Operation(summary = "获取全局主题配置（深浅色模式与主题色）")
    @GetMapping("/theme")
    public Result<Map<String, Object>> getThemeConfig() {
        Map<String, Object> theme = new HashMap<>();
        SystemConfig mode = systemConfigMapper.findByKey("theme_mode");
        String themeMode = mode != null && StringUtils.hasText(mode.getConfigValue())
                ? mode.getConfigValue().trim() : "light";
        if (!"dark".equals(themeMode) && !"auto".equals(themeMode)) {
            themeMode = "light";
        }
        SystemConfig color = systemConfigMapper.findByKey("site_primary_color");
        String primaryColor = color != null && StringUtils.hasText(color.getConfigValue())
                ? color.getConfigValue().trim() : "#000000";
        theme.put("themeMode", themeMode);
        theme.put("primaryColor", primaryColor);
        return Result.success(theme);
    }

    @Operation(summary = "获取站点通知公告（按启用状态与时间窗过滤）")
    @GetMapping("/notices")
    public Result<List<Map<String, Object>>> getSiteNotices() {
        SystemConfig config = systemConfigMapper.findByKey("site_notices");
        if (config == null || !StringUtils.hasText(config.getConfigValue())) {
            return Result.success(Collections.emptyList());
        }
        List<Map<String, Object>> notices = new ArrayList<>();
        try {
            List<Map<String, Object>> parsed = objectMapper.readValue(
                    config.getConfigValue(), new TypeReference<List<Map<String, Object>>>() {});
            if (parsed != null) {
                LocalDateTime now = LocalDateTime.now();
                for (Map<String, Object> notice : parsed) {
                    if (isNoticeActive(notice, now)) {
                        notice.put("id", resolveNoticeId(notice));
                        notices.add(notice);
                    }
                }
            }
        } catch (Exception e) {
            return Result.success(Collections.emptyList());
        }
        translationOverlayService.overlayConfigValue(LocaleContext.get(), "site_notices", notices);
        return Result.success(notices);
    }

    /** 通知标识：优先沿用已存 id；否则由类型/内容/时间派生稳定标识，内容变更即视为新通知重新展示。 */
    private String resolveNoticeId(Map<String, Object> notice) {
        Object existing = notice.get("id");
        if (existing != null && StringUtils.hasText(String.valueOf(existing))) {
            return String.valueOf(existing);
        }
        String basis = String.valueOf(notice.get("type")) + "|" + String.valueOf(notice.get("content"))
                + "|" + String.valueOf(notice.get("startAt")) + "|" + String.valueOf(notice.get("endAt"));
        return "notice-" + Integer.toHexString(basis.hashCode());
    }

    /** 通知是否处于启用且在有效时间窗内；时间字段留空视为不限制。 */
    private boolean isNoticeActive(Map<String, Object> notice, LocalDateTime now) {
        Object enabled = notice.get("enabled");
        if (enabled != null && !Boolean.parseBoolean(String.valueOf(enabled))) {
            return false;
        }
        if (!isWithin("startAt", notice, now, true)) {
            return false;
        }
        return isWithin("endAt", notice, now, false);
    }

    /** 时间字段留空视为不限制；支持 yyyy-MM-dd（按天，含端点）与 yyyy-MM-ddTHH:mm:ss 两种格式。 */
    private boolean isWithin(String field, Map<String, Object> notice, LocalDateTime now, boolean isStart) {
        Object raw = notice.get(field);
        if (raw == null || !StringUtils.hasText(String.valueOf(raw))) {
            return true;
        }
        String value = String.valueOf(raw).trim();
        try {
            if (value.length() == 10) {
                LocalDate date = LocalDate.parse(value);
                return isStart ? !now.toLocalDate().isBefore(date) : !now.toLocalDate().isAfter(date);
            }
            LocalDateTime time = LocalDateTime.parse(value);
            return isStart ? !time.isAfter(now) : !time.isBefore(now);
        } catch (Exception ignored) {
            return true;
        }
    }
}
