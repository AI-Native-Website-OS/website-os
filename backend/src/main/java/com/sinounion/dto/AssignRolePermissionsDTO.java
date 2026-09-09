package com.sinounion.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class AssignRolePermissionsDTO {
    @NotBlank(message = "角色不能为空")
    private String role;

    @NotNull(message = "权限ID列表不能为空")
    private List<Long> permissionIds;
}
