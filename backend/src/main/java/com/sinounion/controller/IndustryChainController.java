package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.entity.IndustryChain;
import com.sinounion.service.IndustryChainService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "产业链图谱管理", description = "产业链图谱相关接口")
@RestController
@RequestMapping("/industry-chains")
@RequiredArgsConstructor
public class IndustryChainController {

    private final IndustryChainService chainService;

    @Operation(summary = "获取产业链图谱树")
    @GetMapping("/tree")
    public Result<List<IndustryChain>> getIndustryChainTree() {
        return Result.success(chainService.getIndustryChainTree());
    }

    @Operation(summary = "获取根节点列表")
    @GetMapping("/roots")
    public Result<List<IndustryChain>> getRootChains() {
        return Result.success(chainService.getRootChains());
    }

    @Operation(summary = "获取子节点列表")
    @GetMapping("/children/{parentId}")
    public Result<List<IndustryChain>> getChildren(@PathVariable Long parentId) {
        return Result.success(chainService.getChildrenByParentId(parentId));
    }
}
