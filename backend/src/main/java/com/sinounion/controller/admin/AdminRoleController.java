package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.dto.CreateRoleDTO;
import com.sinounion.dto.UpdateRoleDTO;
import com.sinounion.service.RoleService;
import com.sinounion.vo.RoleVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@Tag(name = "管理后台-角色管理", description = "角色CRUD接口")
@RestController
@RequestMapping("/admin/roles")
@RequiredArgsConstructor
public class AdminRoleController {

    private final RoleService roleService;

    @Operation(summary = "获取所有角色")
    @GetMapping
    @PreAuthorize("hasAuthority('user:view')")
    public Result<List<RoleVO>> getAllRoles() {
        return Result.success(roleService.getAllRoles());
    }

    @Operation(summary = "获取角色详情")
    @GetMapping("/{code}")
    @PreAuthorize("hasAuthority('user:view')")
    public Result<RoleVO> getRole(@PathVariable String code) {
        return Result.success(roleService.getRole(code));
    }

    @Operation(summary = "创建角色")
    @PostMapping
    @PreAuthorize("hasAuthority('user:create')")
    public Result<RoleVO> createRole(@Valid @RequestBody CreateRoleDTO dto) {
        return Result.success(roleService.createRole(dto));
    }

    @Operation(summary = "更新角色")
    @PutMapping("/{code}")
    @PreAuthorize("hasAuthority('user:update')")
    public Result<RoleVO> updateRole(@PathVariable String code, @Valid @RequestBody UpdateRoleDTO dto) {
        return Result.success(roleService.updateRole(code, dto));
    }

    @Operation(summary = "删除角色")
    @DeleteMapping("/{code}")
    @PreAuthorize("hasAuthority('user:delete')")
    public Result<Void> deleteRole(@PathVariable String code) {
        roleService.deleteRole(code);
        return Result.success(null);
    }
}
