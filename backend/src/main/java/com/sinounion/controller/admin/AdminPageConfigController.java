package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.entity.Banner;
import com.sinounion.service.BannerService;
import com.sinounion.service.KnowledgeSyncDispatcher;
import com.sinounion.translation.TranslationEnqueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@Tag(name = "管理后台-页面配置", description = "Banner等页面配置接口")
@RestController
@RequestMapping("/admin/pages")
@RequiredArgsConstructor
public class AdminPageConfigController {

    private final BannerService bannerService;
    private final KnowledgeSyncDispatcher knowledgeSyncDispatcher;
    private final TranslationEnqueueService translationEnqueueService;

    @Operation(summary = "获取Banner列表")
    @GetMapping("/banners")
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<List<Banner>> getBanners() {
        return Result.success(bannerService.getAllActiveBanners());
    }

    @Operation(summary = "创建Banner")
    @PostMapping("/banners")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<Banner> createBanner(@Valid @RequestBody Banner banner) {
        Banner created = bannerService.createBanner(banner);
        knowledgeSyncDispatcher.syncBanner(created);
        translationEnqueueService.enqueueEntity("banner", created);
        return Result.success(created);
    }

    @Operation(summary = "更新Banner")
    @PutMapping("/banners/{id}")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<Banner> updateBanner(@PathVariable Long id, @Valid @RequestBody Banner banner) {
        Banner updated = bannerService.updateBanner(id, banner);
        knowledgeSyncDispatcher.syncBanner(updated);
        translationEnqueueService.enqueueEntity("banner", updated);
        return Result.success(updated);
    }

    @Operation(summary = "删除Banner")
    @DeleteMapping("/banners/{id}")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<Void> deleteBanner(@PathVariable Long id) {
        bannerService.deleteBanner(id);
        knowledgeSyncDispatcher.deleteContent("banner", id);
        translationEnqueueService.removeResource("banner", id);
        return Result.success(null);
    }
}
