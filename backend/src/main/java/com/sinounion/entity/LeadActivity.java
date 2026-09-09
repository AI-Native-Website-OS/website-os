package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("lead_activities")
public class LeadActivity {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long leadId;

    private String activityType;

    private String content;

    private Long operatorId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
