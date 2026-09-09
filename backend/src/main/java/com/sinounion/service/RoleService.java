package com.sinounion.service;

import com.sinounion.dto.CreateRoleDTO;
import com.sinounion.dto.UpdateRoleDTO;
import com.sinounion.vo.RoleVO;
import java.util.List;

public interface RoleService {
    List<RoleVO> getAllRoles();
    RoleVO getRole(String code);
    RoleVO createRole(CreateRoleDTO dto);
    RoleVO updateRole(String code, UpdateRoleDTO dto);
    void deleteRole(String code);
}
