package com.sinounion.vo;

import lombok.Data;

import java.util.List;

@Data
public class LoginVO {
    private String token;
    private String refreshToken;
    private UserVO user;
    private List<String> permissions;
}
