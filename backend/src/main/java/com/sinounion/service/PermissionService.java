package com.sinounion.service;

import com.sinounion.dto.CreatePermissionDTO;
import com.sinounion.dto.UpdatePermissionDTO;
import com.sinounion.entity.Permission;

import java.util.List;

public interface PermissionService {
    List<Permission> getPermissionsByRole(String role);
    List<Permission> getAllPermissions();
    void assignPermissionsToRole(String role, List<Long> permissionIds);
    boolean hasPermission(String username, String permissionCode);
    Permission createPermission(CreatePermissionDTO dto);
    Permission updatePermission(Long id, UpdatePermissionDTO dto);
    void deletePermission(Long id);
}
