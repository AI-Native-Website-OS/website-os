package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("page_views")
public class PageView {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String pageType;

    private Long pageId;

    private Long userId;

    private String pageUrl;

    private String visitorId;

    private String ipAddress;

    private String userAgent;

    private String referer;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime visitTime;
}
