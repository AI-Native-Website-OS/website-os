package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Data
@TableName("content_items")
public class ContentItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String moduleKey;

    @NotBlank(message = "标题不能为空")
    private String title;

    private String slug;

    private Long categoryId;

    private String groupName;

    private String summary;

    private String content;

    private String coverImage;

    private String coverScale;

    private String filePath;

    private String fileName;

    private Long fileSize;

    private Integer sortOrder;

    private Integer status;

    private Integer isTop;

    private LocalDateTime scheduledAt;

    private LocalDateTime publishedAt;

    private String author;

    private String source;

    private Integer downloadCount;

    private Integer requireForm;

    private String seoTitle;

    private String seoDescription;

    private Integer viewCount;

    private String extraData;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
