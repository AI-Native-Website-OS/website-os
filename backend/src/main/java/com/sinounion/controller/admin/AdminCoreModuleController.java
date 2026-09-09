package com.sinounion.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.entity.CoreModule;
import com.sinounion.service.CoreModuleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Tag(name = "管理后台-核心模块管理", description = "核心模块CRUD接口")
@RestController
@RequestMapping("/admin/core-modules")
@RequiredArgsConstructor
public class AdminCoreModuleController {

    private final CoreModuleService coreModuleService;

    @Operation(summary = "获取核心模块列表")
    @GetMapping
    @PreAuthorize("hasAuthority('core_module:view')")
    public Result<PageResult<CoreModule>> getModules(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword) {
        return Result.success(PageResult.of(coreModuleService.getModules(page, size, keyword)));
    }

    @Operation(summary = "获取全部核心模块")
    @GetMapping("/all")
    @PreAuthorize("hasAuthority('core_module:view')")
    public Result<List<CoreModule>> getAll() {
        return Result.success(coreModuleService.getAll());
    }

    @Operation(summary = "获取核心模块详情")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('core_module:view')")
    public Result<CoreModule> getById(@PathVariable Long id) {
        return Result.success(coreModuleService.getById(id));
    }

    @Operation(summary = "创建核心模块")
    @PostMapping
    @PreAuthorize("hasAuthority('core_module:create')")
    public Result<CoreModule> create(@Valid @RequestBody CoreModule module) {
        return Result.success(coreModuleService.create(module));
    }

    @Operation(summary = "更新核心模块")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<CoreModule> update(@PathVariable Long id, @Valid @RequestBody CoreModule module) {
        return Result.success(coreModuleService.update(id, module));
    }

    @Operation(summary = "删除核心模块")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('core_module:delete')")
    public Result<Void> delete(@PathVariable Long id) {
        coreModuleService.delete(id);
        return Result.success(null);
    }

    @Operation(summary = "重新排序核心模块")
    @PutMapping("/reorder")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<Void> reorder(@RequestBody Map<String, List<Long>> body) {
        coreModuleService.reorder(body.get("ids"));
        return Result.success(null);
    }

    @Operation(summary = "批量更新状态")
    @PostMapping("/batch-status")
    @PreAuthorize("hasAuthority('core_module:update')")
    public Result<Void> batchUpdateStatus(@RequestBody Map<String, Object> body) {
        List<Integer> ids = (List<Integer>) body.get("ids");
        int status = (int) body.get("status");
        coreModuleService.batchUpdateStatus(ids.stream().map(Long::valueOf).collect(Collectors.toList()), status);
        return Result.success(null);
    }
}
