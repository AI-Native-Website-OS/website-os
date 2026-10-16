package com.sinounion.service;

import com.sinounion.entity.AboutSection;
import com.sinounion.entity.Banner;
import com.sinounion.entity.ContactInfo;
import com.sinounion.entity.ContentCategory;
import com.sinounion.entity.ContentItem;
import com.sinounion.entity.CoreModule;
import com.sinounion.entity.Faq;
import com.sinounion.entity.HomeSection;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.annotation.PreDestroy;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 将 CMS 内容变更写入 AI 知识库的操作放到后台线程执行，避免阻塞管理端请求。
 * 具体的知识库读写仍由 {@link KnowledgeSyncService} 完成（其内部已吞掉异常并记录日志）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeSyncDispatcher {

    private final KnowledgeSyncService knowledgeSyncService;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    public void syncContentItem(ContentItem item) {
        if (item == null) return;
        submit(() -> knowledgeSyncService.syncContentItem(item), "content_item", item.getId());
    }

    public void syncCoreModule(CoreModule module) {
        if (module == null) return;
        submit(() -> knowledgeSyncService.syncCoreModule(module), "core_module", module.getId());
    }

    public void syncContentCategory(ContentCategory category) {
        if (category == null) return;
        submit(() -> knowledgeSyncService.syncContentCategory(category), "content_category", category.getId());
    }

    public void deleteModuleKnowledge(CoreModule module) {
        if (module == null) return;
        submit(() -> knowledgeSyncService.deleteModuleKnowledge(module), "core_module", module.getId());
    }

    public void deleteCategoryKnowledge(ContentCategory category) {
        if (category == null) return;
        submit(() -> knowledgeSyncService.deleteCategoryKnowledge(category), "content_category", category.getId());
    }

    public void clearWebsiteKb() {
        submit(() -> knowledgeSyncService.clearWebsiteKb(), "website_kb", null);
    }

    public void syncVersionConfig(String content) {
        submit(() -> knowledgeSyncService.syncVersionConfig(content), "version_config", null);
    }

    public void syncFaq(Faq faq) {
        if (faq == null) return;
        submit(() -> knowledgeSyncService.syncFaq(faq), "faq", faq.getId());
    }

    public void syncHomeSection(HomeSection section) {
        if (section == null) return;
        submit(() -> knowledgeSyncService.syncHomeSection(section), "home_section", section.getId());
    }

    public void syncAboutSection(AboutSection section) {
        if (section == null) return;
        submit(() -> knowledgeSyncService.syncAboutSection(section), "about_section", section.getId());
    }

    public void syncBanner(Banner banner) {
        if (banner == null) return;
        submit(() -> knowledgeSyncService.syncBanner(banner), "banner", banner.getId());
    }

    public void syncHomePage(String content) {
        submit(() -> knowledgeSyncService.syncHomePage(content), "home", null);
    }

    public void syncAboutPage(String content) {
        submit(() -> knowledgeSyncService.syncAboutPage(content), "about", null);
    }

    public void syncFooterConfig(String content) {
        submit(() -> knowledgeSyncService.syncFooterConfig(content), "home_footer", null);
    }

    public void syncContactInfo(List<ContactInfo> contacts) {
        if (contacts == null) return;
        submit(() -> knowledgeSyncService.syncContactInfo(contacts), "contact_info", null);
    }

    public void deleteContent(String sourceType, Long sourceId) {
        if (sourceId == null) return;
        submit(() -> knowledgeSyncService.deleteContent(sourceType, sourceId), sourceType, sourceId);
    }

    private void submit(Runnable task, String type, Long id) {
        try {
            executor.submit(() -> {
                try {
                    task.run();
                } catch (Exception e) {
                    log.error("Async knowledge sync failed: type={}, id={}, error={}", type, id, e.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("Schedule knowledge sync failed: type={}, id={}, error={}", type, id, e.getMessage());
        }
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdown();
    }
}
