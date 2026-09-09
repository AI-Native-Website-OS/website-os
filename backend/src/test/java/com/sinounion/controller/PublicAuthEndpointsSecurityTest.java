package com.sinounion.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.dto.SendSmsCodeDTO;
import com.sinounion.dto.SmsLoginDTO;
import com.sinounion.security.LoginRateLimiter;
import com.sinounion.service.SmsService;
import com.sinounion.service.UserService;
import com.sinounion.task.TempFileCleanupTask;
import com.sinounion.vo.LoginVO;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK, properties = {
    "SERVER_PORT=0",
    "SPRING_APPLICATION_NAME=sinounion-test",
    "SPRING_DATASOURCE_URL=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
    "SPRING_DATASOURCE_USERNAME=sa",
    "SPRING_DATASOURCE_PASSWORD=",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "SPRING_REDIS_HOST=localhost",
    "SPRING_REDIS_PORT=26379",
    "SPRING_REDIS_PASSWORD=sinodata",
    "JWT_SECRET=test-secret-key-which-is-at-least-256-bits-long-for-hs512",
    "JWT_EXPIRATION=86400000",
    "UPLOAD_PATH=.",
    "UPLOAD_ALLOWED_TYPES=*",
    "AI_SERVICE_URL=http://localhost:8000",
    "AI_SERVICE_MEMORIES_DIR=.",
    "APP_FRONTEND_PUBLIC_DIR=.",
    "APP_CONFIG_FILE_PATH=."
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class PublicAuthEndpointsSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserService userService;

    @MockBean
    private LoginRateLimiter loginRateLimiter;

    @MockBean
    private SmsService smsService;

    @MockBean
    private TempFileCleanupTask tempFileCleanupTask;

    @Test
    void sendCodeIsAccessibleWithoutAuthentication() throws Exception {
        SendSmsCodeDTO dto = new SendSmsCodeDTO();
        dto.setPhone("13800138000");
        when(smsService.sendCode("13800138000")).thenReturn("123456");

        mockMvc.perform(post("/auth/send-code")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void loginByCodeIsAccessibleWithoutAuthentication() throws Exception {
        SmsLoginDTO dto = new SmsLoginDTO();
        dto.setPhone("13800138000");
        dto.setCode("123456");
        when(userService.loginByCode(any())).thenReturn(new LoginVO());

        mockMvc.perform(post("/auth/login-by-code")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());
    }
}