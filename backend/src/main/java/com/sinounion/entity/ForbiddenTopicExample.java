package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("forbidden_topic_examples")
public class ForbiddenTopicExample {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long topicId;

    private String content;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
