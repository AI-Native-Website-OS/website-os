package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.dto.LoginDTO;
import com.sinounion.dto.RegisterDTO;
import com.sinounion.dto.SendSmsCodeDTO;
import com.sinounion.dto.SmsLoginDTO;
import com.sinounion.entity.User;
import com.sinounion.security.LoginRateLimiter;
import com.sinounion.service.SmsService;
import com.sinounion.service.UserService;
import com.sinounion.vo.LoginVO;
import com.sinounion.vo.UserVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;

@Tag(name = "认证管理", description = "用户登录注册")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final LoginRateLimiter loginRateLimiter;
    private final SmsService smsService;

    @Operation(summary = "用户登录")
    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginDTO dto, HttpServletRequest request) {
        if (loginRateLimiter.isBlocked(dto.getUsername(), request)) {
            return Result.error(429, "登录尝试过于频繁，请15分钟后再试");
        }
        try {
            LoginVO loginVO = userService.login(dto);
            loginRateLimiter.resetSuccess(dto.getUsername(), request);
            return Result.success(loginVO);
        } catch (Exception e) {
            loginRateLimiter.recordFailure(dto.getUsername(), request);
            throw e;
        }
    }

    @Operation(summary = "用户注册")
    @PostMapping("/register")
    public Result<UserVO> register(@Valid @RequestBody RegisterDTO dto) {
        return Result.success(userService.register(dto));
    }

    @Operation(summary = "获取当前用户信息")
    @GetMapping("/me")
    public Result<UserVO> getCurrentUser(Authentication authentication) {
        String username = authentication.getName();
        User user = userService.getUserByUsername(username);
        return Result.success(userService.getUserById(user.getId()));
    }

    @Operation(summary = "发送短信验证码")
    @PostMapping("/send-code")
    public Result<String> sendCode(@Valid @RequestBody SendSmsCodeDTO dto) {
        String devCode = smsService.sendCode(dto.getPhone());
        // 开发兜底模式返回验证码；真实短信模式返回 null
        return Result.success(devCode);
    }

    @Operation(summary = "手机号验证码登录")
    @PostMapping("/login-by-code")
    public Result<LoginVO> loginByCode(@Valid @RequestBody SmsLoginDTO dto) {
        return Result.success(userService.loginByCode(dto));
    }
}
