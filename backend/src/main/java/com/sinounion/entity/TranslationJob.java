package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("translation_jobs")
public class TranslationJob {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String resourceType;

    private Long resourceId;

    private String field;

    private String locale;

    private String sourceHash;

    private String sourceText;

    /** translate / polish */
    private String kind;

    /** pending / running / done / failed */
    private String status;

    private Integer attempts;

    private String error;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
