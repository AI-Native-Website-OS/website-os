package com.sinounion.service.impl;

import com.sinounion.common.BusinessException;
import com.sinounion.dto.CreateRoleDTO;
import com.sinounion.dto.UpdateRoleDTO;
import com.sinounion.entity.Role;
import com.sinounion.mapper.RoleMapper;
import com.sinounion.mapper.RolePermissionMapper;
import com.sinounion.service.RoleService;
import com.sinounion.vo.RoleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleServiceImpl implements RoleService {

    private final RoleMapper roleMapper;
    private final RolePermissionMapper rolePermissionMapper;

    @Override
    public List<RoleVO> getAllRoles() {
        List<Role> roles = roleMapper.selectList(null);
        return roles.stream()
                .map(this::toRoleVO)
                .collect(Collectors.toList());
    }

    @Override
    public RoleVO getRole(String code) {
        Role role = roleMapper.selectById(code);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        return toRoleVO(role);
    }

    @Override
    public RoleVO createRole(CreateRoleDTO dto) {
        if (roleMapper.selectById(dto.getCode()) != null) {
            throw new BusinessException("角色编码已存在");
        }
        Role role = new Role();
        role.setCode(dto.getCode());
        role.setName(dto.getName());
        role.setDescription(dto.getDescription());
        role.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        roleMapper.insert(role);
        return toRoleVO(role);
    }

    @Override
    public RoleVO updateRole(String code, UpdateRoleDTO dto) {
        Role role = roleMapper.selectById(code);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        if (dto.getName() != null) role.setName(dto.getName());
        if (dto.getDescription() != null) role.setDescription(dto.getDescription());
        if (dto.getSortOrder() != null) role.setSortOrder(dto.getSortOrder());
        roleMapper.updateById(role);
        return toRoleVO(role);
    }

    @Override
    @Transactional
    public void deleteRole(String code) {
        Role role = roleMapper.selectById(code);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        long userCount = roleMapper.countUsersByRole(code);
        if (userCount > 0) {
            throw new BusinessException("该角色下有 " + userCount + " 个用户，无法删除");
        }
        rolePermissionMapper.deleteByRole(code);
        roleMapper.deleteById(code);
    }

    private RoleVO toRoleVO(Role role) {
        RoleVO vo = new RoleVO();
        vo.setCode(role.getCode());
        vo.setName(role.getName());
        vo.setDescription(role.getDescription());
        vo.setSortOrder(role.getSortOrder());
        vo.setCreatedAt(role.getCreatedAt());
        vo.setUpdatedAt(role.getUpdatedAt());
        vo.setUserCount(roleMapper.countUsersByRole(role.getCode()));
        return vo;
    }
}
