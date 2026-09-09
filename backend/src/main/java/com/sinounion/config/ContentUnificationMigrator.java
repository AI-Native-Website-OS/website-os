package com.sinounion.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.util.SlugService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 一次性内容统一迁移器（幂等）：
 * 将内置产品/方案/案例/资源及其分类/关联内容迁移到通用 content_items / content_categories，
 * 并重映射 faqs.product_id，成功后删除旧表。
 * 仅当旧表存在且 content_items 尚无内置模块数据时执行。
 */
@Slf4j
@Component
@org.springframework.context.annotation.Profile("!test")
public class ContentUnificationMigrator implements ApplicationRunner {

    private static final String[] BUILTIN_KEYS = {"products", "solutions", "cases", "resources"};

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final SlugService slugService;
    private final TransactionTemplate transactionTemplate;

    public ContentUnificationMigrator(JdbcTemplate jdbcTemplate,
                                      ObjectMapper objectMapper,
                                      SlugService slugService,
                                      PlatformTransactionManager transactionManager) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.slugService = slugService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (!tableExists("products")) {
                log.info("[ContentUnification] 旧内置表不存在，跳过迁移");
                return;
            }
            Long migrated = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM content_items WHERE module_key IN ('products','solutions','cases','resources')",
                    Long.class);
            if (migrated != null && migrated > 0) {
                log.info("[ContentUnification] 内置内容已迁移，跳过");
                return;
            }
            log.info("[ContentUnification] 开始迁移内置产品/方案/案例/资源到通用内容引擎");
            transactionTemplate.executeWithoutResult(status -> doMigrate());
            log.info("[ContentUnification] 迁移完成，旧表已清理");
        } catch (Exception e) {
            log.error("[ContentUnification] 迁移失败（原数据未受影响，可在修复后重启重试）", e);
        }
    }

    private void doMigrate() {
        ensureContentItemColumns();
        ensureSystemModules();

        Map<Long, Long> productLineMap = migrateCategories("product_lines", "products", "产品线");
        Map<Long, Long> industryMap = migrateCategories("industries", "solutions", "行业");
        Map<Long, Long> resourceCatMap = migrateCategories("resource_categories", "resources", "资源分类");

        Map<Long, Long> productMap = migrateProducts(productLineMap);
        Map<Long, Long> solutionMap = migrateSolutions(industryMap);
        Map<Long, Long> caseMap = migrateCases();
        Map<Long, Long> resourceMap = migrateResources(resourceCatMap);

        attachRelations("products", "products", productMap, Arrays.asList(
                rel("related_solutions", "solutions", solutionMap),
                rel("typical_cases", "cases", caseMap),
                rel("related_cases", "cases", caseMap),
                rel("related_whitepapers", "resources", resourceMap),
                rel("related_articles", "resources", resourceMap)));
        attachRelations("solutions", "solutions", solutionMap, Arrays.asList(
                rel("related_products", "products", productMap),
                rel("related_cases", "cases", caseMap),
                rel("related_whitepapers", "resources", resourceMap),
                rel("related_articles", "resources", resourceMap)));
        attachRelations("cases", "cases", caseMap, Arrays.asList(
                rel("related_products", "products", productMap),
                rel("related_solutions", "solutions", solutionMap),
                rel("related_whitepapers", "resources", resourceMap),
                rel("related_articles", "resources", resourceMap)));
        attachRelations("resources", "resources", resourceMap, Arrays.asList(
                rel("related_products", "products", productMap),
                rel("related_solutions", "solutions", solutionMap),
                rel("related_cases", "cases", caseMap)));

        migrateSolutionProducts(solutionMap, productMap);
        migrateFaqProducts(productMap);

        dropOldTables();
    }

    private static Object[] rel(String column, String targetModule, Map<Long, Long> targetMap) {
        return new Object[]{column, targetModule, targetMap};
    }

    private void ensureContentItemColumns() {
        String[][] cols = {
                {"scheduled_at", "TIMESTAMP"},
                {"published_at", "TIMESTAMP"},
                {"is_top", "INT DEFAULT 0"},
                {"author", "VARCHAR(100)"},
                {"source", "VARCHAR(100)"},
                {"download_count", "INT DEFAULT 0"},
                {"require_form", "INT DEFAULT 0"},
        };
        for (String[] c : cols) {
            try {
                jdbcTemplate.execute("ALTER TABLE content_items ADD COLUMN IF NOT EXISTS " + c[0] + " " + c[1]);
            } catch (Exception e) {
                log.warn("[ContentUnification] add column {}.{} failed: {}", "content_items", c[0], e.getMessage());
            }
        }
    }

    private void ensureSystemModules() {
        for (String key : BUILTIN_KEYS) {
            Long cnt = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM core_modules WHERE module_key = ? AND deleted = 0", Long.class, key);
            if (cnt == null || cnt == 0) {
                jdbcTemplate.update(
                        "INSERT INTO core_modules (module_key, module_name, module_title, module_description, module_type, is_system, path, sort_order, status) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1)",
                        key, key, key, "", key.equals("cases") ? 2 : 1, "/" + key, 99);
            } else {
                jdbcTemplate.update("UPDATE core_modules SET is_system = 1 WHERE module_key = ? AND deleted = 0", key);
            }
        }
    }

    private Map<Long, Long> migrateCategories(String table, String moduleKey, String label) {
        Map<Long, Long> map = new LinkedHashMap<>();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT * FROM " + table);
        int sort = 0;
        for (Map<String, Object> row : rows) {
            long oldId = ((Number) row.get("id")).longValue();
            String name = (String) row.get("name");
            if (name == null || name.trim().isEmpty()) continue;
            Long existing = findCategoryId(moduleKey, name);
            if (existing != null) {
                map.put(oldId, existing);
                continue;
            }
            String slug = (String) row.get("slug");
            if (slug == null || slug.trim().isEmpty()) {
                slug = uniqueCategorySlug(moduleKey, name);
            }
            jdbcTemplate.update(
                    "INSERT INTO content_categories (module_key, name, slug, description, cover_image, sort_order, status, created_at, updated_at) " +
                            "VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                    moduleKey, name, slug, row.get("description"), row.get("cover_image"), sort++);
            Long newId = findCategoryId(moduleKey, name);
            if (newId != null) {
                map.put(oldId, newId);
                log.info("[ContentUnification] category {}/{} -> #{}", moduleKey, name, newId);
            }
        }
        log.info("[ContentUnification] migrated {} categories from {}", map.size(), table);
        return map;
    }

    private Long findCategoryId(String moduleKey, String name) {
        List<Map<String, Object>> list = jdbcTemplate.queryForList(
                "SELECT id FROM content_categories WHERE module_key = ? AND name = ? AND deleted = 0 LIMIT 1",
                moduleKey, name);
        return list.isEmpty() ? null : ((Number) list.get(0).get("id")).longValue();
    }

    private String uniqueCategorySlug(String moduleKey, String name) {
        return slugService.uniqueSlug(name, candidate -> {
            Integer c = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM content_categories WHERE module_key = ? AND slug = ? AND deleted = 0",
                    Integer.class, moduleKey, candidate);
            return c != null && c > 0;
        });
    }

    private Long ensureCategoryByOldId(Map<Long, Long> catMap, Long oldId, String moduleKey, String fallbackName) {
        if (oldId != null && catMap.containsKey(oldId)) return catMap.get(oldId);
        if (hasText(fallbackName)) {
            Long existing = findCategoryId(moduleKey, fallbackName);
            if (existing != null) return existing;
            String slug = uniqueCategorySlug(moduleKey, fallbackName);
            jdbcTemplate.update(
                    "INSERT INTO content_categories (module_key, name, slug, status) VALUES (?, ?, ?, 1)",
                    moduleKey, fallbackName, slug);
            return findCategoryId(moduleKey, fallbackName);
        }
        return null;
    }

    private Map<Long, Long> migrateProducts(Map<Long, Long> productLineMap) {
        Map<Long, Long> map = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList("SELECT * FROM products")) {
            long oldId = ((Number) row.get("id")).longValue();
            String title = (String) row.get("name");
            String slug = (String) row.get("slug");
            if (title == null || title.trim().isEmpty()) continue;
            if (!hasText(slug)) slug = uniqueItemSlug("products", title);

            Long catOldId = firstLong(row.get("category_id"));
            if (catOldId == null) catOldId = firstLong(row.get("product_line_id"));
            Long catId = ensureCategoryByOldId(productLineMap, catOldId, "products", str(row.get("product_line")));

            String extraData = buildExtraData(row, "products",
                    new String[]{"features", "scenarios", "target_audience", "pain_points", "core_features", "tech_architecture", "deployment"},
                    new String[]{"产品能力", "应用场景", "目标受众", "客户痛点", "核心功能", "技术架构", "部署方式"});

            Long newId = insertContentItem("products", title, slug, catId, str(row.get("product_line")),
                    str(row.get("summary")), null, str(row.get("cover_image")), str(row.get("file_path")),
                    str(row.get("file_name")), firstLong(row.get("file_size")), intVal(row.get("sort_order"), 0),
                    intVal(row.get("status"), 1), 0, row.get("scheduled_at"), null, str(row.get("seo_title")),
                    str(row.get("seo_description")), intVal(row.get("view_count"), 0), extraData, row.get("created_at"),
                    row.get("updated_at"), intVal(row.get("deleted"), 0));
            if (newId != null) map.put(oldId, newId);
        }
        log.info("[ContentUnification] migrated {} products", map.size());
        return map;
    }

    private Map<Long, Long> migrateSolutions(Map<Long, Long> industryMap) {
        Map<Long, Long> map = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList("SELECT * FROM solutions")) {
            long oldId = ((Number) row.get("id")).longValue();
            String title = (String) row.get("title");
            String slug = (String) row.get("slug");
            if (title == null || title.trim().isEmpty()) continue;
            if (!hasText(slug)) slug = uniqueItemSlug("solutions", title);

            Long industryId = firstLong(row.get("industry_id"));
            String industryName = str(row.get("industry"));
            Long catId = ensureCategoryByOldId(industryMap, industryId, "solutions", industryName);

            String extraData = buildExtraData(row, "solutions",
                    new String[]{"architecture", "target_audience", "industry_background", "pain_points", "objectives", "core_content", "product_portfolio", "implementation_path", "expected_results"},
                    new String[]{"方案架构", "目标受众", "行业背景", "客户痛点", "建设目标", "核心建设内容", "产品组合", "实施路径", "预期成效"});

            Long newId = insertContentItem("solutions", title, slug, catId, industryName,
                    str(row.get("summary")), null, str(row.get("cover_image")), str(row.get("file_path")),
                    str(row.get("file_name")), firstLong(row.get("file_size")), intVal(row.get("sort_order"), 0),
                    intVal(row.get("status"), 1), 0, row.get("scheduled_at"), null, str(row.get("seo_title")),
                    str(row.get("seo_description")), intVal(row.get("view_count"), 0), extraData, row.get("created_at"),
                    row.get("updated_at"), intVal(row.get("deleted"), 0));
            if (newId != null) map.put(oldId, newId);
        }
        log.info("[ContentUnification] migrated {} solutions", map.size());
        return map;
    }

    private Map<Long, Long> migrateCases() {
        Map<Long, Long> map = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList("SELECT * FROM cases")) {
            long oldId = ((Number) row.get("id")).longValue();
            String title = (String) row.get("title");
            String slug = (String) row.get("slug");
            if (title == null || title.trim().isEmpty()) continue;
            if (!hasText(slug)) slug = uniqueItemSlug("cases", title);

            String extraData = buildExtraData(row, "cases",
                    new String[]{"client_name", "client_type", "project_background", "challenges", "solution_approach", "core_features", "results", "replicable_value"},
                    new String[]{"客户名称", "客户类型", "项目背景", "建设挑战", "解决方案", "核心功能", "项目成果", "可复制价值"});

            Long newId = insertContentItem("cases", title, slug, null, str(row.get("industry")),
                    str(row.get("summary")), null, str(row.get("cover_image")), str(row.get("file_path")),
                    str(row.get("file_name")), firstLong(row.get("file_size")), intVal(row.get("sort_order"), 0),
                    intVal(row.get("status"), 1), 0, row.get("scheduled_at"), null, str(row.get("seo_title")),
                    str(row.get("seo_description")), intVal(row.get("view_count"), 0), extraData, row.get("created_at"),
                    row.get("updated_at"), intVal(row.get("deleted"), 0));
            if (newId != null) map.put(oldId, newId);
        }
        log.info("[ContentUnification] migrated {} cases", map.size());
        return map;
    }

    private Map<Long, Long> migrateResources(Map<Long, Long> resourceCatMap) {
        Map<Long, Long> map = new LinkedHashMap<>();
        for (Map<String, Object> row : jdbcTemplate.queryForList("SELECT * FROM resources")) {
            long oldId = ((Number) row.get("id")).longValue();
            String title = (String) row.get("title");
            String slug = (String) row.get("slug");
            if (title == null || title.trim().isEmpty()) continue;
            if (!hasText(slug)) slug = uniqueItemSlug("resources", title);

            Long catId = null;
            Long catOldId = firstLong(row.get("resource_category_id"));
            if (catOldId != null) catId = resourceCatMap.get(catOldId);
            String catName = null;
            if (catId != null) {
                List<Map<String, Object>> cats = jdbcTemplate.queryForList(
                        "SELECT name FROM content_categories WHERE id = ? AND deleted = 0", catId);
                if (!cats.isEmpty()) catName = (String) cats.get(0).get("name");
            }

            String body = str(row.get("content"));
            if (!hasText(body)) body = str(row.get("description"));
            String extraData = buildExtraData(row, "resources", new String[]{}, new String[]{}, body);

            Long newId = insertContentItem("resources", title, slug, catId, catName,
                    str(row.get("summary")), null, str(row.get("cover_image")), str(row.get("file_path")),
                    str(row.get("file_name")), firstLong(row.get("file_size")), intVal(row.get("sort_order"), 0),
                    intVal(row.get("status"), 1), intVal(row.get("is_top"), 0), row.get("scheduled_at"),
                    row.get("published_at"), str(row.get("seo_title")), str(row.get("seo_description")),
                    intVal(row.get("view_count"), 0), extraData, row.get("created_at"), row.get("updated_at"),
                    intVal(row.get("deleted"), 0));
            if (newId != null) {
                map.put(oldId, newId);
                if (row.get("download_count") != null || row.get("require_form") != null || hasText(str(row.get("author"))) || hasText(str(row.get("source")))) {
                    Map<String, Object> meta = new LinkedHashMap<>();
                    meta.put("downloadCount", firstInt(row.get("download_count")));
                    meta.put("requireForm", firstInt(row.get("require_form")));
                    meta.put("author", str(row.get("author")));
                    meta.put("source", str(row.get("source")));
                    try {
                        jdbcTemplate.update("UPDATE content_items SET download_count = ?, require_form = ? WHERE id = ?",
                                firstInt(row.get("download_count")), firstInt(row.get("require_form")), newId);
                    } catch (Exception e) {
                        log.warn("[ContentUnification] update resource meta failed: {}", e.getMessage());
                    }
                }
            }
        }
        log.info("[ContentUnification] migrated {} resources", map.size());
        return map;
    }

    private Long insertContentItem(String moduleKey, String title, String slug, Long catId, String groupName,
                                   String summary, String content, String coverImage, String filePath, String fileName,
                                   Long fileSize, int sortOrder, int status, int isTop, Object scheduledAt,
                                   Object publishedAt, String seoTitle, String seoDescription, int viewCount,
                                   String extraData, Object createdAt, Object updatedAt, int deleted) {
        jdbcTemplate.update(
                "INSERT INTO content_items (module_key, title, slug, category_id, group_name, summary, content, cover_image, " +
                        "file_path, file_name, file_size, sort_order, status, is_top, scheduled_at, published_at, " +
                        "seo_title, seo_description, view_count, extra_data, created_at, updated_at, deleted) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                moduleKey, title, slug, catId, groupName, summary, content, coverImage, filePath, fileName, fileSize,
                sortOrder, status, isTop, toTimestamp(scheduledAt), toTimestamp(publishedAt), seoTitle, seoDescription,
                viewCount, extraData, toTimestamp(createdAt), toTimestamp(updatedAt), deleted);
        List<Map<String, Object>> list = jdbcTemplate.queryForList(
                "SELECT id FROM content_items WHERE module_key = ? AND slug = ? AND deleted = 0 LIMIT 1",
                moduleKey, slug);
        return list.isEmpty() ? null : ((Number) list.get(0).get("id")).longValue();
    }

    private void attachRelations(String table, String moduleKey, Map<Long, Long> idMap, List<Object[]> relDefs) {
        for (Map<String, Object> row : jdbcTemplate.queryForList("SELECT * FROM " + table)) {
            long oldId = ((Number) row.get("id")).longValue();
            Long newId = idMap.get(oldId);
            if (newId == null) continue;
            Map<String, List<Long>> relations = new LinkedHashMap<>();
            for (Object[] def : relDefs) {
                String column = (String) def[0];
                String targetModule = (String) def[1];
                @SuppressWarnings("unchecked")
                Map<Long, Long> targetMap = (Map<Long, Long>) def[2];
                List<Long> ids = remapIds(str(row.get(column)), targetMap);
                if (!ids.isEmpty()) relations.put(targetModule, ids);
            }
            if (relations.isEmpty()) continue;
            Map<String, Object> item = jdbcTemplate.queryForMap(
                    "SELECT id, extra_data FROM content_items WHERE id = ?", newId);
            String extraData = mergeRelations(str(item.get("extra_data")), relations);
            jdbcTemplate.update("UPDATE content_items SET extra_data = ? WHERE id = ?", extraData, newId);
        }
    }

    private void migrateSolutionProducts(Map<Long, Long> solutionMap, Map<Long, Long> productMap) {
        for (Map<String, Object> row : jdbcTemplate.queryForList("SELECT * FROM solution_products")) {
            Long solOld = firstLong(row.get("solution_id"));
            Long prodOld = firstLong(row.get("product_id"));
            Long solNew = solOld == null ? null : solutionMap.get(solOld);
            Long prodNew = prodOld == null ? null : productMap.get(prodOld);
            if (solNew == null || prodNew == null) continue;
            Map<String, Object> item = jdbcTemplate.queryForMap(
                    "SELECT id, extra_data FROM content_items WHERE id = ?", solNew);
            List<Long> products = new ArrayList<>(Arrays.asList(prodNew));
            Map<String, List<Long>> relations = new LinkedHashMap<>();
            relations.put("products", products);
            String extraData = mergeRelations(str(item.get("extra_data")), relations);
            jdbcTemplate.update("UPDATE content_items SET extra_data = ? WHERE id = ?", extraData, solNew);
        }
    }

    private void migrateFaqProducts(Map<Long, Long> productMap) {
        for (Map<String, Object> row : jdbcTemplate.queryForList("SELECT id, product_id FROM faqs WHERE product_id IS NOT NULL")) {
            long faqId = ((Number) row.get("id")).longValue();
            Long oldId = firstLong(row.get("product_id"));
            Long newId = oldId == null ? null : productMap.get(oldId);
            jdbcTemplate.update("UPDATE faqs SET product_id = ? WHERE id = ?", newId, faqId);
        }
    }

    private String mergeRelations(String extraData, Map<String, List<Long>> newRelations) {
        Map<String, Object> root = new LinkedHashMap<>();
        if (hasText(extraData)) {
            try {
                Object parsed = objectMapper.readValue(extraData, Object.class);
                if (parsed instanceof Map) {
                    root.putAll((Map<String, Object>) parsed);
                }
            } catch (Exception ignored) {
            }
        }
        Object existing = root.get("relations");
        Map<String, List<Long>> relations = new LinkedHashMap<>();
        if (existing instanceof Map) {
            ((Map<?, ?>) existing).forEach((k, v) -> {
                List<Long> ids = new ArrayList<>();
                if (v instanceof List) {
                    for (Object o : (List<?>) v) {
                        if (o instanceof Number) ids.add(((Number) o).longValue());
                    }
                }
                if (!ids.isEmpty()) relations.put(String.valueOf(k), ids);
            });
        }
        newRelations.forEach((k, v) -> relations.merge(k, v, (a, b) -> {
            List<Long> merged = new ArrayList<>(a);
            for (Long x : b) if (!merged.contains(x)) merged.add(x);
            return merged;
        }));
        root.put("relations", relations);
        try {
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            return extraData;
        }
    }

    private List<Long> remapIds(String csv, Map<Long, Long> idMap) {
        List<Long> result = new ArrayList<>();
        if (!hasText(csv)) return result;
        for (String part : csv.split(",")) {
            String t = part.trim();
            if (t.isEmpty()) continue;
            try {
                Long oldId = Long.valueOf(t);
                Long newId = idMap.get(oldId);
                if (newId != null && !result.contains(newId)) result.add(newId);
            } catch (NumberFormatException ignored) {
            }
        }
        return result;
    }

    /**
     * 将旧版区块 extraData 与历史字段转成 sections 结构。
     * oldBlock=true 时：若旧区块为富文本则视为正文，不再追加 description/历史字段。
     */
    private String buildExtraData(Map<String, Object> row, String moduleKey, String[] legacyFields, String[] legacyLabels) {
        return buildExtraData(row, moduleKey, legacyFields, legacyLabels, str(row.get("description")));
    }

    private String buildExtraData(Map<String, Object> row, String moduleKey, String[] legacyFields, String[] legacyLabels, String body) {
        List<Map<String, Object>> sections = new ArrayList<>();
        String oldExtra = str(row.get("extra_data"));
        boolean oldBlockIsRichText = false;
        if (hasText(oldExtra)) {
            try {
                Object parsed = objectMapper.readValue(oldExtra, Object.class);
                if (parsed instanceof Map) {
                    Map<String, Object> m = (Map<String, Object>) parsed;
                    Object data = m.containsKey("data") ? m.get("data") : m;
                    String st = m.containsKey("sectionType") && m.get("sectionType") != null ? String.valueOf(m.get("sectionType")) : "rich_text";
                    if (data instanceof Map && !((Map<?, ?>) data).isEmpty()) {
                        Map<String, Object> sec = new LinkedHashMap<>();
                        sec.put("sectionType", st);
                        sec.put("data", data);
                        sections.add(sec);
                        oldBlockIsRichText = "rich_text".equals(st);
                    }
                }
            } catch (Exception e) {
                log.debug("[ContentUnification] old extra_data parse failed: {}", e.getMessage());
            }
        }

        if (!oldBlockIsRichText) {
            if (hasText(body)) {
                sections.add(richSection(moduleTitle(moduleKey), body));
            }
            for (int i = 0; i < legacyFields.length; i++) {
                String v = str(row.get(legacyFields[i]));
                if (hasText(v)) {
                    sections.add(richSection(legacyLabels[i], v));
                }
            }
        }

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("sections", sections);
        try {
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            return "{\"sections\":[]}";
        }
    }

    private static Map<String, Object> richSection(String title, String content) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("content", content);
        if (hasText(title)) data.put("title", title);
        Map<String, Object> sec = new LinkedHashMap<>();
        sec.put("sectionType", "rich_text");
        sec.put("data", data);
        return sec;
    }

    private static String moduleTitle(String moduleKey) {
        switch (moduleKey) {
            case "products": return "产品简介";
            case "solutions": return "方案简介";
            case "cases": return "案例简介";
            default: return "正文";
        }
    }

    private String uniqueItemSlug(String moduleKey, String title) {
        return slugService.uniqueSlug(title, candidate -> {
            Integer c = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM content_items WHERE module_key = ? AND slug = ? AND deleted = 0",
                    Integer.class, moduleKey, candidate);
            return c != null && c > 0;
        });
    }

    private void dropOldTables() {
        String[] tables = {"solution_products", "resources", "cases", "solutions", "industries", "products", "product_lines", "resource_categories"};
        for (String t : tables) {
            try {
                jdbcTemplate.execute("DROP TABLE IF EXISTS " + t);
                log.info("[ContentUnification] dropped table {}", t);
            } catch (Exception e) {
                log.warn("[ContentUnification] drop {} failed: {}", t, e.getMessage());
            }
        }
    }

    private boolean tableExists(String tableName) {
        try {
            Integer c = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
                    Integer.class, tableName.toLowerCase());
            return c != null && c > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Long firstLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).longValue();
        try {
            return Long.valueOf(String.valueOf(o));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer firstInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try {
            return Integer.valueOf(String.valueOf(o));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static int intVal(Object o, int def) {
        Integer i = firstInt(o);
        return i == null ? def : i;
    }

    private static Timestamp toTimestamp(Object o) {
        if (o == null) return null;
        if (o instanceof Timestamp) return (Timestamp) o;
        if (o instanceof java.util.Date) return new Timestamp(((java.util.Date) o).getTime());
        return null;
    }
}
