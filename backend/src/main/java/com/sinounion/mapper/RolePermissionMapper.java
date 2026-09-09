package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.RolePermission;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RolePermissionMapper extends BaseMapper<RolePermission> {

    @Select("SELECT * FROM role_permissions WHERE role = #{role}")
    List<RolePermission> findByRole(String role);

    @Delete("DELETE FROM role_permissions WHERE role = #{role}")
    int deleteByRole(String role);
}
