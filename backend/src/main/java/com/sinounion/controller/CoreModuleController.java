package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.entity.CoreModule;
import com.sinounion.service.CoreModuleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "核心模块", description = "前台核心模块接口")
@RestController
@RequestMapping("/core-modules")
@RequiredArgsConstructor
public class CoreModuleController {

    private final CoreModuleService coreModuleService;

    @Operation(summary = "获取启用的核心模块列表")
    @GetMapping
    public Result<List<CoreModule>> getActiveModules() {
        return Result.success(coreModuleService.getActive());
    }
}
