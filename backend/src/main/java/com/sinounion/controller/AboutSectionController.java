package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.entity.AboutSection;
import com.sinounion.service.AboutSectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "关于页面区块", description = "关于页面区块数据接口")
@RestController
@RequestMapping("/about/sections")
@RequiredArgsConstructor
public class AboutSectionController {

    private final AboutSectionService aboutSectionService;

    @Operation(summary = "获取所有启用的关于页面区块")
    @GetMapping
    public Result<List<AboutSection>> getActiveSections() {
        return Result.success(aboutSectionService.getActive());
    }
}
