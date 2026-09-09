package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("role_permissions")
public class RolePermission {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String role;

    private Long permissionId;
}
