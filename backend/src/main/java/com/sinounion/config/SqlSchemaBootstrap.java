package com.sinounion.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 启动时以 sinounion.sql 为唯一数据源，对数据库做结构自检：
 * <ul>
 *     <li>每次启动都执行脚本中的所有 DDL（建表、建索引、建触发器、补列），保证不缺表、不缺字段；</li>
 *     <li>脚本中的 INSERT 仅在“首次初始化”时执行一次。</li>
 * </ul>
 * 首次初始化的判定：system_secrets 表不存在或其内无数据行。
 * <p>
 * 每条语句独立 try/catch 并记 warn，单条失败不会中断启动。
 */
@Slf4j
@Component
public class SqlSchemaBootstrap {

    private static final String SCRIPT_LOCATION = "sinounion.sql";

    /** 匹配 CREATE TABLE [IF NOT EXISTS] <name> ( ，表名不区分大小写，支持可选双引号。 */
    private static final Pattern CREATE_TABLE_PATTERN = Pattern.compile(
            "(?is)^\\s*CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?\"?([A-Za-z_][A-Za-z0-9_]*)\"?\\s*\\(");

    private final JdbcTemplate jdbcTemplate;

    public SqlSchemaBootstrap(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void bootstrap() {
        String script;
        try {
            script = loadScript();
        } catch (IOException e) {
            log.error("加载 {} 失败，跳过数据库结构自检", SCRIPT_LOCATION, e);
            return;
        }

        List<String> statements = splitStatements(script);
        boolean firstRun = isFirstRun();

        // 1) DDL：每次启动都执行，确保表结构与脚本一致
        for (String stmt : statements) {
            if (isInsert(stmt)) continue;
            executeQuietly(stmt, "DDL");
        }

        // 2) 补齐缺失字段（对已存在的旧表）
        ensureColumns(statements);

        // 3) 首次初始化才写入种子数据
        if (firstRun) {
            log.info("检测到首次初始化（system_secrets 不存在或为空），写入种子数据");
            for (String stmt : statements) {
                if (!isInsert(stmt)) continue;
                executeQuietly(stmt, "种子 INSERT");
            }
        } else {
            log.debug("非首次初始化，跳过种子 INSERT");
        }
    }

    private void executeQuietly(String stmt, String kind) {
        try {
            jdbcTemplate.execute(stmt);
        } catch (Exception e) {
            log.warn("执行 {} 失败（已跳过）: {} -> {}", kind, firstLine(stmt, 120), e.getMessage());
        }
    }

    /** 首次初始化：system_secrets 表不存在，或存在但无数据行。 */
    private boolean isFirstRun() {
        try {
            if (!tableExists("system_secrets")) return true;
            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM system_secrets", Integer.class);
            return count == null || count == 0;
        } catch (Exception e) {
            log.warn("判定首次初始化失败，按首次处理: {}", e.getMessage());
            return true;
        }
    }

    /** 对脚本中每个 CREATE TABLE，为已存在表补齐缺失的列。 */
    private void ensureColumns(List<String> statements) {
        Map<String, Set<String>> existingColumns = loadColumns();
        for (String stmt : statements) {
            CreateTable ct = parseCreateTable(stmt);
            if (ct == null) continue;
            Set<String> cols = existingColumns.get(ct.table);
            for (ColumnDef col : ct.columns) {
                if (col.primaryKey) continue;
                if (cols != null && cols.contains(col.name)) continue;
                if (col.definition.isEmpty()) continue;
                String sql = "ALTER TABLE " + ct.table + " ADD COLUMN IF NOT EXISTS " + col.name + " " + col.definition;
                try {
                    jdbcTemplate.execute(sql);
                    log.info("补齐字段 {}.{}", ct.table, col.name);
                } catch (Exception e) {
                    log.warn("补齐字段 {}.{} 失败: {}", ct.table, col.name, e.getMessage());
                }
            }
        }
    }

    private Set<String> loadTables() {
        Set<String> set = new HashSet<>();
        try {
            set.addAll(jdbcTemplate.queryForList(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", String.class));
        } catch (Exception e) {
            log.warn("读取表清单失败: {}", e.getMessage());
        }
        return set;
    }

    private Map<String, Set<String>> loadColumns() {
        Map<String, Set<String>> map = new HashMap<>();
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'");
            for (Map<String, Object> row : rows) {
                String table = String.valueOf(row.get("table_name"));
                String column = String.valueOf(row.get("column_name"));
                Set<String> cols = map.get(table);
                if (cols == null) {
                    cols = new HashSet<>();
                    map.put(table, cols);
                }
                cols.add(column);
            }
        } catch (Exception e) {
            log.warn("读取字段清单失败: {}", e.getMessage());
        }
        return map;
    }

    private boolean tableExists(String table) {
        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
                    Integer.class, table.toLowerCase(Locale.ROOT));
            return count != null && count > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private String loadScript() throws IOException {
        ClassPathResource resource = new ClassPathResource(SCRIPT_LOCATION);
        try (InputStream in = resource.getInputStream()) {
            return StreamUtils.copyToString(in, StandardCharsets.UTF_8);
        }
    }

    // ────────────────────────── SQL 解析（无副作用，便于单测） ──────────────────────────

    /** 将整段脚本按顶层分号切分为语句；正确处理注释、字符串、双引号标识符与 $$/$tag$ 块。 */
    static List<String> splitStatements(String script) {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int n = script.length();
        int i = 0;
        while (i < n) {
            char c = script.charAt(i);

            if (c == '-' && i + 1 < n && script.charAt(i + 1) == '-') {
                int end = script.indexOf('\n', i);
                end = end < 0 ? n : end;
                current.append(script, i, end);
                i = end;
                continue;
            }
            if (c == '/' && i + 1 < n && script.charAt(i + 1) == '*') {
                int end = script.indexOf("*/", i + 2);
                end = end < 0 ? n : end + 2;
                current.append(script, i, end);
                i = end;
                continue;
            }
            if (c == '\'' || c == '"') {
                int end = skipQuoted(script, i, c);
                current.append(script, i, end);
                i = end;
                continue;
            }
            if (c == '$') {
                int end = skipDollar(script, i);
                if (end > i) {
                    current.append(script, i, end);
                    i = end;
                    continue;
                }
            }
            if (c == ';') {
                addStatement(statements, current.toString());
                current.setLength(0);
                i++;
                continue;
            }
            current.append(c);
            i++;
        }
        addStatement(statements, current.toString());
        return statements;
    }

    private static void addStatement(List<String> out, String raw) {
        String stmt = raw.trim();
        if (!stmt.isEmpty() && !stripComments(stmt).trim().isEmpty()) {
            out.add(stmt);
        }
    }

    /** 语句首关键字是否为 INSERT（忽略前置注释）。 */
    static boolean isInsert(String stmt) {
        return "INSERT".equalsIgnoreCase(firstKeyword(stmt));
    }

    private static String firstKeyword(String stmt) {
        String s = stripComments(stmt);
        int i = 0;
        int n = s.length();
        while (i < n && !Character.isLetter(s.charAt(i))) i++;
        int j = i;
        while (j < n && Character.isLetter(s.charAt(j))) j++;
        return s.substring(i, j);
    }

    /** 去除行注释与块注释（用于分类/解析；语句执行时保留原始文本）。 */
    static String stripComments(String sql) {
        StringBuilder sb = new StringBuilder();
        int n = sql.length();
        int i = 0;
        while (i < n) {
            char c = sql.charAt(i);
            if (c == '-' && i + 1 < n && sql.charAt(i + 1) == '-') {
                int end = sql.indexOf('\n', i);
                i = end < 0 ? n : end;
                sb.append('\n');
                continue;
            }
            if (c == '/' && i + 1 < n && sql.charAt(i + 1) == '*') {
                int end = sql.indexOf("*/", i + 2);
                i = end < 0 ? n : end + 2;
                continue;
            }
            sb.append(c);
            i++;
        }
        return sb.toString();
    }

    /** 解析 CREATE TABLE 语句；非 CREATE TABLE 返回 null。 */
    static CreateTable parseCreateTable(String stmt) {
        String clean = stripComments(stmt).trim();
        Matcher m = CREATE_TABLE_PATTERN.matcher(clean);
        if (!m.find()) return null;
        String table = m.group(1).toLowerCase(Locale.ROOT);
        int openIdx = clean.indexOf('(', m.start());
        if (openIdx < 0) return null;
        int closeIdx = matchingParenEnd(clean, openIdx);
        if (closeIdx < 0) return null;
        String body = clean.substring(openIdx + 1, closeIdx);

        List<ColumnDef> columns = new ArrayList<>();
        for (String part : splitTopLevelCommas(body)) {
            String p = part.trim();
            if (p.isEmpty()) continue;
            String upper = p.toUpperCase(Locale.ROOT);
            if (upper.startsWith("CONSTRAINT") || upper.startsWith("PRIMARY")
                    || upper.startsWith("UNIQUE") || upper.startsWith("FOREIGN")
                    || upper.startsWith("CHECK") || upper.startsWith("EXCLUDE")) {
                continue;
            }
            int ws = firstWhitespace(p);
            String name = (ws < 0 ? p : p.substring(0, ws)).replace("\"", "").toLowerCase(Locale.ROOT);
            String definition = ws < 0 ? "" : p.substring(ws + 1).trim();
            boolean primaryKey = definition.toUpperCase(Locale.ROOT).contains("PRIMARY KEY");
            columns.add(new ColumnDef(name, definition, primaryKey));
        }
        return new CreateTable(table, columns);
    }

    private static int firstWhitespace(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (Character.isWhitespace(s.charAt(i))) return i;
        }
        return -1;
    }

    /** 找到与 openIdx 处 '(' 匹配的 ')' 的下标。 */
    private static int matchingParenEnd(String s, int openIdx) {
        int depth = 0;
        int i = openIdx;
        int n = s.length();
        while (i < n) {
            char c = s.charAt(i);
            if (c == '\'' || c == '"') {
                i = skipQuoted(s, i, c);
                continue;
            }
            if (c == '$') {
                int end = skipDollar(s, i);
                if (end > i) {
                    i = end;
                    continue;
                }
            }
            if (c == '(') {
                depth++;
            } else if (c == ')') {
                depth--;
                if (depth == 0) return i;
            }
            i++;
        }
        return -1;
    }

    /** 按顶层逗号切分（忽略括号内、字符串内、$$ 块内的逗号）。 */
    private static List<String> splitTopLevelCommas(String body) {
        List<String> parts = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        int depth = 0;
        int i = 0;
        int n = body.length();
        while (i < n) {
            char c = body.charAt(i);
            if (c == '\'' || c == '"') {
                int end = skipQuoted(body, i, c);
                cur.append(body, i, end);
                i = end;
                continue;
            }
            if (c == '$') {
                int end = skipDollar(body, i);
                if (end > i) {
                    cur.append(body, i, end);
                    i = end;
                    continue;
                }
            }
            if (c == '(') {
                depth++;
            } else if (c == ')') {
                depth--;
            } else if (c == ',' && depth == 0) {
                parts.add(cur.toString());
                cur.setLength(0);
                i++;
                continue;
            }
            cur.append(c);
            i++;
        }
        parts.add(cur.toString());
        return parts;
    }

    /** 跳过带引号文本（'' 或 "" 转义），返回结束引号后的下标。 */
    private static int skipQuoted(String s, int start, char quote) {
        int j = start + 1;
        int n = s.length();
        while (j < n) {
            if (s.charAt(j) == quote) {
                if (j + 1 < n && s.charAt(j + 1) == quote) {
                    j += 2;
                    continue;
                }
                return j + 1;
            }
            j++;
        }
        return n;
    }

    /** 若 start 处是 $$/$tag$ 起始，返回其结束下标；否则返回 -1。 */
    private static int skipDollar(String s, int start) {
        int tagEnd = dollarTagEnd(s, start);
        if (tagEnd <= start) return -1;
        String tag = s.substring(start, tagEnd);
        int close = s.indexOf(tag, tagEnd);
        return close < 0 ? s.length() : close + tag.length();
    }

    /** 识别 start 处的 $...$ 起始标签，返回标签结束（闭合 $ 之后）下标；非标签返回 -1。 */
    private static int dollarTagEnd(String s, int start) {
        int j = start + 1;
        int n = s.length();
        while (j < n) {
            char c = s.charAt(j);
            if (c == '$') return j + 1;
            if (Character.isLetterOrDigit(c) || c == '_') {
                j++;
                continue;
            }
            return -1;
        }
        return -1;
    }

    private static String firstLine(String s, int max) {
        String one = stripComments(s).trim().replaceAll("\\s+", " ");
        return one.length() > max ? one.substring(0, max) + "..." : one;
    }

    static final class CreateTable {
        final String table;
        final List<ColumnDef> columns;

        CreateTable(String table, List<ColumnDef> columns) {
            this.table = table;
            this.columns = columns;
        }
    }

    static final class ColumnDef {
        final String name;
        final String definition;
        final boolean primaryKey;

        ColumnDef(String name, String definition, boolean primaryKey) {
            this.name = name;
            this.definition = definition;
            this.primaryKey = primaryKey;
        }
    }
}
