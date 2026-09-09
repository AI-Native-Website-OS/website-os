package com.sinounion.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.common.Result;
import com.sinounion.entity.SeoConfig;
import com.sinounion.mapper.SeoConfigMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "SEO", description = "前台SEO配置接口")
@RestController
@RequestMapping("/seo")
@RequiredArgsConstructor
public class SeoController {

    private final SeoConfigMapper seoConfigMapper;

    @Operation(summary = "按URL获取SEO配置")
    @GetMapping
    public Result<SeoConfig> getSeoConfig(
            @RequestParam(required = false) String url,
            @RequestParam(required = false) Long pageId) {
        if (pageId != null) {
            SeoConfig byId = seoConfigMapper.selectOne(new LambdaQueryWrapper<SeoConfig>()
                    .eq(SeoConfig::getPageId, pageId)
                    .last("LIMIT 1"));
            if (byId != null) {
                return Result.success(byId);
            }
        }
        if (url != null && !url.trim().isEmpty()) {
            SeoConfig byUrl = seoConfigMapper.selectOne(new LambdaQueryWrapper<SeoConfig>()
                    .eq(SeoConfig::getCanonicalUrl, url.trim())
                    .last("LIMIT 1"));
            if (byUrl != null) {
                return Result.success(byUrl);
            }
        }
        return Result.success(null);
    }
}
