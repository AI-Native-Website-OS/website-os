package com.sinounion.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;

@Data
public class CreateRoleDTO {
    @NotBlank(message = "角色编码不能为空")
    private String code;

    @NotBlank(message = "角色名称不能为空")
    private String name;

    private String description;

    private Integer sortOrder;
}
