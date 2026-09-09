package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.entity.AboutSection;
import com.sinounion.service.AboutSectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@Tag(name = "管理后台-关于区块", description = "关于页面区块CRUD接口")
@RestController
@RequestMapping("/admin/about/sections")
@RequiredArgsConstructor
public class AdminAboutSectionController {

    private final AboutSectionService aboutSectionService;

    @Operation(summary = "获取所有关于页面区块")
    @GetMapping
    @PreAuthorize("hasAuthority('about_section:view')")
    public Result<List<AboutSection>> getAll() {
        return Result.success(aboutSectionService.getAll());
    }

    @Operation(summary = "获取关于页面区块详情")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('about_section:view')")
    public Result<AboutSection> getById(@PathVariable Long id) {
        return Result.success(aboutSectionService.getById(id));
    }

    @Operation(summary = "创建关于页面区块")
    @PostMapping
    @PreAuthorize("hasAuthority('about_section:create')")
    public Result<AboutSection> create(@Valid @RequestBody AboutSection section) {
        return Result.success(aboutSectionService.create(section));
    }

    @Operation(summary = "更新关于页面区块")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('about_section:update')")
    public Result<AboutSection> update(@PathVariable Long id, @Valid @RequestBody AboutSection section) {
        return Result.success(aboutSectionService.update(id, section));
    }

    @Operation(summary = "删除关于页面区块")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('about_section:delete')")
    public Result<Void> delete(@PathVariable Long id) {
        aboutSectionService.delete(id);
        return Result.success(null);
    }

    @Operation(summary = "重新排序关于页面区块")
    @PutMapping("/reorder")
    @PreAuthorize("hasAuthority('about_section:update')")
    public Result<Void> reorder(@RequestBody Map<String, List<Long>> body) {
        aboutSectionService.reorder(body.get("ids"));
        return Result.success(null);
    }
}
