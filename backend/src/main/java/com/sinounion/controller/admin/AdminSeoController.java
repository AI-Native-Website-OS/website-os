package com.sinounion.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.common.BusinessException;
import com.sinounion.common.Result;
import com.sinounion.dto.SeoDetailDTO;
import com.sinounion.entity.ContentItem;
import com.sinounion.entity.CoreModule;
import com.sinounion.entity.SeoConfig;
import com.sinounion.entity.SeoFaq;
import com.sinounion.entity.SeoKeyword;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.ContentItemMapper;
import com.sinounion.mapper.CoreModuleMapper;
import com.sinounion.mapper.SeoConfigMapper;
import com.sinounion.mapper.SeoFaqMapper;
import com.sinounion.mapper.SeoKeywordMapper;
import com.sinounion.mapper.SystemConfigMapper;
import com.sinounion.model.SyncProgress;
import com.sinounion.service.GeoSyncService;
import com.sinounion.service.SeoGenerateService;
import com.sinounion.service.SeoSyncService;
import com.sinounion.service.SyncProgressTracker;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Slf4j
@Tag(name = "管理后台-SEO管理", description = "SEO配置接口")
@RestController
@RequestMapping("/admin/seo")
@RequiredArgsConstructor
public class AdminSeoController {

    private final SeoConfigMapper seoConfigMapper;
    private final SeoKeywordMapper seoKeywordMapper;
    private final SeoFaqMapper seoFaqMapper;
    private final ContentItemMapper contentItemMapper;
    private final CoreModuleMapper coreModuleMapper;
    private final SeoSyncService seoSyncService;
    private final GeoSyncService geoSyncService;
    private final SeoGenerateService seoGenerateService;
    private final SyncProgressTracker progressTracker;
    private final SystemConfigMapper systemConfigMapper;

    private final ExecutorService syncExecutor = Executors.newSingleThreadExecutor();

    @Operation(summary = "获取SEO配置列表")
    @GetMapping
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<List<SeoConfig>> getSeoConfigs() {
        List<SeoConfig> list = seoConfigMapper.selectList(new LambdaQueryWrapper<SeoConfig>()
                .orderByAsc(SeoConfig::getId));
        return Result.success(list);
    }

    @Operation(summary = "获取可选页面列表（静态页/模块列表页/内容详情页）")
    @GetMapping("/pages")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<List<Map<String, Object>>> getPageOptions(@RequestParam(required = false) String origin) {
        String normalized = SeoSyncService.normalizeBase(origin);
        String base = normalized != null ? normalized : seoSyncService.currentBaseUrl();
        List<Map<String, Object>> options = new ArrayList<>();

        List<Map<String, String>> staticPages = new ArrayList<>();
        staticPages.add(mapOf("label", "首页", "path", "/", "title", "企业数字基础设施服务商"));
        staticPages.add(mapOf("label", "关于我们", "path", "/about", "title", "关于我们"));
        staticPages.add(mapOf("label", "FAQ", "path", "/faqs", "title", "常见问题 - FAQ"));
        for (Map<String, String> sp : staticPages) {
            Map<String, Object> o = new LinkedHashMap<>();
            o.put("type", "static");
            o.put("label", sp.get("label"));
            o.put("pageId", null);
            o.put("title", sp.get("title"));
            o.put("url", base + sp.get("path"));
            options.add(o);
        }

        List<CoreModule> modules = coreModuleMapper.selectList(new LambdaQueryWrapper<CoreModule>()
                .eq(CoreModule::getStatus, 1)
                .orderByAsc(CoreModule::getSortOrder));
        for (CoreModule m : modules) {
            Map<String, Object> o = new LinkedHashMap<>();
            o.put("type", "module");
            o.put("label", (m.getModuleTitle() != null ? m.getModuleTitle() : m.getModuleName()) + "（列表页）");
            o.put("pageId", null);
            o.put("title", m.getModuleTitle() != null ? m.getModuleTitle() : m.getModuleName());
            o.put("url", base + "/list/category?moduleKey=" + m.getModuleKey());
            options.add(o);
        }

        List<ContentItem> items = contentItemMapper.selectList(new LambdaQueryWrapper<ContentItem>()
                .eq(ContentItem::getStatus, 1)
                .orderByAsc(ContentItem::getModuleKey));
        for (ContentItem item : items) {
            Map<String, Object> o = new LinkedHashMap<>();
            o.put("type", "content");
            o.put("label", item.getTitle() + "（" + item.getModuleKey() + "）");
            o.put("pageId", item.getId());
            o.put("title", item.getTitle());
            o.put("url", base + "/list/detail?moduleKey=" + item.getModuleKey() + "&slug=" + item.getSlug());
            options.add(o);
        }

        return Result.success(options);
    }

    private Map<String, String> mapOf(String k1, String v1, String k2, String v2, String k3, String v3) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put(k1, v1);
        m.put(k2, v2);
        m.put(k3, v3);
        return m;
    }

    @Operation(summary = "一键同步全部（提取系统所有页面，缺失创建、URL/pageId 修正，异步返回taskId；origin为当前前端访问基址）")
    @PostMapping("/sync")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<Map<String, Object>> syncAll(@RequestBody(required = false) Map<String, Object> body) {
        if (body != null && body.get("origin") != null) {
            seoSyncService.saveBaseUrl(String.valueOf(body.get("origin")));
        }
        SyncProgress sp = progressTracker.create("seo_geo_sync");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId", sp.getTaskId());
        result.put("status", "started");

        syncExecutor.submit(() -> {
            try {
                seoGenerateService.syncSeoAndGeo(sp);
            } catch (Exception e) {
                sp.error(e.getMessage());
                log.error("SEO/GEO sync failed: {}", e.getMessage());
            }
        });

        return Result.success(result);
    }

    @Operation(summary = "查询SEO/GEO同步进度")
    @GetMapping("/sync-progress/{taskId}")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<SyncProgress> getSyncProgress(@PathVariable String taskId) {
        SyncProgress sp = progressTracker.get(taskId);
        if (sp == null) {
            return Result.error("任务不存在或已过期");
        }
        return Result.success(sp);
    }

    @Operation(summary = "获取SEO配置详情")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<SeoConfig> getSeoConfig(@PathVariable Long id) {
        return Result.success(seoConfigMapper.selectById(id));
    }

    @Operation(summary = "获取SEO配置完整详情（含关键词与FAQ）")
    @GetMapping("/{id}/detail")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<SeoDetailDTO> getSeoDetail(@PathVariable Long id) {
        SeoConfig config = seoConfigMapper.selectById(id);
        if (config == null) {
            return Result.success(null);
        }
        SeoDetailDTO dto = new SeoDetailDTO();
        dto.setId(config.getId());
        dto.setPageType(config.getPageType());
        dto.setPageId(config.getPageId());
        dto.setTitle(config.getTitle());
        dto.setDescription(config.getDescription());
        dto.setKeywords(config.getKeywords());
        dto.setCanonicalUrl(config.getCanonicalUrl());
        dto.setOgTitle(config.getOgTitle());
        dto.setOgDescription(config.getOgDescription());
        dto.setOgImage(config.getOgImage());
        dto.setRobots(config.getRobots());
        dto.setOgType(config.getOgType());
        dto.setGeoSummary(config.getGeoSummary());
        dto.setEnabled(config.getEnabled());
        dto.setGeoOptional(config.getGeoOptional());

        List<SeoKeyword> keywords = seoKeywordMapper.selectList(new LambdaQueryWrapper<SeoKeyword>()
                .eq(SeoKeyword::getPageType, config.getPageType())
                .eq(SeoKeyword::getPageId, config.getPageId())
                .orderByAsc(SeoKeyword::getSortOrder));
        dto.setKeywordsList(keywords.stream().map(k -> {
            SeoDetailDTO.SeoKeywordItem item = new SeoDetailDTO.SeoKeywordItem();
            item.setId(k.getId());
            item.setKeyword(k.getKeyword());
            item.setCategory(k.getCategory());
            item.setIntentNote(k.getIntentNote());
            item.setSortOrder(k.getSortOrder());
            return item;
        }).collect(Collectors.toList()));

        List<SeoFaq> faqs = seoFaqMapper.selectList(new LambdaQueryWrapper<SeoFaq>()
                .eq(SeoFaq::getPageType, config.getPageType())
                .eq(SeoFaq::getPageId, config.getPageId())
                .orderByAsc(SeoFaq::getSortOrder));
        dto.setFaqs(faqs.stream().map(f -> {
            SeoDetailDTO.SeoFaqItem item = new SeoDetailDTO.SeoFaqItem();
            item.setId(f.getId());
            item.setQuestion(f.getQuestion());
            item.setAnswer(f.getAnswer());
            item.setSortOrder(f.getSortOrder());
            return item;
        }).collect(Collectors.toList()));

        return Result.success(dto);
    }

    @Operation(summary = "创建SEO配置")
    @PostMapping
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<SeoConfig> create(@RequestBody SeoConfig seoConfig) {
        validate(seoConfig);
        if (seoConfig.getRobots() == null || seoConfig.getRobots().trim().isEmpty()) {
            seoConfig.setRobots("index,follow");
        }
        seoConfig.setId(null);
        seoConfigMapper.insert(seoConfig);
        seoSyncService.syncContentFromSeo(seoConfig);
        geoSyncService.refreshFilesQuietly();
        seoGenerateService.notifyAiCatalogReload();
        return Result.success(seoConfig);
    }

    @Operation(summary = "更新SEO配置")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<SeoConfig> update(@PathVariable Long id, @RequestBody SeoConfig seoConfig) {
        validate(seoConfig);
        if (seoConfig.getRobots() != null && seoConfig.getRobots().trim().isEmpty()) {
            seoConfig.setRobots("index,follow");
        }
        seoConfig.setId(id);
        seoConfigMapper.updateById(seoConfig);
        seoSyncService.syncContentFromSeo(seoConfig);
        geoSyncService.refreshFilesQuietly();
        seoGenerateService.notifyAiCatalogReload();
        return Result.success(seoConfig);
    }

    @Operation(summary = "更新GEO信息（AI摘要/启用状态/关键词词库/FAQ）")
    @PutMapping("/{id}/geo")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<SeoDetailDTO> updateGeo(@PathVariable Long id, @RequestBody SeoDetailDTO dto) {
        SeoConfig config = seoConfigMapper.selectById(id);
        if (config == null) {
            throw new BusinessException(400, "SEO配置不存在");
        }

        if (dto.getGeoSummary() != null) config.setGeoSummary(dto.getGeoSummary());
        if (dto.getEnabled() != null) config.setEnabled(dto.getEnabled());
        if (dto.getGeoOptional() != null) config.setGeoOptional(dto.getGeoOptional());
        if (dto.getOgTitle() != null) config.setOgTitle(dto.getOgTitle());
        if (dto.getOgDescription() != null) config.setOgDescription(dto.getOgDescription());
        if (dto.getOgImage() != null) config.setOgImage(dto.getOgImage());
        if (dto.getOgType() != null) config.setOgType(dto.getOgType());
        if (dto.getRobots() != null) config.setRobots(dto.getRobots());
        seoConfigMapper.updateById(config);

        // 整块替换关键词词库（仅当提供了 keywordsList 时才覆盖）
        if (dto.getKeywordsList() != null) {
            seoKeywordMapper.delete(new LambdaQueryWrapper<SeoKeyword>()
                    .eq(SeoKeyword::getPageType, config.getPageType())
                    .eq(SeoKeyword::getPageId, config.getPageId()));
            int sort = 0;
            for (SeoDetailDTO.SeoKeywordItem item : dto.getKeywordsList()) {
                if (item.getKeyword() == null || item.getKeyword().trim().isEmpty()) continue;
                SeoKeyword kw = new SeoKeyword();
                kw.setPageType(config.getPageType());
                kw.setPageId(config.getPageId());
                kw.setKeyword(item.getKeyword().trim());
                kw.setCategory(item.getCategory());
                kw.setIntentNote(item.getIntentNote());
                kw.setSortOrder(item.getSortOrder() != null ? item.getSortOrder() : sort);
                seoKeywordMapper.insert(kw);
                sort++;
            }
        }

        // 整块替换 FAQ（仅当提供了 faqs 时才覆盖，null 表示不修改）
        if (dto.getFaqs() != null) {
            seoFaqMapper.delete(new LambdaQueryWrapper<SeoFaq>()
                    .eq(SeoFaq::getPageType, config.getPageType())
                    .eq(SeoFaq::getPageId, config.getPageId()));
            int sort = 0;
            for (SeoDetailDTO.SeoFaqItem item : dto.getFaqs()) {
                if (item.getQuestion() == null || item.getQuestion().trim().isEmpty()) continue;
                SeoFaq faq = new SeoFaq();
                faq.setPageType(config.getPageType());
                faq.setPageId(config.getPageId());
                faq.setQuestion(item.getQuestion().trim());
                faq.setAnswer(item.getAnswer());
                faq.setSortOrder(item.getSortOrder() != null ? item.getSortOrder() : sort);
                seoFaqMapper.insert(faq);
                sort++;
            }
        }

        geoSyncService.refreshFilesQuietly();
        seoGenerateService.notifyAiCatalogReload();

        return getSeoDetail(id);
    }

    @Operation(summary = "获取GEO文件生成预览（llms.txt / llms-full.txt / robots.txt / sitemap.xml）")
    @GetMapping("/geo-files")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<Map<String, String>> previewGeoFiles() {
        GeoSyncService.GeoFilesContent content = geoSyncService.generate();
        Map<String, String> data = new LinkedHashMap<>();
        data.put("llmsTxt", content.llmsTxt);
        data.put("llmsFullTxt", content.llmsFullTxt);
        data.put("robotsTxt", content.robotsTxt);
        data.put("sitemapXml", content.sitemapXml);
        return Result.success(data);
    }

    @Operation(summary = "生成并写入GEO文件（llms.txt / llms-full.txt / robots.txt / sitemap.xml）")
    @PostMapping("/geo-files/generate")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<Map<String, String>> generateGeoFiles() {
        try {
            Map<String, String> paths = geoSyncService.generateAndWrite();
            return Result.success("生成成功", paths);
        } catch (IOException e) {
            throw new BusinessException(500, "生成GEO文件失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取GEO自定义配置（llms.txt intro 段 / 追加段）")
    @GetMapping("/geo-config")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<Map<String, String>> getGeoConfig() {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("intro", getConfigValue(GeoSyncService.LLMS_INTRO_KEY, ""));
        data.put("append", getConfigValue(GeoSyncService.LLMS_APPEND_KEY, ""));
        return Result.success(data);
    }

    @Operation(summary = "保存GEO自定义配置（llms.txt intro 段 / 追加段）")
    @PostMapping("/geo-config")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<Void> saveGeoConfig(@RequestBody Map<String, String> body) {
        if (body.containsKey("intro")) {
            saveConfigValue(GeoSyncService.LLMS_INTRO_KEY, body.get("intro"), "llms.txt 在 H1 摘要后的自由 Markdown（无标题）");
        }
        if (body.containsKey("append")) {
            saveConfigValue(GeoSyncService.LLMS_APPEND_KEY, body.get("append"), "llms.txt / llms-full.txt 文件末尾追加段");
        }
        geoSyncService.refreshFilesQuietly();
        seoGenerateService.notifyAiCatalogReload();
        return Result.success(null);
    }

    private String getConfigValue(String key, String fallback) {
        SystemConfig cfg = systemConfigMapper.findByKey(key);
        return cfg != null && cfg.getConfigValue() != null ? cfg.getConfigValue() : fallback;
    }

    private void saveConfigValue(String key, String value, String desc) {
        String v = value != null ? value : "";
        SystemConfig cfg = systemConfigMapper.findByKey(key);
        if (cfg == null) {
            cfg = new SystemConfig();
            cfg.setConfigKey(key);
            cfg.setConfigValue(v);
            cfg.setConfigType("text");
            cfg.setDescription(desc);
            systemConfigMapper.insert(cfg);
        } else if (!v.equals(cfg.getConfigValue())) {
            cfg.setConfigValue(v);
            systemConfigMapper.updateById(cfg);
        }
    }

    @Operation(summary = "删除SEO配置")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<Void> delete(@PathVariable Long id) {
        SeoConfig config = seoConfigMapper.selectById(id);
        if (config != null) {
            seoKeywordMapper.delete(new LambdaQueryWrapper<SeoKeyword>()
                    .eq(SeoKeyword::getPageType, config.getPageType())
                    .eq(SeoKeyword::getPageId, config.getPageId()));
            seoFaqMapper.delete(new LambdaQueryWrapper<SeoFaq>()
                    .eq(SeoFaq::getPageType, config.getPageType())
                    .eq(SeoFaq::getPageId, config.getPageId()));
        }
        seoConfigMapper.deleteById(id);
        geoSyncService.refreshFilesQuietly();
        seoGenerateService.notifyAiCatalogReload();
        return Result.success(null);
    }

    private void validate(SeoConfig seoConfig) {
        if (seoConfig.getTitle() == null || seoConfig.getTitle().trim().isEmpty()) {
            throw new BusinessException(400, "标题不能为空");
        }
        if (seoConfig.getCanonicalUrl() == null || seoConfig.getCanonicalUrl().trim().isEmpty()) {
            throw new BusinessException(400, "Canonical URL不能为空");
        }
        String url = seoConfig.getCanonicalUrl();
        boolean isDetail = url != null && (url.contains("/list/detail") || url.contains("/list/category/detail"));
        if (isDetail && seoConfig.getPageId() == null) {
            throw new BusinessException(400, "详情页配置必须填写页面ID");
        }
    }
}
