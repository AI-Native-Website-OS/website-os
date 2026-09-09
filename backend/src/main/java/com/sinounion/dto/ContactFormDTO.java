package com.sinounion.dto;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class ContactFormDTO {
    @NotBlank(message = "姓名不能为空")
    private String name;

    private String company;

    @NotBlank(message = "手机号不能为空")
    private String phone;

    @Email(message = "邮箱格式不正确")
    private String email;

    @NotBlank(message = "主题不能为空")
    private String subject;

    @NotBlank(message = "留言内容不能为空")
    @Size(max = 2000, message = "留言内容最多2000字")
    private String message;

    private String sourcePage;
}
