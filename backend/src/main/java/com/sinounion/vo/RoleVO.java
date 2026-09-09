package com.sinounion.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class RoleVO {
    private String code;
    private String name;
    private String description;
    private Integer sortOrder;
    private Long userCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
