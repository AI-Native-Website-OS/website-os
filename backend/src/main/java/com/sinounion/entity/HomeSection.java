package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Data
@TableName("home_sections")
public class HomeSection {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String sectionType;

    @NotBlank(message = "区块标题不能为空")
    private String title;

    private String subtitle;

    private String description;

    private String image;

    private String url;

    private String extraData;

    private Integer sortOrder;

    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
