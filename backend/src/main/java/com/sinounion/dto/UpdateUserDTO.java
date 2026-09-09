package com.sinounion.dto;

import lombok.Data;

import javax.validation.constraints.Email;

@Data
public class UpdateUserDTO {
    @Email(message = "邮箱格式不正确")
    private String email;

    private String phone;
    private String realName;
    private String avatar;
    private String role;
    private String department;
}
