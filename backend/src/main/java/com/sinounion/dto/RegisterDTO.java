package com.sinounion.dto;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
public class RegisterDTO {
    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 50, message = "用户名长度3-50个字符")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 100, message = "密码长度6-100个字符")
    private String password;

    @Email(message = "邮箱格式不正确")
    private String email;

    private String phone;

    private String realName;

    private String companyName;

    /** 短信验证码（当使用手机号注册时必填） */
    private String code;
}
