package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("leads")
public class Lead {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String company;

    private String phone;

    private String email;

    private String source;

    private String sourcePage;

    private String ipAddress;

    private String country;

    private String province;

    private String city;

    private String interestArea;

    private String requirement;

    private String enterpriseType;

    private String businessDirection;

    private String projectRequirement;

    private String projectTimeline;

    private Integer score;

    private String status;

    private Long assignedTo;

    private String followUpNote;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
