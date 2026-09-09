package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("seo_keywords")
public class SeoKeyword {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String pageType;

    private Long pageId;

    private String keyword;

    private String category;

    private String intentNote;

    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
