package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("forbidden_topics")
public class ForbiddenTopic {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String description;

    private Float threshold;

    private Boolean enabled = false;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}

