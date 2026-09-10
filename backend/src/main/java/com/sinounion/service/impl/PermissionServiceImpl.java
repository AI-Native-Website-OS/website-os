package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.common.BusinessException;
import com.sinounion.dto.CreatePermissionDTO;
import com.sinounion.dto.UpdatePermissionDTO;
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

import java.time.LocalDateTime;
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

    @Override
    @Transactional
    public Permission createPermission(CreatePermissionDTO dto) {
        Long exists = permissionMapper.selectCount(
                new LambdaQueryWrapper<Permission>().eq(Permission::getCode, dto.getCode()));
        if (exists != null && exists > 0) {
            throw new BusinessException("权限编码已存在");
        }
        Permission permission = new Permission();
        permission.setCode(dto.getCode());
        permission.setName(dto.getName());
        permission.setModule(dto.getModule());
        permission.setDescription(dto.getDescription());
        permission.setCreatedAt(LocalDateTime.now());
        permissionMapper.insert(permission);
        // 新权限点默认授予超级管理员，保证其始终拥有系统全部权限
        RolePermission rp = new RolePermission();
        rp.setRole("SUPER_ADMIN");
        rp.setPermissionId(permission.getId());
        rolePermissionMapper.insert(rp);
        return permission;
    }

    @Override
    @Transactional
    public Permission updatePermission(Long id, UpdatePermissionDTO dto) {
        Permission existing = permissionMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException("权限不存在");
        }
        if (dto.getCode() != null && !dto.getCode().equals(existing.getCode())) {
            Long exists = permissionMapper.selectCount(
                    new LambdaQueryWrapper<Permission>().eq(Permission::getCode, dto.getCode()));
            if (exists != null && exists > 0) {
                throw new BusinessException("权限编码已存在");
            }
            existing.setCode(dto.getCode());
        }
        if (dto.getName() != null) existing.setName(dto.getName());
        if (dto.getModule() != null) existing.setModule(dto.getModule());
        if (dto.getDescription() != null) existing.setDescription(dto.getDescription());
        permissionMapper.updateById(existing);
        return existing;
    }

    @Override
    @Transactional
    public void deletePermission(Long id) {
        Permission existing = permissionMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException("权限不存在");
        }
        permissionMapper.deleteById(id);
        rolePermissionMapper.deleteByPermissionId(id);
    }
}
