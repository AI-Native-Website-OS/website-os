package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.entity.HomeSection;
import com.sinounion.service.HomeSectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@Tag(name = "管理后台-首页区块", description = "首页区块CRUD接口")
@RestController
@RequestMapping("/admin/home/sections")
@RequiredArgsConstructor
public class AdminHomeSectionController {

    private final HomeSectionService homeSectionService;

    @Operation(summary = "获取所有首页区块")
    @GetMapping
    @PreAuthorize("hasAuthority('home_section:view')")
    public Result<List<HomeSection>> getAll() {
        return Result.success(homeSectionService.getAll());
    }

    @Operation(summary = "获取首页区块详情")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('home_section:view')")
    public Result<HomeSection> getById(@PathVariable Long id) {
        return Result.success(homeSectionService.getById(id));
    }

    @Operation(summary = "创建首页区块")
    @PostMapping
    @PreAuthorize("hasAuthority('home_section:create')")
    public Result<HomeSection> create(@Valid @RequestBody HomeSection section) {
        return Result.success(homeSectionService.create(section));
    }

    @Operation(summary = "更新首页区块")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('home_section:update')")
    public Result<HomeSection> update(@PathVariable Long id, @Valid @RequestBody HomeSection section) {
        return Result.success(homeSectionService.update(id, section));
    }

    @Operation(summary = "删除首页区块")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('home_section:delete')")
    public Result<Void> delete(@PathVariable Long id) {
        homeSectionService.delete(id);
        return Result.success(null);
    }

    @Operation(summary = "重新排序首页区块")
    @PutMapping("/reorder")
    @PreAuthorize("hasAuthority('home_section:update')")
    public Result<Void> reorder(@RequestBody Map<String, List<Long>> body) {
        homeSectionService.reorder(body.get("ids"));
        return Result.success(null);
    }
}
