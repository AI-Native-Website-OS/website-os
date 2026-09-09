package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.entity.HomeSection;
import com.sinounion.service.HomeSectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "首页区块", description = "首页区块数据接口")
@RestController
@RequestMapping("/home/sections")
@RequiredArgsConstructor
public class HomeSectionController {

    private final HomeSectionService homeSectionService;

    @Operation(summary = "获取所有启用的首页区块")
    @GetMapping
    public Result<List<HomeSection>> getActiveSections() {
        return Result.success(homeSectionService.getActive());
    }
}
