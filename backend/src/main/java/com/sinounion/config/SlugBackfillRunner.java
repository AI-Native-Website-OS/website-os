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
 * 幂等的 slug 回填：
 * 为 content_items / content_categories 中 slug 为空或旧版遗留格式（含中文 / 13 位时间戳后缀）的行按名称重新生成。
 */
@Slf4j
@Component
@org.springframework.context.annotation.Profile("!test")
@RequiredArgsConstructor
public class SlugBackfillRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;
    private final SlugService slugService;

    @Override
    public void run(ApplicationArguments args) {
        backfillContentCategories();
        backfillContentItems();
    }

    private void backfillContentCategories() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, module_key AS module_key, name FROM content_categories WHERE slug IS NULL OR slug = ''");
        for (Map<String, Object> row : rows) {
            long id = ((Number) row.get("id")).longValue();
            String moduleKey = (String) row.get("module_key");
            String name = (String) row.get("name");
            if (name == null || name.trim().isEmpty()) continue;
            final long fid = id;
            String slug = slugService.uniqueSlug(name, candidate -> {
                Integer c = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM content_categories WHERE module_key = ? AND slug = ? AND id <> ?",
                        Integer.class, moduleKey, candidate, fid);
                return c != null && c > 0;
            });
            jdbcTemplate.update("UPDATE content_categories SET slug = ? WHERE id = ?", slug, id);
            log.info("[SlugBackfill] content_categories #{} -> {}", id, slug);
        }
    }

    private void backfillContentItems() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, module_key AS module_key, title, slug FROM content_items WHERE deleted = 0");
        for (Map<String, Object> row : rows) {
            long id = ((Number) row.get("id")).longValue();
            String moduleKey = (String) row.get("module_key");
            String title = (String) row.get("title");
            String slug = (String) row.get("slug");
            if (moduleKey == null || title == null || title.trim().isEmpty()) continue;
            if (!slugService.isLegacy(slug)) continue;
            final long fid = id;
            String candidate = slugService.uniqueSlug(title, c -> {
                Integer cnt = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM content_items WHERE module_key = ? AND slug = ? AND id <> ? AND deleted = 0",
                        Integer.class, moduleKey, c, fid);
                return cnt != null && cnt > 0;
            });
            jdbcTemplate.update("UPDATE content_items SET slug = ? WHERE id = ?", candidate, id);
            log.info("[SlugBackfill] content_items #{} {} -> {}", id, slug, candidate);
        }
    }
}
