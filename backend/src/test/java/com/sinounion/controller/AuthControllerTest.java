package com.sinounion.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.dto.LoginDTO;
import com.sinounion.dto.RegisterDTO;
import com.sinounion.security.LoginRateLimiter;
import com.sinounion.service.UserService;
import com.sinounion.vo.LoginVO;
import com.sinounion.vo.UserVO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @MockBean
    private LoginRateLimiter loginRateLimiter;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void loginSuccessReturns200() throws Exception {
        LoginDTO dto = new LoginDTO();
        dto.setUsername("admin");
        dto.setPassword("password");

        LoginVO loginVO = new LoginVO();
        loginVO.setToken("test-token");
        when(userService.login(any())).thenReturn(loginVO);

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.token").value("test-token"));
    }

    @Test
    void registerSuccessReturns200() throws Exception {
        RegisterDTO dto = new RegisterDTO();
        dto.setUsername("newuser");
        dto.setPassword("pass123");
        dto.setPhone("13800138000");

        UserVO userVO = new UserVO();
        userVO.setUsername("newuser");
        when(userService.register(any())).thenReturn(userVO);

        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void loginWithInvalidCredentialsReturnsError() throws Exception {
        LoginDTO dto = new LoginDTO();
        dto.setUsername("wrong");
        dto.setPassword("wrong");

        when(userService.login(any())).thenThrow(new RuntimeException("用户名或密码错误"));

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().is5xxServerError());
    }
}
