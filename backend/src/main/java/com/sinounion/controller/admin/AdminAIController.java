package com.sinounion.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.common.Result;
import com.sinounion.entity.*;
import com.sinounion.mapper.ContactInfoMapper;
import com.sinounion.mapper.SystemConfigMapper;
import com.sinounion.model.SyncProgress;
import com.sinounion.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Tag(name = "管理后台-AI知识库", description = "AI知识库全局管理接口")
@RestController
@RequestMapping("/admin/ai")
@RequiredArgsConstructor
public class AdminAIController {

    private final KnowledgeSyncService knowledgeSyncService;
    private final ContentItemService contentItemService;
    private final CoreModuleService coreModuleService;
    private final FaqService faqService;
    private final HomeSectionService homeSectionService;
    private final AboutSectionService aboutSectionService;
    private final BannerService bannerService;
    private final SystemConfigMapper systemConfigMapper;
    private final ContactInfoMapper contactInfoMapper;
    private final SyncProgressTracker progressTracker;

    private final ExecutorService syncExecutor = Executors.newSingleThreadExecutor();

    @Operation(summary = "全局同步所有内容到知识库")
    @PostMapping("/sync-all")
    @PreAuthorize("hasAuthority('ai:knowledge:edit')")
    public Result<Map<String, Object>> syncAll() {
        Map<String, Object> result = new HashMap<>();
        int total = 0, success = 0, fail = 0;

        // 遍历所有核心模块（含动态新增）：启用模块同步内容，禁用模块清理其在知识库的历史内容
        for (CoreModule module : coreModuleService.getAll()) {
            boolean moduleEnabled = module.getStatus() != null && module.getStatus() == 1;
            Page<ContentItem> page = contentItemService.getItems(module.getModuleKey(), 1, Integer.MAX_VALUE, null, null, null, null, null);
            for (ContentItem item : page.getRecords()) {
                total++;
                try {
                    if (moduleEnabled) {
                        knowledgeSyncService.syncContentItem(item);
                    } else {
                        knowledgeSyncService.deleteContent(item.getModuleKey(), item.getId());
                    }
                    success++;
                } catch (Exception e) {
                    log.error("Sync content_item {} failed: {}", item.getId(), e.getMessage());
                    fail++;
                }
            }
        }
        for (Faq f : faqService.getFaqs(1, Integer.MAX_VALUE, null, null).getRecords()) {
            total++;
            try { knowledgeSyncService.syncFaq(f); success++; } catch (Exception e) { log.error("Sync faq {} failed: {}", f.getId(), e.getMessage()); fail++; }
        }
        for (HomeSection s : homeSectionService.getActive()) {
            total++;
            try { knowledgeSyncService.syncHomeSection(s); success++; } catch (Exception e) { log.error("Sync home section {} failed: {}", s.getId(), e.getMessage()); fail++; }
        }
        for (AboutSection s : aboutSectionService.getActive()) {
            total++;
            try { knowledgeSyncService.syncAboutSection(s); success++; } catch (Exception e) { log.error("Sync about section {} failed: {}", s.getId(), e.getMessage()); fail++; }
        }
        try {
            SystemConfig hc = systemConfigMapper.findByKey("home_page");
            if (hc != null) { total++; try { knowledgeSyncService.syncHomePage(hc.getConfigValue()); success++; } catch (Exception e) { log.error("Sync home config failed: {}", e.getMessage()); fail++; } }
            SystemConfig ac = systemConfigMapper.findByKey("about_page");
            if (ac != null) { total++; try { knowledgeSyncService.syncAboutPage(ac.getConfigValue()); success++; } catch (Exception e) { log.error("Sync about config failed: {}", e.getMessage()); fail++; } }
        } catch (Exception e) { log.error("Query configs failed: {}", e.getMessage()); }
        for (Banner b : bannerService.getAllActiveBanners()) {
            total++;
            try { knowledgeSyncService.syncBanner(b); success++; } catch (Exception e) { log.error("Sync banner {} failed: {}", b.getId(), e.getMessage()); fail++; }
        }
        try {
            List<ContactInfo> contacts = contactInfoMapper.findAllOrdered();
            if (contacts != null && !contacts.isEmpty()) {
                total++;
                try { knowledgeSyncService.syncContactInfo(contacts); success++; } catch (Exception e) { log.error("Sync contacts failed: {}", e.getMessage()); fail++; }
            }
        } catch (Exception e) { log.error("Query contacts failed: {}", e.getMessage()); }

        result.put("total", total); result.put("success", success); result.put("fail", fail);
        log.info("Global sync: total={}, success={}, fail={}", total, success, fail);
        return Result.success("全局同步完成", result);
    }

    @Operation(summary = "按类型同步内容（异步，返回taskId）")
    @PostMapping("/sync-type")
    @PreAuthorize("hasAuthority('ai:knowledge:edit')")
    public Result<Map<String, Object>> syncByType(@RequestParam String type) {
        SyncProgress sp = progressTracker.create(type);
        Map<String, Object> result = new HashMap<>();
        result.put("taskId", sp.getTaskId());
        result.put("status", "started");

        syncExecutor.submit(() -> {
            try {
                runSyncByType(type, sp);
            } catch (Exception e) {
                sp.error(e.getMessage());
                log.error("Sync {} failed: {}", type, e.getMessage());
            }
        });

        return Result.success(result);
    }

    @Operation(summary = "查询同步进度")
    @GetMapping("/sync-progress/{taskId}")
    @PreAuthorize("hasAuthority('ai:knowledge:view')")
    public Result<SyncProgress> getSyncProgress(@PathVariable String taskId) {
        SyncProgress sp = progressTracker.get(taskId);
        if (sp == null) {
            return Result.error("任务不存在或已过期");
        }
        return Result.success(sp);
    }

    @Operation(summary = "清理已完成的同步任务")
    @PostMapping("/sync-progress/cleanup")
    @PreAuthorize("hasAuthority('ai:knowledge:edit')")
    public Result<Void> cleanupProgress() {
        progressTracker.cleanup();
        return Result.success(null);
    }

    private void runSyncByType(String type, SyncProgress sp) {
        int total = countTotal(type);
        sp.start(total);

        String module = moduleKeyFor(type);
        if (module != null) {
            Page<ContentItem> page = contentItemService.getItems(module, 1, Integer.MAX_VALUE, null, null, null, null, null);
            for (ContentItem item : page.getRecords()) {
                try { knowledgeSyncService.syncContentItem(item); sp.addSuccess(); } catch (Exception e) { sp.addFail(); log.error("Sync content_item {} failed: {}", item.getId(), e.getMessage()); }
                sp.advance(item.getTitle());
            }
        } else {
            switch (type) {
                case "faq":
                    for (Faq f : faqService.getFaqs(1, Integer.MAX_VALUE, null, null).getRecords()) {
                        try { knowledgeSyncService.syncFaq(f); sp.addSuccess(); } catch (Exception e) { sp.addFail(); log.error("Sync faq {} failed: {}", f.getId(), e.getMessage()); }
                        sp.advance("FAQ: " + f.getQuestion());
                    }
                    break;
                case "home":
                    for (HomeSection s : homeSectionService.getActive()) {
                        try { knowledgeSyncService.syncHomeSection(s); sp.addSuccess(); } catch (Exception e) { sp.addFail(); log.error("Sync home section {} failed: {}", s.getId(), e.getMessage()); }
                        sp.advance(s.getTitle());
                    }
                    try {
                        SystemConfig hc = systemConfigMapper.findByKey("home_page");
                        if (hc != null) { knowledgeSyncService.syncHomePage(hc.getConfigValue()); sp.addSuccess(); sp.advance("首页整体配置"); }
                    } catch (Exception e) { sp.addFail(); log.error("Sync home page config failed: {}", e.getMessage()); }
                    break;
                case "about":
                    for (AboutSection s : aboutSectionService.getActive()) {
                        try { knowledgeSyncService.syncAboutSection(s); sp.addSuccess(); } catch (Exception e) { sp.addFail(); log.error("Sync about section {} failed: {}", s.getId(), e.getMessage()); }
                        sp.advance(s.getTitle());
                    }
                    try {
                        SystemConfig ac = systemConfigMapper.findByKey("about_page");
                        if (ac != null) { knowledgeSyncService.syncAboutPage(ac.getConfigValue()); sp.addSuccess(); sp.advance("关于整体配置"); }
                    } catch (Exception e) { sp.addFail(); log.error("Sync about page config failed: {}", e.getMessage()); }
                    break;
                default:
                    break;
            }
        }
        sp.complete();
        log.info("Sync {} completed: total={}, success={}, fail={}", type, sp.getTotal(), sp.getSuccess(), sp.getFail());
    }

    private static String moduleKeyFor(String type) {
        switch (type) {
            case "product": return "products";
            case "solution": return "solutions";
            case "case": return "cases";
            case "resource": return "resources";
            default: return null;
        }
    }

    private int countTotal(String type) {
        String module = moduleKeyFor(type);
        if (module != null) {
            return (int) contentItemService.getItems(module, 1, Integer.MAX_VALUE, null, null, null, null, null).getRecords().size();
        }
        switch (type) {
            case "faq": return (int) faqService.getFaqs(1, Integer.MAX_VALUE, null, null).getRecords().size();
            case "home": return homeSectionService.getActive().size() + 1;
            case "about": return aboutSectionService.getActive().size() + 1;
            default: return 0;
        }
    }
}
