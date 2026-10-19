package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_notice_dismissals")
public class UserNoticeDismissal {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String noticeId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
