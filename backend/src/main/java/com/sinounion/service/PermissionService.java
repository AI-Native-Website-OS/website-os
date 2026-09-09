package com.sinounion.service;

import com.sinounion.entity.Permission;

import java.util.List;

public interface PermissionService {
    List<Permission> getPermissionsByRole(String role);
    List<Permission> getAllPermissions();
    void assignPermissionsToRole(String role, List<Long> permissionIds);
    boolean hasPermission(String username, String permissionCode);
}
