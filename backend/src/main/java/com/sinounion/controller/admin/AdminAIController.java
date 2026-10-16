package com.sinounion.controller.admin;

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

import javax.annotation.PreDestroy;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

@Slf4j
@Tag(name = "管理后台-AI知识库", description = "AI知识库全局管理接口")
@RestController
@RequestMapping("/admin/ai")
@RequiredArgsConstructor
public class AdminAIController {

    private final KnowledgeSyncService knowledgeSyncService;
    private final ContentItemService contentItemService;
    private final ContentCategoryService contentCategoryService;
    private final CoreModuleService coreModuleService;
    private final FaqService faqService;
    private final HomeSectionService homeSectionService;
    private final AboutSectionService aboutSectionService;
    private final BannerService bannerService;
    private final SystemConfigMapper systemConfigMapper;
    private final ContactInfoMapper contactInfoMapper;
    private final SyncProgressTracker progressTracker;

    private final ExecutorService syncExecutor = Executors.newSingleThreadExecutor();

    @Operation(summary = "全局同步所有内容到知识库（按来源分库，异步返回taskId）")
    @PostMapping("/sync-all")
    @PreAuthorize("hasAuthority('ai:knowledge:edit')")
    public Result<Map<String, Object>> syncAll() {
        SyncProgress sp = progressTracker.create("knowledge_sync");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("taskId", sp.getTaskId());
        result.put("status", "started");
        syncExecutor.submit(() -> performSync(sp));
        return Result.success(result);
    }

    @Operation(summary = "查询知识库同步进度")
    @GetMapping("/sync-progress/{taskId}")
    @PreAuthorize("hasAuthority('ai:knowledge:view')")
    public Result<SyncProgress> getSyncProgress(@PathVariable String taskId) {
        SyncProgress sp = progressTracker.get(taskId);
        if (sp == null) {
            return Result.error("任务不存在或已过期");
        }
        return Result.success(sp);
    }

    private void performSync(SyncProgress sp) {
        try {
            List<SyncStep> steps = buildSteps();
            sp.start(steps.size());
            for (SyncStep step : steps) {
                sp.advance(step.label);
                try {
                    step.action.run();
                    sp.addSuccess();
                } catch (Exception e) {
                    sp.addFail();
                    log.error("Sync {} failed: {}", step.label, e.getMessage());
                }
            }
            sp.complete();
            log.info("Knowledge sync completed: total={}, success={}, fail={}",
                    sp.getTotal(), sp.getSuccess(), sp.getFail());
        } catch (Exception e) {
            sp.error(e.getMessage());
            log.error("Knowledge sync failed: {}", e.getMessage());
        }
    }

    private List<SyncStep> buildSteps() {
        List<SyncStep> steps = new ArrayList<>();
        steps.add(new SyncStep("清空旧「网站内容」库", knowledgeSyncService::clearWebsiteKb));

        // 内容管理：核心模块 → 内容分类 → 内容项（启用模块同步，禁用模块清理）
        for (CoreModule module : coreModuleService.getAll()) {
            final CoreModule m = module;
            boolean moduleEnabled = m.getStatus() != null && m.getStatus() == 1;
            if (!moduleEnabled) {
                steps.add(new SyncStep("模块(禁用)：" + moduleLabel(m),
                        () -> knowledgeSyncService.deleteModuleKnowledge(m)));
                continue;
            }
            steps.add(new SyncStep("模块目录：" + moduleLabel(m), () -> knowledgeSyncService.syncCoreModule(m)));
            for (ContentCategory category : contentCategoryService.getCategories(m.getModuleKey())) {
                final ContentCategory c = category;
                steps.add(new SyncStep("分类：" + c.getName(), () -> knowledgeSyncService.syncContentCategory(c)));
            }
            for (ContentItem item : contentItemService.getItems(
                    m.getModuleKey(), 1, Integer.MAX_VALUE, null, null, null, null, null).getRecords()) {
                final ContentItem it = item;
                steps.add(new SyncStep("内容：" + it.getTitle(), () -> knowledgeSyncService.syncContentItem(it)));
            }
        }

        // 固定来源
        for (Faq f : faqService.getFaqs(1, Integer.MAX_VALUE, null, null).getRecords()) {
            final Faq faq = f;
            steps.add(new SyncStep("FAQ：" + faq.getQuestion(), () -> knowledgeSyncService.syncFaq(faq)));
        }
        for (HomeSection s : homeSectionService.getActive()) {
            final HomeSection sec = s;
            steps.add(new SyncStep("首页区块：" + sec.getTitle(), () -> knowledgeSyncService.syncHomeSection(sec)));
        }
        for (AboutSection s : aboutSectionService.getActive()) {
            final AboutSection sec = s;
            steps.add(new SyncStep("关于区块：" + sec.getTitle(), () -> knowledgeSyncService.syncAboutSection(sec)));
        }
        addConfigStep(steps, "home_page", "首页配置", knowledgeSyncService::syncHomePage);
        addConfigStep(steps, "about_page", "关于配置", knowledgeSyncService::syncAboutPage);
        addConfigStep(steps, "home_footer", "页脚", knowledgeSyncService::syncFooterConfig);
        addConfigStep(steps, "ai_website_config", "版本配置", knowledgeSyncService::syncVersionConfig);
        for (Banner b : bannerService.getAllActiveBanners()) {
            final Banner banner = b;
            steps.add(new SyncStep("Banner：" + banner.getTitle(), () -> knowledgeSyncService.syncBanner(banner)));
        }
        try {
            List<ContactInfo> contacts = contactInfoMapper.findAllOrdered();
            if (contacts != null && !contacts.isEmpty()) {
                final List<ContactInfo> list = contacts;
                steps.add(new SyncStep("联系方式", () -> knowledgeSyncService.syncContactInfo(list)));
            }
        } catch (Exception e) {
            log.error("Query contacts failed: {}", e.getMessage());
        }
        return steps;
    }

    private void addConfigStep(List<SyncStep> steps, String key, String label, Consumer<String> fn) {
        try {
            SystemConfig config = systemConfigMapper.findByKey(key);
            if (config != null) {
                String value = config.getConfigValue();
                steps.add(new SyncStep(label, () -> fn.accept(value)));
            }
        } catch (Exception e) {
            log.error("Query config {} failed: {}", key, e.getMessage());
        }
    }

    private static String moduleLabel(CoreModule m) {
        String name = m.getModuleName();
        return name != null && !name.isEmpty() ? name : m.getModuleKey();
    }

    @PreDestroy
    public void shutdown() {
        syncExecutor.shutdown();
    }

    private static class SyncStep {
        final String label;
        final Runnable action;

        SyncStep(String label, Runnable action) {
            this.label = label;
            this.action = action;
        }
    }
}
