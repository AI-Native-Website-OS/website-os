package com.sinounion.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.entity.ContentItem;
import com.sinounion.mapper.ContentItemMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Tag(name = "管理后台-关联内容", description = "关联内容选择器接口")
@RestController
@RequestMapping("/admin/related-content")
@RequiredArgsConstructor
public class AdminRelatedContentController {

    private final ContentItemMapper contentItemMapper;

    @Operation(summary = "获取关联内容列表")
    @GetMapping("/list")
    public Result<PageResult<Map<String, Object>>> list(
            @RequestParam String type,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        String moduleKey = moduleKeyFor(type);
        if (moduleKey == null) {
            return Result.success(new PageResult<>(0L, 0L, (long) page, (long) size, Collections.emptyList()));
        }
        Page<ContentItem> p = contentItemMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<ContentItem>()
                        .eq(ContentItem::getModuleKey, moduleKey)
                        .eq(ContentItem::getStatus, 1)
                        .and(keyword != null && !keyword.isEmpty(), w -> w.like(ContentItem::getTitle, keyword))
                        .orderByAsc(ContentItem::getSortOrder).orderByDesc(ContentItem::getId));
        List<Map<String, Object>> records = p.getRecords().stream()
                .map(item -> toMap(item.getId(), item.getTitle(), item.getSlug(), item.getSummary(), item.getCoverImage(), type))
                .collect(Collectors.toList());
        return Result.success(new PageResult<>(p.getTotal(), p.getPages(), p.getCurrent(), p.getSize(), records));
    }

    @Operation(summary = "批量获取关联内容详情")
    @GetMapping("/batch")
    public Result<List<Map<String, Object>>> batch(
            @RequestParam String type,
            @RequestParam String ids) {
        List<Long> idList = Arrays.stream(ids.split(","))
                .filter(s -> !s.isEmpty())
                .map(Long::parseLong)
                .collect(Collectors.toList());
        if (idList.isEmpty()) return Result.success(Collections.emptyList());

        String moduleKey = moduleKeyFor(type);
        List<Map<String, Object>> result = new ArrayList<>();
        if (moduleKey == null) return Result.success(result);
        contentItemMapper.selectBatchIds(idList).forEach(item ->
                result.add(toMap(item.getId(), item.getTitle(), item.getSlug(), item.getSummary(), item.getCoverImage(), type)));
        return Result.success(result);
    }

    private static String moduleKeyFor(String type) {
        switch (type) {
            case "product": return "products";
            case "solution": return "solutions";
            case "case": return "cases";
            case "resource": return "resources";
            default: return type;
        }
    }

    private Map<String, Object> toMap(Long id, String title, String slug, String summary, String coverImage, String type) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", id);
        map.put("title", title);
        map.put("slug", slug);
        map.put("summary", summary != null ? summary : "");
        map.put("coverImage", coverImage != null ? coverImage : "");
        map.put("type", type);
        return map;
    }
}
