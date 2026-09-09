package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import com.sinounion.service.KnowledgeSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

@Tag(name = "管理后台-关于管理", description = "关于页面内容管理接口")
@RestController
@RequestMapping("/admin/about")
@RequiredArgsConstructor
public class AdminAboutController {

    private final SystemConfigMapper systemConfigMapper;
    private final KnowledgeSyncService knowledgeSyncService;

    @Operation(summary = "获取关于页面配置")
    @GetMapping
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<SystemConfig> getAboutConfig() {
        SystemConfig config = systemConfigMapper.findByKey("about_page");
        return Result.success(config);
    }

    @Operation(summary = "保存关于页面配置")
    @PutMapping
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<SystemConfig> saveAboutConfig(@Valid @RequestBody SystemConfig config) {
        config.setConfigKey("about_page");
        config.setConfigType("json");
        config.setDescription("关于页面内容配置");

        SystemConfig existing = systemConfigMapper.findByKey("about_page");
        if (existing != null) {
            existing.setConfigValue(config.getConfigValue());
            existing.setDescription(config.getDescription());
            systemConfigMapper.updateById(existing);
            knowledgeSyncService.syncAboutPage(config.getConfigValue());
            return Result.success(existing);
        }
        systemConfigMapper.insert(config);
        knowledgeSyncService.syncAboutPage(config.getConfigValue());
        return Result.success(config);
    }
}
