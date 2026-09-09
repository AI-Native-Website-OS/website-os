package com.sinounion.config;

import com.sinounion.util.SlugService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 幂等的内容分类回填：
 * 将 content_items 中已有 group_name 的存量数据按 (module_key, group_name) 生成
 * content_categories 分类，并回填 content_items.category_id。
 * 已存在同名分类或已有 category_id 的项跳过。
 */
@Slf4j
@Component
@org.springframework.context.annotation.Profile("!test")
@RequiredArgsConstructor
public class ContentCategoryBackfillRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final SlugService slugService;

    @Override
    public void run(ApplicationArguments args) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, module_key AS module_key, group_name AS group_name " +
                "FROM content_items WHERE deleted = 0 AND group_name IS NOT NULL AND group_name <> ''");
        for (Map<String, Object> row : rows) {
            long id = ((Number) row.get("id")).longValue();
            String moduleKey = (String) row.get("module_key");
            String groupName = (String) row.get("group_name");
            if (moduleKey == null || groupName == null || groupName.trim().isEmpty()) continue;
            // 内置模块分类由统一迁移器处理，避免覆盖已迁移的分类归属
            if (isBuiltinModule(moduleKey)) continue;

            Long categoryId = ensureCategory(moduleKey, groupName.trim());
            if (categoryId == null) continue;
            jdbcTemplate.update("UPDATE content_items SET category_id = ? WHERE id = ?", categoryId, id);
            log.info("[ContentCategoryBackfill] content_items #{} -> category #{} ({}/{})", id, categoryId, moduleKey, groupName);
        }
    }

    private static boolean isBuiltinModule(String moduleKey) {
        return "products".equals(moduleKey) || "solutions".equals(moduleKey)
                || "cases".equals(moduleKey) || "resources".equals(moduleKey);
    }

    private Long ensureCategory(String moduleKey, String name) {
        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
                "SELECT id FROM content_categories WHERE module_key = ? AND name = ? AND deleted = 0", moduleKey, name);
        if (!existing.isEmpty()) {
            return ((Number) existing.get(0).get("id")).longValue();
        }
        String slug = slugService.uniqueSlug(name, candidate -> {
            Integer c = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM content_categories WHERE module_key = ? AND slug = ? AND deleted = 0",
                    Integer.class, moduleKey, candidate);
            return c != null && c > 0;
        });
        jdbcTemplate.update("INSERT INTO content_categories (module_key, name, slug, status) VALUES (?, ?, ?, 1)",
                moduleKey, name, slug);
        List<Map<String, Object>> inserted = jdbcTemplate.queryForList(
                "SELECT id FROM content_categories WHERE module_key = ? AND slug = ? AND deleted = 0", moduleKey, slug);
        if (inserted.isEmpty()) return null;
        log.info("[ContentCategoryBackfill] created category {} ({}/{})", slug, moduleKey, name);
        return ((Number) inserted.get(0).get("id")).longValue();
    }
}
