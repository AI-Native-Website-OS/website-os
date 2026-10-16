package com.sinounion.controller.admin;

import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.entity.ContentCategory;
import com.sinounion.entity.ContentItem;
import com.sinounion.service.ContentCategoryService;
import com.sinounion.service.ContentItemService;
import com.sinounion.service.KnowledgeSyncDispatcher;
import com.sinounion.translation.TranslationEnqueueService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Tag(name = "管理后台-通用内容管理", description = "自定义核心模块内容CRUD接口")
@RestController
@RequestMapping("/admin/content/{moduleKey}")
@RequiredArgsConstructor
public class AdminContentController {

    private final ContentItemService contentItemService;
    private final ContentCategoryService contentCategoryService;
    private final KnowledgeSyncDispatcher knowledgeSyncDispatcher;
    private final TranslationEnqueueService translationEnqueueService;

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
        ContentCategory created = contentCategoryService.create(category);
        knowledgeSyncDispatcher.syncContentCategory(created);
        translationEnqueueService.enqueueEntity("content_category", created);
        return Result.success(created);
    }

    @Operation(summary = "更新分类")
    @PutMapping("/categories/{id}")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<ContentCategory> updateCategory(@PathVariable String moduleKey, @PathVariable Long id, @Valid @RequestBody ContentCategory category) {
        category.setModuleKey(moduleKey);
        ContentCategory updated = contentCategoryService.update(id, category);
        knowledgeSyncDispatcher.syncContentCategory(updated);
        translationEnqueueService.enqueueEntity("content_category", updated);
        return Result.success(updated);
    }

    @Operation(summary = "删除分类")
    @DeleteMapping("/categories/{id}")
    @PreAuthorize("hasAuthority('core_module:delete')")
    public Result<Void> deleteCategory(@PathVariable Long id) {
        ContentCategory existing = contentCategoryService.getById(id);
        contentCategoryService.delete(id);
        knowledgeSyncDispatcher.deleteCategoryKnowledge(existing);
        translationEnqueueService.removeResource("content_category", id);
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
        knowledgeSyncDispatcher.syncContentItem(created);
        translationEnqueueService.enqueueEntity("content_item", created);
        return Result.success(created);
    }

    @Operation(summary = "更新内容")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<ContentItem> update(@PathVariable String moduleKey, @PathVariable Long id, @Valid @RequestBody ContentItem item) {
        item.setModuleKey(moduleKey);
        ContentItem updated = contentItemService.update(id, item);
        knowledgeSyncDispatcher.syncContentItem(updated);
        translationEnqueueService.enqueueEntity("content_item", updated);
        return Result.success(updated);
    }

    @Operation(summary = "删除内容")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('core_module:delete')")
    public Result<Void> delete(@PathVariable String moduleKey, @PathVariable Long id) {
        contentItemService.delete(id);
        knowledgeSyncDispatcher.deleteContent(moduleKey, id);
        translationEnqueueService.removeResource("content_item", id);
        return Result.success(null);
    }

    @Operation(summary = "批量删除")
    @PostMapping("/batch-delete")
    @PreAuthorize("hasAuthority('core_module:delete')")
    public Result<Void> batchDelete(@PathVariable String moduleKey, @RequestBody List<Long> ids) {
        contentItemService.batchDelete(ids);
        if (ids != null) {
            for (Long id : ids) knowledgeSyncDispatcher.deleteContent(moduleKey, id);
        }
        translationEnqueueService.removeResources("content_item", ids);
        return Result.success(null);
    }

    @Operation(summary = "移动内容排序")
    @PutMapping("/{id}/move")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<Void> move(@PathVariable String moduleKey,
                             @PathVariable Long id,
                             @RequestParam Long targetId,
                             @RequestParam(defaultValue = "before") String position,
                             @RequestParam(required = false) Long categoryId) {
        contentItemService.move(moduleKey, id, targetId, position, categoryId);
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
            knowledgeSyncDispatcher.syncContentItem(item);
        }
        return Result.success(null);
    }
}
