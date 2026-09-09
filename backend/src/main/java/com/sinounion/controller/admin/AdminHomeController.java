package com.sinounion.controller.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.common.BusinessException;
import com.sinounion.common.Result;
import com.sinounion.dto.FooterConfigDTO;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import com.sinounion.service.KnowledgeSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

@Tag(name = "管理后台-首页管理", description = "首页内容管理接口")
@RestController
@RequestMapping("/admin/home")
@RequiredArgsConstructor
public class AdminHomeController {

    private final SystemConfigMapper systemConfigMapper;
    private final KnowledgeSyncService knowledgeSyncService;
    private final ObjectMapper objectMapper;

    @Operation(summary = "获取首页配置")
    @GetMapping
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<SystemConfig> getHomeConfig() {
        SystemConfig config = systemConfigMapper.findByKey("home_page");
        return Result.success(config);
    }

    @Operation(summary = "保存首页配置")
    @PutMapping
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<SystemConfig> saveHomeConfig(@Valid @RequestBody SystemConfig config) {
        config.setConfigKey("home_page");
        config.setConfigType("json");
        config.setDescription("首页内容配置");

        SystemConfig existing = systemConfigMapper.findByKey("home_page");
        if (existing != null) {
            existing.setConfigValue(config.getConfigValue());
            existing.setDescription(config.getDescription());
            systemConfigMapper.updateById(existing);
            knowledgeSyncService.syncHomePage(config.getConfigValue());
            return Result.success(existing);
        }
        systemConfigMapper.insert(config);
        knowledgeSyncService.syncHomePage(config.getConfigValue());
        return Result.success(config);
    }

    @Operation(summary = "获取首页页脚配置")
    @GetMapping("/footer")
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<SystemConfig> getFooterConfig() {
        SystemConfig config = systemConfigMapper.findByKey("home_footer");
        return Result.success(config);
    }

    @Operation(summary = "保存首页页脚配置")
    @PutMapping("/footer")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<SystemConfig> saveFooterConfig(@Valid @RequestBody FooterConfigDTO dto) {
        String json;
        try {
            json = objectMapper.writeValueAsString(dto);
        } catch (Exception e) {
            throw new BusinessException("页脚配置保存失败：" + e.getMessage());
        }

        SystemConfig existing = systemConfigMapper.findByKey("home_footer");
        if (existing != null) {
            existing.setConfigValue(json);
            existing.setDescription("首页页脚内容配置");
            systemConfigMapper.updateById(existing);
            return Result.success(existing);
        }
        SystemConfig config = new SystemConfig();
        config.setConfigKey("home_footer");
        config.setConfigValue(json);
        config.setConfigType("json");
        config.setDescription("首页页脚内容配置");
        systemConfigMapper.insert(config);
        return Result.success(config);
    }
}
