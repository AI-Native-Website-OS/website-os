package com.sinounion.service.impl;

import com.sinounion.entity.Permission;
import com.sinounion.entity.RolePermission;
import com.sinounion.entity.User;
import com.sinounion.mapper.PermissionMapper;
import com.sinounion.mapper.RolePermissionMapper;
import com.sinounion.mapper.UserMapper;
import com.sinounion.service.PermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PermissionServiceImpl implements PermissionService {

    private final PermissionMapper permissionMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final UserMapper userMapper;

    @Override
    public List<Permission> getPermissionsByRole(String role) {
        return permissionMapper.findByRole(role);
    }

    @Override
    public List<Permission> getAllPermissions() {
        return permissionMapper.findAll();
    }

    @Override
    @Transactional
    public void assignPermissionsToRole(String role, List<Long> permissionIds) {
        rolePermissionMapper.deleteByRole(role);
        for (Long permissionId : permissionIds) {
            RolePermission rp = new RolePermission();
            rp.setRole(role);
            rp.setPermissionId(permissionId);
            rolePermissionMapper.insert(rp);
        }
    }

    @Override
    public boolean hasPermission(String username, String permissionCode) {
        User user = userMapper.findByUsername(username);
        if (user == null) {
            return false;
        }
        List<Permission> permissions = permissionMapper.findByRole(user.getRole());
        return permissions.stream().anyMatch(p -> p.getCode().equals(permissionCode));
    }
}
