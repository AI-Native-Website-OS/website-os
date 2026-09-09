package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_behaviors")
public class UserBehavior {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String visitorId;

    private String behaviorType;

    private String targetType;

    private Long targetId;

    private String metadata;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
