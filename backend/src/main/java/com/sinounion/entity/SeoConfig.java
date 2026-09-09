package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("seo_configs")
public class SeoConfig {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String pageType;

    private Long pageId;

    private String title;

    private String description;

    private String keywords;

    private String canonicalUrl;

    private String ogTitle;

    private String ogDescription;

    private String ogImage;

    private String robots;

    private String ogType;

    private String geoSummary;

    private Integer enabled;

    /** GEO llms.txt 中归入 ## Optional 节（1=是，0=否），llms-full.txt 内联回主节。 */
    private Integer geoOptional;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
