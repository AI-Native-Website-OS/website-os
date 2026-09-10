package com.sinounion.service;

import com.aliyun.dysmsapi20170525.models.SendSmsResponse;
import com.aliyun.dysmsapi20170525.models.SendSmsResponseBody;
import com.aliyun.tea.TeaException;
import com.sinounion.common.BusinessException;
import com.sinounion.config.SecretCryptoService;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SmsServiceTest {

    private RedisTemplate<String, Object> redisTemplate;
    private SystemConfigMapper systemConfigMapper;
    private SecretCryptoService secretCryptoService;
    private TestableSmsService smsService;

    static class TestableSmsService extends SmsService {
        private com.aliyun.dysmsapi20170525.Client fakeClient;

        TestableSmsService(RedisTemplate<String, Object> redisTemplate, SystemConfigMapper mapper, SecretCryptoService crypto) {
            super(redisTemplate, mapper, crypto);
        }

        void setFakeClient(com.aliyun.dysmsapi20170525.Client client) {
            this.fakeClient = client;
        }

        @Override
        protected com.aliyun.dysmsapi20170525.Client createClient(String accessKeyId, String accessKeySecret) {
            return fakeClient;
        }
    }

    private static SecretCryptoService newCrypto() throws Exception {
        SecretCryptoService crypto = new SecretCryptoService();
        Field f = SecretCryptoService.class.getDeclaredField("configuredAesKey");
        f.setAccessible(true);
        f.set(crypto, "unit-test-secret-key-0123456789abcdef");
        crypto.init();
        return crypto;
    }

    @BeforeEach
    void setUp() throws Exception {
        redisTemplate = mock(RedisTemplate.class);
        ValueOperations<String, Object> valueOps = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        systemConfigMapper = mock(SystemConfigMapper.class);
        secretCryptoService = newCrypto();
        smsService = new TestableSmsService(redisTemplate, systemConfigMapper, secretCryptoService);
    }

    private void mockSmsConfig(boolean configured) {
        if (!configured) {
            when(systemConfigMapper.findByKey(anyString())).thenReturn(null);
            return;
        }
        for (String key : new String[]{"sms_access_key_id", "sms_access_key_secret", "sms_sign_name", "sms_template_code"}) {
            SystemConfig cfg = new SystemConfig();
            cfg.setConfigKey(key);
            cfg.setConfigValue("test-" + key);
            when(systemConfigMapper.findByKey(key)).thenReturn(cfg);
        }
    }

    @Test
    void sendCodeFallsBackToDevCodeWhenSmsNotConfigured() {
        mockSmsConfig(false);

        String code = smsService.sendCode("13800138000");

        assertNotNull(code);
        assertTrue(code.matches("\\d{6}"));
    }

    @Test
    void sendCodeReturnsNullWhenSmsConfiguredAndAliyunAccepts() throws Exception {
        mockSmsConfig(true);
        com.aliyun.dysmsapi20170525.Client client = mock(com.aliyun.dysmsapi20170525.Client.class);
        SendSmsResponse resp = new SendSmsResponse();
        SendSmsResponseBody body = new SendSmsResponseBody();
        body.setCode("OK");
        resp.setBody(body);
        when(client.sendSmsWithOptions(any(), any())).thenReturn(resp);
        smsService.setFakeClient(client);

        String code = smsService.sendCode("13800138000");

        assertNull(code);
    }

    @Test
    void sendCodeThrowsBusinessExceptionWhenSmsConfiguredButAliyunRejects() throws Exception {
        mockSmsConfig(true);
        com.aliyun.dysmsapi20170525.Client client = mock(com.aliyun.dysmsapi20170525.Client.class);
        when(client.sendSmsWithOptions(any(), any()))
                .thenThrow(new TeaException("isv.SMS_SIGNATURE_ILLEGAL", null));
        smsService.setFakeClient(client);

        assertThrows(BusinessException.class, () -> smsService.sendCode("13800138000"));
    }
}