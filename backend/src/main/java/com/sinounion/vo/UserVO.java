package com.sinounion.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class UserVO {
    private Long id;
    private String username;
    private String email;
    private String phone;
    private String realName;
    private String companyName;
    private String avatar;
    private Integer status;
    private String role;
    private String userType;
    private String department;
    private LocalDateTime lastLoginTime;
    private LocalDateTime createdAt;
    private List<String> permissions;
}
