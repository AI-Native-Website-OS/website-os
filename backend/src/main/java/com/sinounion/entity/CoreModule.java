package com.sinounion.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Data
@TableName("core_modules")
public class CoreModule {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String moduleKey;

    @NotBlank(message = "模块名称不能为空")
    private String moduleName;

    private String moduleTitle;

    private String moduleDescription;

    @NotNull(message = "模块类型不能为空")
    private Integer moduleType;

    private String path;

    private Integer sortOrder;

    private Integer status;

    private Integer moduleColumns;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Integer deleted;
}
