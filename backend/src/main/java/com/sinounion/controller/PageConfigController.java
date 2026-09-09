package com.sinounion.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.common.Result;
import com.sinounion.dto.AiWebsiteConfigDTO;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "页面配置", description = "各页面静态内容配置")
@RestController
@RequestMapping("/page-config")
@RequiredArgsConstructor
public class PageConfigController {

    private final SystemConfigMapper systemConfigMapper;
    private final ObjectMapper objectMapper;

    @Operation(summary = "获取页面配置")
    @GetMapping("/{pageKey}")
    public Result<SystemConfig> getPageConfig(@PathVariable String pageKey) {
        SystemConfig config = systemConfigMapper.findByKey("page_config:" + pageKey);
        return Result.success(config);
    }

    @Operation(summary = "获取 AI 官网版本介绍与对比配置（未配置时返回默认）")
    @GetMapping("/ai-website")
    public Result<AiWebsiteConfigDTO> getAiWebsiteConfig() {
        SystemConfig config = systemConfigMapper.findByKey("ai_website_config");
        if (config != null && config.getConfigValue() != null && !config.getConfigValue().trim().isEmpty()) {
            try {
                return Result.success(objectMapper.readValue(config.getConfigValue(), AiWebsiteConfigDTO.class));
            } catch (Exception e) {
                return Result.success(AiWebsiteConfigDTO.defaults());
            }
        }
        return Result.success(AiWebsiteConfigDTO.defaults());
    }
}
