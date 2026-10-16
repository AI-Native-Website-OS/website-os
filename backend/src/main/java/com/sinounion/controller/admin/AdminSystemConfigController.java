package com.sinounion.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.common.Result;
import com.sinounion.config.SecretCryptoService;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import com.sinounion.service.KnowledgeSyncDispatcher;
import com.sinounion.translation.TranslationEnqueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@Tag(name = "管理后台-系统配置", description = "系统配置管理")
@RestController
@RequestMapping("/admin/system-configs")
@RequiredArgsConstructor
public class AdminSystemConfigController {

    private final SystemConfigMapper systemConfigMapper;
    private final KnowledgeSyncDispatcher knowledgeSyncDispatcher;
    private final SecretCryptoService secretCryptoService;
    private final TranslationEnqueueService translationEnqueueService;
    private final ObjectMapper objectMapper;

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
            syncPageConfig(key, valueToStore);
            enqueueConfigTranslation(key, valueToStore);
            return Result.success(maskEntity(existing));
        }
        config.setConfigValue(valueToStore);
        systemConfigMapper.insert(config);
        syncPageConfig(key, valueToStore);
        enqueueConfigTranslation(key, valueToStore);
        return Result.success(maskEntity(config));
    }

    /** 页面整体配置（about_page / home_page / ai_website_config）变更后同步到知识库。 */
    private void syncPageConfig(String key, String value) {
        if ("about_page".equals(key)) {
            knowledgeSyncDispatcher.syncAboutPage(value);
        } else if ("home_page".equals(key)) {
            knowledgeSyncDispatcher.syncHomePage(value);
        } else if ("ai_website_config".equals(key)) {
            knowledgeSyncDispatcher.syncVersionConfig(value);
        }
    }

    /** 可译配置项：JSON 解析后入队翻译（site_brand 按登记字段，其余递归全部中文字段）。 */
    private static final List<String> TRANSLATABLE_CONFIG_KEYS =
            java.util.Arrays.asList("site_brand", "ai_website_config", "site_notices");

    private void enqueueConfigTranslation(String key, String value) {
        if (value == null || value.trim().isEmpty() || !TRANSLATABLE_CONFIG_KEYS.contains(key)) {
            return;
        }
        try {
            Object parsed = objectMapper.readValue(value, Object.class);
            if ("site_brand".equals(key)) {
                if (parsed instanceof Map) {
                    translationEnqueueService.enqueueConfig("site_brand",
                            (Map<String, Object>) parsed);
                }
            } else {
                translationEnqueueService.enqueueConfigValue(key, parsed);
            }
        } catch (Exception ignored) {
            // 解析失败忽略，不影响配置保存
        }
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
