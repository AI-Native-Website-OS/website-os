package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.dto.AssignRolePermissionsDTO;
import com.sinounion.entity.Permission;
import com.sinounion.service.PermissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@Tag(name = "管理后台-权限管理", description = "权限和角色配置")
@RestController
@RequestMapping("/admin/permissions")
@RequiredArgsConstructor
public class AdminPermissionController {

    private final PermissionService permissionService;

    @Operation(summary = "获取所有权限")
    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<List<Permission>> getAllPermissions() {
        return Result.success(permissionService.getAllPermissions());
    }

    @Operation(summary = "获取角色权限")
    @GetMapping("/role/{role}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<List<Permission>> getPermissionsByRole(@PathVariable String role) {
        return Result.success(permissionService.getPermissionsByRole(role));
    }

    @Operation(summary = "分配角色权限")
    @PostMapping("/assign")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Void> assignPermissions(@Valid @RequestBody AssignRolePermissionsDTO dto) {
        permissionService.assignPermissionsToRole(dto.getRole(), dto.getPermissionIds());
        return Result.success(null);
    }
}
