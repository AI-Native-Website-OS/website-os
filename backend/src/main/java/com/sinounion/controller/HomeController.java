package com.sinounion.controller;

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
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
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
        if (config == null || !StringUtils.hasText(config.getConfigValue())) {
            return Result.success(new FooterConfigDTO());
        }
        try {
            return Result.success(objectMapper.readValue(config.getConfigValue(), FooterConfigDTO.class));
        } catch (Exception e) {
            return Result.success(new FooterConfigDTO());
        }
    }

    @Operation(summary = "获取站点/品牌配置")
    @GetMapping("/site")
    public Result<Map<String, Object>> getSiteConfig() {
        return Result.success(siteConfigService.getSiteConfig());
    }
}
