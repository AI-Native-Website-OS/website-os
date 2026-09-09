package com.sinounion.dto;

import lombok.Data;

@Data
public class UpdateRoleDTO {
    private String name;
    private String description;
    private Integer sortOrder;
}
