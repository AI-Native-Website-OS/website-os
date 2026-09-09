package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Data
@TableName("content_categories")
public class ContentCategory {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String moduleKey;

    @NotBlank(message = "分类名称不能为空")
    private String name;

    private String slug;

    private String description;

    private String coverImage;

    private Integer sortOrder;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
