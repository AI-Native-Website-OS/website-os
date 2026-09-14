package com.sinounion.config;

import com.sinounion.util.ModelConfigKeys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@org.springframework.context.annotation.Profile("!test")
public class DatabaseInitializer {

    private final JdbcTemplate jdbcTemplate;

    private boolean vectorAvailable;

    public DatabaseInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void init() {
        try {
            try {
                jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");
            } catch (Exception e) {
                log.debug("Cannot create vector extension: {}", e.getMessage());
            }
            vectorAvailable = vectorExtensionExists();

            InputStream is = new ClassPathResource("sinounion.sql").getInputStream();
            String sqlContent = StreamUtils.copyToString(is, StandardCharsets.UTF_8);
            List<String> statements = parseStatements(sqlContent);

            List<String> commentStatements = new ArrayList<>();

            for (String stmt : statements) {
                String trimmed = stmt.trim();
                if (trimmed.isEmpty()) continue;
                String upper = trimmed.toUpperCase();
                if (upper.startsWith("COMMENT ON")) {
                    commentStatements.add(trimmed);
                    continue;
                }
                if (!vectorAvailable && trimmed.contains("vector(")) {
                    log.debug("vector extension not available, skipping: {}", trimmed.substring(0, Math.min(60, trimmed.length())));
                    continue;
                }
                try {
                    jdbcTemplate.execute(trimmed);
                } catch (Exception e) {
                    log.debug("SQL skipped (may already exist): {}", e.getMessage());
                }
            }

            migrateMissingColumns();

            ensureSuperAdminPermissions();

            seedModelConfigFromEnv();

            for (String stmt : commentStatements) {
                try {
                    jdbcTemplate.execute(stmt);
                } catch (Exception e) {
                    log.debug("COMMENT skipped: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Failed to initialize database from sinounion.sql", e);
        }
    }

    private boolean vectorExtensionExists() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_extension WHERE extname = 'vector'", Integer.class);
            return count != null && count > 0;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 确保超级管理员角色拥有全部权限映射（幂等）。
     * 用于修复旧库缺失权限映射导致的 403，以及后续新增权限点自动同步给 SUPER_ADMIN。
     */
    private void ensureSuperAdminPermissions() {
        try {
            if (!tableExists("permissions") || !tableExists("role_permissions")) {
                return;
            }
            jdbcTemplate.update(
                "INSERT INTO role_permissions (role, permission_id) SELECT 'SUPER_ADMIN', id FROM permissions ON CONFLICT (role, permission_id) DO NOTHING");
        } catch (Exception e) {
            log.warn("Failed to ensure SUPER_ADMIN permissions: {}", e.getMessage());
        }
    }

    private boolean tableExists(String tableName) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
                    Integer.class, tableName.toLowerCase());
            return count != null && count > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private List<String> parseStatements(String sql) {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inSingleQuote = false;
        boolean inDollarTag = false;
        String dollarTag = null;
        boolean inLineComment = false;
        boolean inBlockComment = false;

        for (int i = 0; i < sql.length(); i++) {
            char c = sql.charAt(i);
            char next = (i + 1 < sql.length()) ? sql.charAt(i + 1) : 0;

            if (inLineComment) {
                if (c == '\n') {
                    inLineComment = false;
                    current.append('\n');
                }
                continue;
            }
            if (inBlockComment) {
                if (c == '*' && next == '/') {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }

            if (!inSingleQuote && !inDollarTag) {
                if (c == '-' && next == '-') {
                    inLineComment = true;
                    i++;
                    continue;
                }
                if (c == '/' && next == '*') {
                    inBlockComment = true;
                    i++;
                    continue;
                }
            }

            // Track single quotes
            if (c == '\'' && !inDollarTag) {
                inSingleQuote = !inSingleQuote;
            }

            // Track PostgreSQL dollar-quoting (e.g. $$...$$ or $func$...$func$)
            if (!inSingleQuote && !inBlockComment && !inLineComment) {
                if (!inDollarTag && c == '$') {
                    int end = sql.indexOf('$', i + 1);
                    if (end > i) {
                        inDollarTag = true;
                        dollarTag = sql.substring(i, end + 1);
                        current.append(dollarTag);
                        i = end;
                        continue;
                    }
                } else if (inDollarTag && c == '$') {
                    String possibleEnd = extractDollarTag(sql, i);
                    if (possibleEnd != null && possibleEnd.equals(dollarTag)) {
                        inDollarTag = false;
                        dollarTag = null;
                        current.append(possibleEnd);
                        i += possibleEnd.length() - 1;
                        continue;
                    }
                }
            }

            if (c == ';' && !inSingleQuote && !inDollarTag) {
                String stmt = current.toString().trim();
                if (!stmt.isEmpty()) {
                    statements.add(stmt);
                }
                current = new StringBuilder();
                continue;
            }

            current.append(c);
        }

        String last = current.toString().trim();
        if (!last.isEmpty()) {
            statements.add(last);
        }

        return statements;
    }

    private String extractDollarTag(String sql, int start) {
        StringBuilder tag = new StringBuilder("$");
        for (int i = start + 1; i < sql.length(); i++) {
            char c = sql.charAt(i);
            if (c == '$') {
                tag.append('$');
                return tag.toString();
            }
            tag.append(c);
        }
        return null;
    }

    private void migrateMissingColumns() {
        String[][] columnsToAdd = {
            {"content_items", "category_id", "BIGINT"},
            {"content_items", "is_top", "INT DEFAULT 0"},
            {"content_items", "scheduled_at", "TIMESTAMP"},
            {"content_items", "published_at", "TIMESTAMP"},
            {"content_items", "author", "VARCHAR(100)"},
            {"content_items", "source", "VARCHAR(100)"},
            {"content_items", "download_count", "INT DEFAULT 0"},
            {"content_items", "require_form", "INT DEFAULT 0"},
            {"content_items", "cover_scale", "VARCHAR(20)"},
            {"core_modules", "is_system", "SMALLINT DEFAULT 0"},
            {"users", "deleted", "SMALLINT DEFAULT 0"},
            {"users", "role", "VARCHAR(30) DEFAULT 'VISITOR'"},
            {"users", "user_type", "VARCHAR(20) DEFAULT 'EXTERNAL'"},
            {"users", "department", "VARCHAR(100)"},
            {"faqs", "deleted", "SMALLINT DEFAULT 0"},
            {"contacts", "icon", "VARCHAR(50)"},
            // leads IP/城市 增强
            {"leads", "ip_address", "VARCHAR(50)"},
            {"leads", "country", "VARCHAR(100)"},
            {"leads", "province", "VARCHAR(100)"},
            {"leads", "city", "VARCHAR(100)"},
            // pgvector / knowledge base migrations
            {"knowledge_documents", "source_type", "VARCHAR(50) DEFAULT NULL"},
            {"knowledge_documents", "source_id", "BIGINT DEFAULT NULL"},
            {"knowledge_documents", "content", "TEXT DEFAULT ''"},
            // seo_configs GEO 扩展
            {"seo_configs", "robots", "VARCHAR(50)"},
            {"seo_configs", "og_type", "VARCHAR(20)"},
            {"seo_configs", "geo_summary", "TEXT"},
            {"seo_configs", "enabled", "INT DEFAULT 1"},
        };

        for (String[] col : columnsToAdd) {
            if (!columnExists(col[0], col[1])) {
                try {
                    jdbcTemplate.execute("ALTER TABLE " + col[0] + " ADD COLUMN " + col[1] + " " + col[2]);
                    log.info("Added column {}.{} to existing table", col[0], col[1]);
                } catch (Exception e) {
                    log.warn("Failed to add column {}.{}: {}", col[0], col[1], e.getMessage());
                }
            }
        }

        // Add/upgrade embedding column on knowledge_chunks (vector extension already created in init())
        if (tableExists("knowledge_chunks")) {
            if (!columnExists("knowledge_chunks", "embedding")) {
                if (vectorAvailable) {
                    try {
                        jdbcTemplate.execute("ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(2048)");
                        log.info("Added knowledge_chunks.embedding column");
                    } catch (Exception e) {
                        log.warn("Failed to add embedding column: {}", e.getMessage());
                    }
                } else {
                    log.info("pgvector not available, knowledge_chunks will not have vector column");
                }
            } else {
                try {
                    String type = jdbcTemplate.queryForObject(
                        "SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_chunks' AND column_name = 'embedding'",
                        String.class);
                    if ("ARRAY".equalsIgnoreCase(type)) {
                        jdbcTemplate.execute("ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(2048) USING embedding::vector");
                        log.info("Migrated knowledge_chunks.embedding from double precision[] to vector(2048)");
                    }
                } catch (Exception e) {
                    log.warn("Failed to migrate embedding column type: {}", e.getMessage());
                }
            }
        }

        // Create unique index on knowledge_documents(source_type, source_id) if not exists
        if (tableExists("knowledge_documents") && columnExists("knowledge_documents", "source_type")) {
            try {
                jdbcTemplate.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_source ON knowledge_documents(source_type, source_id)");
            } catch (Exception e) {
                log.debug("Index idx_docs_source may already exist: {}", e.getMessage());
            }
        }

        // Ensure a default knowledge base exists (ID=1)
        if (tableExists("knowledge_bases")) {
            try {
                Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM knowledge_bases", Integer.class);
                if (count != null && count == 0) {
                    jdbcTemplate.execute("INSERT INTO knowledge_bases (id, name, description) VALUES (1, '网站内容', '同步的产品、方案、案例、文章等网站内容')");
                    log.info("Created default knowledge base '网站内容'");
                }
            } catch (Exception e) {
                log.debug("Default knowledge base creation: {}", e.getMessage());
            }
        }
    }

    /**
     * 首次启动时将当前环境中的模型配置写入 system_configs 表（仅缺失的行）。
     * 之后模型配置以数据库为准，后台修改不再写回 .env。
     */
    private void seedModelConfigFromEnv() {
        try {
            if (!tableExists("system_configs")) {
                return;
            }
            Map<String, String> envFile = readEnvFile();
            for (String key : ModelConfigKeys.DB_BACKED_KEYS) {
                Integer count = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM system_configs WHERE config_key = ?",
                        Integer.class, key);
                if (count != null && count > 0) {
                    continue;
                }
                String value = System.getProperty(key);
                if (value == null) {
                    value = envFile.get(key);
                }
                if (value == null) {
                    value = System.getenv(key);
                }
                if (value == null || value.trim().isEmpty()) {
                    continue;
                }
                jdbcTemplate.update(
                        "INSERT INTO system_configs (config_key, config_value, config_type, description) VALUES (?, ?, 'model', ?)",
                        key, value, ModelConfigKeys.DESCRIPTIONS.getOrDefault(key, "AI 模型配置"));
                log.info("Seeded model config {} into system_configs", key);
            }
        } catch (Exception e) {
            log.warn("Failed to seed model configs into system_configs: {}", e.getMessage());
        }
    }

    private Map<String, String> readEnvFile() {
        String userDir = System.getProperty("user.dir");
        Path p = Paths.get(userDir, "..", ".env").normalize();
        if (!Files.exists(p)) {
            p = Paths.get(userDir, ".env").normalize();
        }
        Map<String, String> map = new HashMap<>();
        if (!Files.exists(p)) {
            return map;
        }
        try {
            for (String line : Files.readAllLines(p, StandardCharsets.UTF_8)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                int eq = trimmed.indexOf('=');
                if (eq <= 0) continue;
                String key = trimmed.substring(0, eq).trim();
                String val = trimmed.substring(eq + 1).trim();
                if (!key.isEmpty()) map.put(key, val);
            }
        } catch (IOException ignored) {}
        return map;
    }

    private boolean columnExists(String tableName, String columnName) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name = ?",
                    Integer.class, tableName.toLowerCase(), columnName.toLowerCase());
            return count != null && count > 0;
        } catch (Exception e) {
            return false;
        }
    }
}
