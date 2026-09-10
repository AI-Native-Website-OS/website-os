package com.sinounion.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.common.Result;
import com.sinounion.config.SecretCryptoService;
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
    private final SecretCryptoService secretCryptoService;

    @Operation(summary = "获取所有系统配置")
    @GetMapping
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<List<SystemConfig>> getConfigs() {
        List<SystemConfig> configs = systemConfigMapper.selectList(new LambdaQueryWrapper<>());
        for (SystemConfig c : configs) {
            maskEntity(c);
        }
        return Result.success(configs);
    }

    @Operation(summary = "获取单个配置")
    @GetMapping("/{key}")
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<SystemConfig> getConfig(@PathVariable String key) {
        return Result.success(maskEntity(systemConfigMapper.findByKey(key)));
    }

    @Operation(summary = "创建或更新配置")
    @PostMapping
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<SystemConfig> saveConfig(@Valid @RequestBody SystemConfig config) {
        String key = config.getConfigKey();
        SystemConfig existing = systemConfigMapper.findByKey(key);
        String description = config.getDescription();
        String configType = config.getConfigType();

        String valueToStore;
        if (secretCryptoService.isSensitive(key)) {
            String resolved = secretCryptoService.resolveForStorage(key, config.getConfigValue());
            if (resolved == null) {
                // 留空/掩码占位 → 保持原值（仅更新元信息）
                if (existing != null) {
                    existing.setDescription(description);
                    existing.setConfigType(configType);
                    systemConfigMapper.updateById(existing);
                    return Result.success(maskEntity(existing));
                }
                valueToStore = "";
            } else {
                valueToStore = resolved;
            }
        } else {
            valueToStore = config.getConfigValue();
        }

        if (existing != null) {
            existing.setConfigValue(valueToStore);
            existing.setDescription(description);
            existing.setConfigType(configType);
            systemConfigMapper.updateById(existing);
            if ("about_page".equals(key)) {
                knowledgeSyncService.syncAboutPage(valueToStore);
            }
            return Result.success(maskEntity(existing));
        }
        config.setConfigValue(valueToStore);
        systemConfigMapper.insert(config);
        if ("about_page".equals(key)) {
            knowledgeSyncService.syncAboutPage(valueToStore);
        }
        return Result.success(maskEntity(config));
    }

    @Operation(summary = "删除配置")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<Void> deleteConfig(@PathVariable Long id) {
        systemConfigMapper.deleteById(id);
        return Result.success(null);
    }

    /** 敏感配置项响应前脱敏，避免明文回显到前端。 */
    private SystemConfig maskEntity(SystemConfig config) {
        if (config != null) {
            config.setConfigValue(secretCryptoService.mask(config.getConfigKey(), config.getConfigValue()));
        }
        return config;
    }
}
