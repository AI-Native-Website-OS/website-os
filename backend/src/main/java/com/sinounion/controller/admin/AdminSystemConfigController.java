package com.sinounion.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
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
import java.util.List;

@Tag(name = "管理后台-系统配置", description = "系统配置管理")
@RestController
@RequestMapping("/admin/system-configs")
@RequiredArgsConstructor
public class AdminSystemConfigController {

    private final SystemConfigMapper systemConfigMapper;
    private final KnowledgeSyncService knowledgeSyncService;

    @Operation(summary = "获取所有系统配置")
    @GetMapping
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<List<SystemConfig>> getConfigs() {
        return Result.success(systemConfigMapper.selectList(new LambdaQueryWrapper<>()));
    }

    @Operation(summary = "获取单个配置")
    @GetMapping("/{key}")
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<SystemConfig> getConfig(@PathVariable String key) {
        return Result.success(systemConfigMapper.findByKey(key));
    }

    @Operation(summary = "创建或更新配置")
    @PostMapping
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<SystemConfig> saveConfig(@Valid @RequestBody SystemConfig config) {
        SystemConfig existing = systemConfigMapper.findByKey(config.getConfigKey());
        if (existing != null) {
            existing.setConfigValue(config.getConfigValue());
            existing.setDescription(config.getDescription());
            existing.setConfigType(config.getConfigType());
            systemConfigMapper.updateById(existing);
            if ("about_page".equals(config.getConfigKey())) {
                knowledgeSyncService.syncAboutPage(config.getConfigValue());
            }
            return Result.success(existing);
        }
        systemConfigMapper.insert(config);
        if ("about_page".equals(config.getConfigKey())) {
            knowledgeSyncService.syncAboutPage(config.getConfigValue());
        }
        return Result.success(config);
    }

    @Operation(summary = "删除配置")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<Void> deleteConfig(@PathVariable Long id) {
        systemConfigMapper.deleteById(id);
        return Result.success(null);
    }
}
