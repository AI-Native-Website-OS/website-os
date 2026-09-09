package com.sinounion.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.entity.Lead;
import com.sinounion.entity.User;
import com.sinounion.mapper.UserMapper;
import com.sinounion.service.LeadService;
import com.sinounion.util.IpLocationService;
import com.sinounion.utils.JwtUtils;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class LeadControllerDedupTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private LeadService leadService;

    @MockBean
    private IpLocationService ipLocationService;

    @MockBean
    private UserMapper userMapper;

    @MockBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtUtils jwtUtils;

    private String bearerToken(String username) {
        return "Bearer " + jwtUtils.generateToken(1L, username, "NORMAL_USER", 0);
    }

    private String body(String name, String company, String phone, String email) throws Exception {
        Lead lead = new Lead();
        lead.setName(name);
        lead.setCompany(company);
        lead.setPhone(phone);
        lead.setEmail(email);
        lead.setSource("content-cta");
        lead.setSourcePage("示例产品详情页");
        return objectMapper.writeValueAsString(lead);
    }

    @Test
    void blocksDuplicateWhenSamePageSameIpDespiteChangingContactFields() throws Exception {
        when(ipLocationService.lookup(anyString())).thenReturn(new String[]{"中国", "北京市", "北京市"});
        // 同一 IP 同一页面已有一条未处理(new)线索：即使姓名/公司/手机/邮箱全部更换也应拦截
        when(leadService.getLeadBySourcePageUnhandled(eq("示例产品详情页"), eq("203.0.113.5"), any(), any()))
                .thenReturn(new Lead());

        mockMvc.perform(post("/leads")
                .header("X-Forwarded-For", "203.0.113.5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("李四", "另一家公司", "13900000002", "other@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("duplicate_submission"));
    }

    @Test
    void blocksDuplicateWhenPhoneSameButIpDifferent() throws Exception {
        when(ipLocationService.lookup(anyString())).thenReturn(new String[]{"中国", "上海市", "上海市"});
        // 同一手机号（或邮箱）在不同 IP 提交也应拦截
        when(leadService.getLeadBySourcePageUnhandled(eq("示例产品详情页"), eq("198.51.100.7"), eq("13800000001"), any()))
                .thenReturn(new Lead());

        mockMvc.perform(post("/leads")
                .header("X-Forwarded-For", "198.51.100.7")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("张三", "示例科技", "13800000001", "new@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("duplicate_submission"));
    }

    @Test
    void allowsSubmissionWhenNoUnhandledLeadForPage() throws Exception {
        when(ipLocationService.lookup(anyString())).thenReturn(new String[]{"中国", "北京市", "北京市"});
        when(leadService.getLeadBySourcePageUnhandled(any(), any(), any(), any())).thenReturn(null);
        when(leadService.createLead(any())).thenAnswer(invocation -> invocation.getArgument(0));

        mockMvc.perform(post("/leads")
                .header("X-Forwarded-For", "203.0.113.5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("张三", "示例科技", "13800000001", "demo@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void usesAuthenticatedAccountIdentityIgnoringSubmittedContactFields() throws Exception {
        when(ipLocationService.lookup(anyString())).thenReturn(new String[]{"中国", "北京市", "北京市"});
        when(leadService.getLeadBySourcePageUnhandled(any(), any(), any(), any())).thenReturn(null);

        User account = new User();
        account.setUsername("zhangsan");
        account.setRealName("张三");
        account.setCompanyName("示例科技");
        account.setPhone("13800000001");
        account.setEmail("zs@example.com");
        account.setTokenVersion(0);
        when(userMapper.findByUsername("zhangsan")).thenReturn(account);
        when(userDetailsService.loadUserByUsername("zhangsan")).thenReturn(
                new org.springframework.security.core.userdetails.User("zhangsan", "pwd", new ArrayList<>()));

        AtomicReference<Lead> captured = new AtomicReference<>();
        when(leadService.createLead(any())).thenAnswer(invocation -> {
            captured.set(invocation.getArgument(0));
            return invocation.getArgument(0);
        });

        mockMvc.perform(post("/leads")
                .header("Authorization", bearerToken("zhangsan"))
                .header("X-Forwarded-For", "203.0.113.5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("李四", "伪造公司", "13911112222", "fake@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        assertEquals("张三", captured.get().getName());
        assertEquals("示例科技", captured.get().getCompany());
        assertEquals("13800000001", captured.get().getPhone());
        assertEquals("zs@example.com", captured.get().getEmail());
    }

    @Test
    void blocksAuthenticatedUserChangingContactFieldsBecauseServerUsesAccountPhone() throws Exception {
        when(ipLocationService.lookup(anyString())).thenReturn(new String[]{"中国", "北京市", "北京市"});

        User account = new User();
        account.setUsername("zhangsan");
        account.setRealName("张三");
        account.setPhone("13800000001");
        account.setEmail("zs@example.com");
        account.setTokenVersion(0);
        when(userMapper.findByUsername("zhangsan")).thenReturn(account);
        when(userDetailsService.loadUserByUsername("zhangsan")).thenReturn(
                new org.springframework.security.core.userdetails.User("zhangsan", "pwd", new ArrayList<>()));

        // 服务端以账号手机号参与去重：用户改为其他手机/邮箱提交也会命中既有未处理线索
        when(leadService.getLeadBySourcePageUnhandled(eq("示例产品详情页"), any(), eq("13800000001"), any()))
                .thenReturn(new Lead());

        mockMvc.perform(post("/leads")
                .header("Authorization", bearerToken("zhangsan"))
                .header("X-Forwarded-For", "198.51.100.7")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("李四", "伪造公司", "13911112222", "fake@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("duplicate_submission"));
    }
}