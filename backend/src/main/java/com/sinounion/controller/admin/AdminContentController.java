package com.sinounion.controller.admin;

import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.entity.ContentCategory;
import com.sinounion.entity.ContentItem;
import com.sinounion.service.ContentCategoryService;
import com.sinounion.service.ContentItemService;
import com.sinounion.service.KnowledgeSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Slf4j
@Tag(name = "管理后台-通用内容管理", description = "自定义核心模块内容CRUD接口")
@RestController
@RequestMapping("/admin/content/{moduleKey}")
@RequiredArgsConstructor
public class AdminContentController {

    private final ContentItemService contentItemService;
    private final ContentCategoryService contentCategoryService;
    private final KnowledgeSyncService knowledgeSyncService;
    private final ExecutorService syncExecutor = Executors.newSingleThreadExecutor();

    private void asyncSync(ContentItem item) {
        if (item == null) return;
        syncExecutor.submit(() -> {
            try {
                knowledgeSyncService.syncContentItem(item);
            } catch (Exception e) {
                log.error("Auto sync content {} failed: {}", item.getId(), e.getMessage());
            }
        });
    }

    private void asyncDelete(String moduleKey, Long id) {
        if (id == null) return;
        syncExecutor.submit(() -> {
            try {
                knowledgeSyncService.deleteContent(moduleKey, id);
            } catch (Exception e) {
                log.error("Auto delete knowledge {} {} failed: {}", moduleKey, id, e.getMessage());
            }
        });
    }

    @Operation(summary = "获取模块内容列表")
    @GetMapping
    @PreAuthorize("hasAuthority('core_module:view')")
    public Result<PageResult<ContentItem>> getItems(
            @PathVariable String moduleKey,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId) {
        return Result.success(PageResult.of(contentItemService.getItems(moduleKey, page, size, keyword, null, categoryId, null, null)));
    }

    @Operation(summary = "获取模块分类列表")
    @GetMapping("/categories")
    @PreAuthorize("hasAuthority('core_module:view')")
    public Result<List<ContentCategory>> getCategories(@PathVariable String moduleKey) {
        return Result.success(contentCategoryService.getCategories(moduleKey));
    }

    @Operation(summary = "获取分类详情")
    @GetMapping("/categories/{id}")
    @PreAuthorize("hasAuthority('core_module:view')")
    public Result<ContentCategory> getCategoryById(@PathVariable Long id) {
        return Result.success(contentCategoryService.getById(id));
    }

    @Operation(summary = "创建分类")
    @PostMapping("/categories")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<ContentCategory> createCategory(@PathVariable String moduleKey, @Valid @RequestBody ContentCategory category) {
        category.setModuleKey(moduleKey);
        return Result.success(contentCategoryService.create(category));
    }

    @Operation(summary = "更新分类")
    @PutMapping("/categories/{id}")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<ContentCategory> updateCategory(@PathVariable String moduleKey, @PathVariable Long id, @Valid @RequestBody ContentCategory category) {
        category.setModuleKey(moduleKey);
        return Result.success(contentCategoryService.update(id, category));
    }

    @Operation(summary = "删除分类")
    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasAuthority('core_module:delete')")
    public Result<Void> deleteCategory(@PathVariable Long id) {
        contentCategoryService.delete(id);
        return Result.success(null);
    }

    @Operation(summary = "重新排序分类")
    @PutMapping("/categories/reorder")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<Void> reorderCategories(@PathVariable String moduleKey, @RequestBody Map<String, List<Long>> body) {
        contentCategoryService.reorder(body.get("ids"));
        return Result.success(null);
    }

    @Operation(summary = "获取内容详情")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('core_module:view')")
    public Result<ContentItem> getById(@PathVariable Long id) {
        return Result.success(contentItemService.getById(id));
    }

    @Operation(summary = "创建内容")
    @PostMapping
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<ContentItem> create(@PathVariable String moduleKey, @Valid @RequestBody ContentItem item) {
        item.setModuleKey(moduleKey);
        ContentItem created = contentItemService.create(item);
        asyncSync(created);
        return Result.success(created);
    }

    @Operation(summary = "更新内容")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<ContentItem> update(@PathVariable String moduleKey, @PathVariable Long id, @Valid @RequestBody ContentItem item) {
        item.setModuleKey(moduleKey);
        ContentItem updated = contentItemService.update(id, item);
        asyncSync(updated);
        return Result.success(updated);
    }

    @Operation(summary = "删除内容")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('core_module:delete')")
    public Result<Void> delete(@PathVariable String moduleKey, @PathVariable Long id) {
        contentItemService.delete(id);
        asyncDelete(moduleKey, id);
        return Result.success(null);
    }

    @Operation(summary = "批量删除")
    @PostMapping("/batch-delete")
    @PreAuthorize("hasAuthority('core_module:delete')")
    public Result<Void> batchDelete(@PathVariable String moduleKey, @RequestBody List<Long> ids) {
        contentItemService.batchDelete(ids);
        if (ids != null) {
            for (Long id : ids) asyncDelete(moduleKey, id);
        }
        return Result.success(null);
    }

    @Operation(summary = "批量更新状态")
    @PostMapping("/batch-status")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<Void> batchUpdateStatus(@PathVariable String moduleKey, @RequestBody Map<String, Object> body) {
        List<Integer> ids = (List<Integer>) body.get("ids");
        int status = (int) body.get("status");
        contentItemService.batchUpdateStatus(ids.stream().map(Long::valueOf).collect(Collectors.toList()), status);
        for (Integer id : ids) {
            ContentItem item = contentItemService.getById(id.longValue());
            asyncSync(item);
        }
        return Result.success(null);
    }
}
