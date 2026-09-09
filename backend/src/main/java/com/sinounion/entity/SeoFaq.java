package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("seo_faqs")
public class SeoFaq {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String pageType;

    private Long pageId;

    private String question;

    private String answer;

    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
