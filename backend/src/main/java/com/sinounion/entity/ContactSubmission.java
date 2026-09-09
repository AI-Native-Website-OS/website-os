package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("contact_submissions")
public class ContactSubmission {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String company;

    private String phone;

    private String email;

    private String subject;

    private String message;

    private String sourcePage;

    private Long leadId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
