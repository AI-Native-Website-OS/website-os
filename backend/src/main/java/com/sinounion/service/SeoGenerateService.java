package com.sinounion.service;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.sinounion.model.SyncProgress;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * SEO 一键同步：
 * 1) 执行基础 SEO 配置同步（缺失创建、URL/pageId 修正）；
 * 2) 重生成 llms.txt / robots.txt / sitemap.xml，并通知 AI 顾问刷新词库缓存。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SeoGenerateService {

    @Value("${ai.service.url}")
    private String aiServiceUrl;

    private final SeoSyncService seoSyncService;
    private final GeoSyncService geoSyncService;
    private final AiRequestSigner aiRequestSigner;

    @javax.annotation.PostConstruct
    public void init() {
        if (aiServiceUrl != null) {
            aiServiceUrl = aiServiceUrl.trim();
        }
    }

    public void syncSeoAndGeo(SyncProgress sp) {
        Map<String, Integer> base = seoSyncService.syncAll();

        sp.start(1);
        sp.advance("基础SEO配置同步完成（新建 " + base.getOrDefault("created", 0)
                + "，更新 " + base.getOrDefault("updated", 0) + "）");

        sp.complete();
        geoSyncService.refreshFilesQuietly();
        notifyAiCatalogReload();
        log.info("SEO sync done: created={}, updated={}", base.getOrDefault("created", 0), base.getOrDefault("updated", 0));
    }

    /** 通知 AI 顾问清除内容目录缓存，使 SEO/GEO 词库变更立即生效（失败仅告警）。 */
    public void notifyAiCatalogReload() {
        try {
            HttpRequest request = HttpRequest.post(aiServiceUrl + "/ai/catalog/reload")
                    .timeout(15000);
            aiRequestSigner.sign(request);
            HttpResponse response = request.execute();
            if (response.getStatus() != 200) {
                log.warn("AI catalog reload HTTP {}: {}", response.getStatus(), response.body());
            }
        } catch (Exception e) {
            log.warn("AI catalog reload call failed: {}", e.getMessage());
        }
    }
}