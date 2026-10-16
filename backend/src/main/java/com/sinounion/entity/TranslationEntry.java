package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("translation_entries")
public class TranslationEntry {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String resourceType;

    private Long resourceId;

    private String field;

    private String locale;

    private String sourceHash;

    private String sourceText;

    private String translatedText;

    /** draft / final / disabled */
    private String status;

    /** llm / nmt / manual */
    private String engine;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
