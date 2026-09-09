package com.sinounion.controller.admin;

import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.entity.Faq;
import com.sinounion.service.FaqService;
import com.sinounion.service.KnowledgeSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

@Tag(name = "管理后台-FAQ管理", description = "FAQ CRUD接口")
@RestController
@RequestMapping("/admin/faqs")
@RequiredArgsConstructor
public class AdminFaqController {

    private final FaqService faqService;
    private final KnowledgeSyncService knowledgeSyncService;

    @Operation(summary = "获取FAQ列表")
    @GetMapping
    public Result<PageResult<Faq>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category) {
        return Result.success(PageResult.of(faqService.getFaqs(page, size, category, keyword)));
    }

    @Operation(summary = "创建FAQ")
    @PostMapping
    public Result<Faq> create(@Valid @RequestBody Faq faq) {
        Faq created = faqService.createFaq(faq);
        knowledgeSyncService.syncFaq(created);
        return Result.success(created);
    }

    @Operation(summary = "更新FAQ")
    @PutMapping("/{id}")
    public Result<Faq> update(@PathVariable Long id, @Valid @RequestBody Faq faq) {
        Faq updated = faqService.updateFaq(id, faq);
        knowledgeSyncService.syncFaq(updated);
        return Result.success(updated);
    }

    @Operation(summary = "删除FAQ")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        faqService.deleteFaq(id);
        knowledgeSyncService.deleteContent("faq", id);
        return Result.success(null);
    }
}
