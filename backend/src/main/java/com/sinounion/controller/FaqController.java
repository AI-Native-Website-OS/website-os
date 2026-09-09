package com.sinounion.controller;

import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.entity.Faq;
import com.sinounion.service.FaqService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "FAQ管理", description = "FAQ相关接口")
@RestController
@RequestMapping("/faqs")
@RequiredArgsConstructor
public class FaqController {

    private final FaqService faqService;

    @Operation(summary = "获取FAQ列表")
    @GetMapping
    public Result<PageResult<Faq>> getFaqs(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String keyword) {
        return Result.success(PageResult.of(faqService.getFaqs(page, size, category, keyword)));
    }

    @Operation(summary = "获取FAQ详情")
    @GetMapping("/{id}")
    public Result<Faq> getFaq(@PathVariable Long id) {
        return Result.success(faqService.getFaqById(id));
    }

    @Operation(summary = "按分类获取FAQ")
    @GetMapping("/category/{category}")
    public Result<List<Faq>> getFaqsByCategory(@PathVariable String category) {
        return Result.success(faqService.getFaqsByCategory(category));
    }

    @Operation(summary = "按产品获取FAQ")
    @GetMapping("/product/{productId}")
    public Result<List<Faq>> getFaqsByProductId(@PathVariable Long productId) {
        return Result.success(faqService.getFaqsByProductId(productId));
    }
}
