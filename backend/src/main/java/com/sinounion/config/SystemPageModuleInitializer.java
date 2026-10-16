package com.sinounion.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 确保「首页 / 关于」这类系统页面作为不可删除的系统模块存在于 core_modules，
 * 使其名称可在「核心模块管理」中维护（例如前台导航"关于我们"的名称）。
 * 幂等：仅缺失时插入，并始终保证 is_system = 1。
 */
@Slf4j
@Component
@org.springframework.context.annotation.Profile("!test")
public class SystemPageModuleInitializer implements ApplicationRunner {

    private static final Object[][] SYSTEM_PAGES = {
            {"home", "首页", "/", 2, 98},
            {"about", "关于我们", "/about", 2, 99},
    };

    private final JdbcTemplate jdbcTemplate;

    public SystemPageModuleInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (!tableExists("core_modules")) {
                return;
            }
            for (Object[] page : SYSTEM_PAGES) {
                String key = (String) page[0];
                String name = (String) page[1];
                String path = (String) page[2];
                int type = (int) page[3];
                int sort = (int) page[4];
                Integer count = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM core_modules WHERE module_key = ? AND deleted = 0",
                        Integer.class, key);
                if (count == null || count == 0) {
                    jdbcTemplate.update(
                            "INSERT INTO core_modules (module_key, module_name, module_title, module_description, module_type, is_system, path, sort_order, status) " +
                                    "VALUES (?, ?, '', '', ?, 1, ?, ?, 1)",
                            key, name, type, path, sort);
                    log.info("[SystemPageModule] inserted system page module {}", key);
                } else {
                    jdbcTemplate.update(
                            "UPDATE core_modules SET is_system = 1 WHERE module_key = ? AND deleted = 0", key);
                }
            }
        } catch (Exception e) {
            log.warn("[SystemPageModule] init failed: {}", e.getMessage());
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
}
