package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("faqs")
public class Faq {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String question;

    private String answer;

    private String category;

    private Long productId;

    private Integer sortOrder;

    private Integer status;

    private Integer viewCount;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableLogic
    private Integer deleted;
}
