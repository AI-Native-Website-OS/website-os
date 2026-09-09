package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("partners")
public class Partner {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String logo;

    private String websiteUrl;

    private Integer sortOrder;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
