package com.sinounion.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class CreatePermissionDTO {

    @NotBlank(message = "权限编码不能为空")
    private String code;

    @NotBlank(message = "权限名称不能为空")
    private String name;

    @NotBlank(message = "所属模块不能为空")
    private String module;

    private String description;
}