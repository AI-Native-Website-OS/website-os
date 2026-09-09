package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("banners")
public class Banner {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String subtitle;

    private String image;

    private String linkUrl;

    private Integer sortOrder;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
