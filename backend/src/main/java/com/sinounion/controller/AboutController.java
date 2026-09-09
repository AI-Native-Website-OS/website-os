package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "关于我们", description = "关于页面内容")
@RestController
@RequestMapping("/about")
@RequiredArgsConstructor
public class AboutController {

    private final SystemConfigMapper systemConfigMapper;

    @Operation(summary = "获取关于页面内容")
    @GetMapping("/page")
    public Result<SystemConfig> getAboutPage() {
        SystemConfig config = systemConfigMapper.findByKey("about_page");
        return Result.success(config);
    }
}
