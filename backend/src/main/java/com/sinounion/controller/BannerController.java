package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.entity.Banner;
import com.sinounion.service.BannerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "轮播图管理", description = "轮播图相关接口")
@RestController
@RequestMapping("/banners")
@RequiredArgsConstructor
public class BannerController {

    private final BannerService bannerService;

    @Operation(summary = "获取所有启用的轮播图")
    @GetMapping
    public Result<List<Banner>> getActiveBanners() {
        return Result.success(bannerService.getAllActiveBanners());
    }

    @Operation(summary = "获取轮播图详情")
    @GetMapping("/{id}")
    public Result<Banner> getBanner(@PathVariable Long id) {
        return Result.success(bannerService.getBannerById(id));
    }
}
