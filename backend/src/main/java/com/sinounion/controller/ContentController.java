package com.sinounion.controller;

import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.entity.ContentCategory;
import com.sinounion.entity.ContentItem;
import com.sinounion.service.ContentCategoryService;
import com.sinounion.service.ContentItemService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "通用内容", description = "自定义核心模块通用内容接口")
@RestController
@RequestMapping("/content")
@RequiredArgsConstructor
public class ContentController {

    private final ContentItemService contentItemService;
    private final ContentCategoryService contentCategoryService;

    @Operation(summary = "获取模块内容列表")
    @GetMapping("/{moduleKey}")
    public Result<PageResult<ContentItem>> getItems(
            @PathVariable String moduleKey,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String group,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Boolean top) {
        return Result.success(PageResult.of(contentItemService.getItems(moduleKey, page, size, keyword, group, categoryId, 1, top)));
    }

    @Operation(summary = "获取模块分组列表")
    @GetMapping("/{moduleKey}/groups")
    public Result<List<Map<String, String>>> getGroups(@PathVariable String moduleKey) {
        return Result.success(contentItemService.getGroups(moduleKey));
    }

    @Operation(summary = "获取模块分类列表")
    @GetMapping("/{moduleKey}/categories")
    public Result<List<ContentCategory>> getCategories(@PathVariable String moduleKey) {
        return Result.success(contentCategoryService.getActive(moduleKey));
    }

    @Operation(summary = "获取模块内容详情")
    @GetMapping("/{moduleKey}/{slug}")
    public Result<ContentItem> getBySlug(@PathVariable String moduleKey, @PathVariable String slug) {
        ContentItem item = contentItemService.getBySlug(moduleKey, slug);
        if (item == null || (item.getStatus() != null && item.getStatus() != 1)) {
            return Result.error(404, "内容不存在");
        }
        contentItemService.incrementView(item.getId());
        item.setViewCount((item.getViewCount() == null ? 0 : item.getViewCount()) + 1);
        return Result.success(item);
    }

    @Operation(summary = "获取内容关联内容")
    @GetMapping("/relations")
    public Result<Map<String, List<ContentItem>>> getRelations(
            @RequestParam String moduleKey,
            @RequestParam String slug) {
        return Result.success(contentItemService.getRelations(moduleKey, slug));
    }
}
