package com.sinounion.dto;

import lombok.Data;

@Data
public class UpdatePermissionDTO {

    private String code;

    private String name;

    private String module;

    private String description;
}