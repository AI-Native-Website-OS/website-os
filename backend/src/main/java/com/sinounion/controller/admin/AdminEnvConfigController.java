package com.sinounion.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.common.Result;
import com.sinounion.config.SecretCryptoService;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import com.sinounion.util.ModelConfigKeys;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;


@Slf4j
@Tag(name = "管理后台-环境变量", description = "环境变量在线查看与编辑")
@RestController
@RequestMapping("/admin/system/env-configs")
@RequiredArgsConstructor
public class AdminEnvConfigController {

    private final SystemConfigMapper systemConfigMapper;
    private final SecretCryptoService secretCryptoService;

    private static final List<String> MANAGED_KEYS = Arrays.asList(
        // ── Database ──
        "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD",
        "SPRING_DATASOURCE_URL", "SPRING_DATASOURCE_USERNAME", "SPRING_DATASOURCE_PASSWORD",
        // ── Redis ──
        "SPRING_REDIS_HOST", "SPRING_REDIS_PORT", "SPRING_REDIS_PASSWORD", "SPRING_REDIS_DATABASE",
        // ── Ports ──
        "BACKEND_PORT", "AI_PORT", "FRONTEND_PORT", "SERVER_PORT",
        "API_SERVER_URL",
        // ── JWT ──
        "JWT_SECRET", "JWT_EXPIRATION",
        // ── LLM Model Config ──
        "LLM_PROVIDER", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL",
        "LLM_TEMPERATURE", "LLM_MAX_TOKENS", "LLM_TOP_P",
        "LLM_FREQUENCY_PENALTY", "LLM_PRESENCE_PENALTY",
        "LLM_SEED", "LLM_STOP",
        "LLM_THINKING_KEYWORD", "LLM_THINKING_AUTO_COLLAPSE",
        "LLM_THINKING_ENABLED",
        // ── Embedding Model Config ──
        "EMBEDDING_PROVIDER", "EMBEDDING_BASE_URL", "EMBEDDING_API_KEY",
        "EMBEDDING_MODEL", "EMBEDDING_DIMENSION",
        // ── VL Model Config ──
        "VL_PROVIDER", "VL_BASE_URL", "VL_API_KEY",
        "VL_MODEL", "VL_TEMPERATURE", "VL_MAX_TOKENS",
        "VL_IMAGE_SIZE", "VL_IMAGE_QUALITY",
        // ── Rerank Model Config ──
        "RERANK_PROVIDER", "RERANK_BASE_URL", "RERANK_API_KEY",
        "RERANK_MODEL", "RERANK_ENABLED", "RERANK_TOP_K",
        // ── Logging ──
        "LOG_LEVEL", "LOG_FILE",
        "LOGGING_LEVEL_COM_SINOUNION", "LOGGING_LEVEL_ORG_SPRINGFRAMEWORK",
        // ── Backend ──
        "SPRING_APPLICATION_NAME",
        "UPLOAD_PATH", "UPLOAD_ALLOWED_TYPES",
        "AI_SERVICE_URL", "AI_SERVICE_MEMORIES_DIR",
        "APP_FRONTEND_PUBLIC_DIR", "APP_FRONTEND_DIST_DIR", "APP_CONFIG_FILE_PATH"
    );

    private Path resolveEnvPath() {
        String userDir = System.getProperty("user.dir");
        Path p = Paths.get(userDir, "..", ".env").normalize();
        if (Files.exists(p)) return p;
        p = Paths.get(userDir, ".env").normalize();
        if (Files.exists(p)) return p;
        return Paths.get(userDir, "..", ".env").normalize();
    }

    private Map<String, String> parseEnvFile(Path path) throws IOException {
        Map<String, String> map = new LinkedHashMap<>();
        if (!Files.exists(path)) return map;
        for (String line : Files.readAllLines(path, StandardCharsets.UTF_8)) {
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
            int eq = trimmed.indexOf('=');
            if (eq <= 0) continue;
            String key = trimmed.substring(0, eq).trim();
            String val = trimmed.substring(eq + 1).trim();
            if (key.isEmpty()) continue;
            if (val.startsWith("\"") && val.endsWith("\"")) {
                val = val.substring(1, val.length() - 1);
            } else if (val.startsWith("'") && val.endsWith("'")) {
                val = val.substring(1, val.length() - 1);
            }
            map.put(key, val);
        }
        return map;
    }

    @Operation(summary = "获取所有受管环境变量")
    @GetMapping
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<List<Map<String, String>>> getEnvConfigs() {
        Map<String, String> envFile = new HashMap<>();
        try {
            envFile = parseEnvFile(resolveEnvPath());
        } catch (IOException ignored) {}

        // 模型配置已迁移至 system_configs 表，优先从数据库读取
        Map<String, String> dbValues = loadDbModelConfigs();

        List<Map<String, String>> items = new ArrayList<>();
        for (String key : MANAGED_KEYS) {
            Map<String, String> entry = new LinkedHashMap<>();
            // Priority: DB (model config) > System.setProperty (runtime) > .env file > System.getenv (OS)
            String val = null;
            if (ModelConfigKeys.DB_BACKED_KEYS.contains(key)) {
                val = dbValues.get(key);
            }
            if (val == null) val = System.getProperty(key);
            if (val == null) val = envFile.get(key);
            if (val == null) val = System.getenv(key);
            entry.put("key", key);
            entry.put("value", secretCryptoService.mask(key, val != null ? val : ""));
            items.add(entry);
        }
        return Result.success(items);
    }

    @Operation(summary = "更新环境变量值（模型配置写入数据库）")
    @PutMapping
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<Void> updateEnvConfigs(@RequestBody List<Map<String, String>> updates) {
        try {
            Path envPath = resolveEnvPath();
            Map<String, String> dbUpdateMap = new LinkedHashMap<>();
            Map<String, String> envUpdateMap = new LinkedHashMap<>();
            for (Map<String, String> item : updates) {
                String key = item.get("key");
                String value = item.get("value");
                if (key == null || key.isEmpty()) continue;
                if (ModelConfigKeys.DB_BACKED_KEYS.contains(key)) {
                    String resolved = secretCryptoService.resolveForStorage(key, value);
                    if (resolved != null) {
                        dbUpdateMap.put(key, resolved);
                    }
                } else {
                    String resolved = secretCryptoService.resolvePlain(key, value);
                    if (resolved != null) {
                        envUpdateMap.put(key, resolved);
                        System.setProperty(key, resolved);
                    }
                }
            }

            // 模型配置 → system_configs 表（AI 服务 Python 侧从该表读取，实现动态更新）
            for (Map.Entry<String, String> e : dbUpdateMap.entrySet()) {
                upsertModelConfig(e.getKey(), e.getValue());
            }
            if (!dbUpdateMap.isEmpty()) {
                log.info("Model configs saved to system_configs table: {}", dbUpdateMap.keySet());
            }

            if (!envUpdateMap.isEmpty()) {
                List<String> lines = Files.exists(envPath)
                    ? new ArrayList<>(Files.readAllLines(envPath, StandardCharsets.UTF_8))
                    : new ArrayList<>();

                Set<String> updated = new HashSet<>();
                for (int i = 0; i < lines.size(); i++) {
                    String line = lines.get(i).trim();
                    if (line.isEmpty() || line.startsWith("#")) continue;
                    int eq = line.indexOf('=');
                    if (eq <= 0) continue;
                    String key = line.substring(0, eq).trim();
                    if (key.isEmpty()) continue;
                    if (envUpdateMap.containsKey(key)) {
                        lines.set(i, key + "=" + envUpdateMap.get(key));
                        updated.add(key);
                    }
                }

                // Append new keys not found in file
                for (Map.Entry<String, String> e : envUpdateMap.entrySet()) {
                    if (!updated.contains(e.getKey())) {
                        lines.add(e.getKey() + "=" + e.getValue());
                    }
                }

                Files.write(envPath, lines, StandardCharsets.UTF_8);
                log.info("Env configs saved to {}", envPath.toAbsolutePath());
            }
            return Result.success("保存成功", null);
        } catch (IOException e) {
            log.error("Failed to save env configs", e);
            return Result.error("保存环境变量失败: " + e.getMessage());
        }
    }

    private Map<String, String> loadDbModelConfigs() {
        Map<String, String> result = new HashMap<>();
        try {
            for (SystemConfig sc : systemConfigMapper.selectList(
                    new LambdaQueryWrapper<SystemConfig>().in(SystemConfig::getConfigKey, ModelConfigKeys.DB_BACKED_KEYS))) {
                result.put(sc.getConfigKey(), sc.getConfigValue() != null ? sc.getConfigValue() : "");
            }
        } catch (Exception e) {
            log.warn("Failed to load model configs from database: {}", e.getMessage());
        }
        return result;
    }

    private void upsertModelConfig(String key, String value) {
        SystemConfig existing = systemConfigMapper.findByKey(key);
        if (existing != null) {
            existing.setConfigValue(value);
            systemConfigMapper.updateById(existing);
        } else {
            SystemConfig sc = new SystemConfig();
            sc.setConfigKey(key);
            sc.setConfigValue(value);
            sc.setConfigType("model");
            sc.setDescription(ModelConfigKeys.DESCRIPTIONS.getOrDefault(key, "AI 模型配置"));
            systemConfigMapper.insert(sc);
        }
    }
}
