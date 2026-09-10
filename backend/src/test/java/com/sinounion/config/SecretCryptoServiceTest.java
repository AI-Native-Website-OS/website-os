package com.sinounion.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SecretCryptoServiceTest {

    private SecretCryptoService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new SecretCryptoService();
        Field f = SecretCryptoService.class.getDeclaredField("configuredAesKey");
        f.setAccessible(true);
        f.set(service, "unit-test-secret-key-0123456789abcdef");
        service.init();
    }

    private String encryptWithPublic(String plain) throws Exception {
        byte[] der = Base64.getDecoder().decode(service.publicKeyBase64());
        Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        // 与前端 WebCrypto（RSA-OAEP / SHA-256）保持一致：MGF1 也必须是 SHA-256
        cipher.init(Cipher.ENCRYPT_MODE, KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der)),
            new OAEPParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT));
        return "rsa:v1:" + Base64.getEncoder().encodeToString(
            cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void aesRoundTrip() {
        String enc = service.encryptAtRest("sk-test-123456");
        assertTrue(service.isEncrypted(enc));
        assertEquals("sk-test-123456", service.decryptAtRest(enc));
    }

    @Test
    void aesEmptyUnchanged() {
        assertNull(service.encryptAtRest(null));
        assertEquals("", service.encryptAtRest(""));
    }

    @Test
    void legacyPlaintextPassthrough() {
        assertEquals("plain-value", service.decryptAtRest("plain-value"));
    }

    @Test
    void rsaRoundTrip() throws Exception {
        String cipher = encryptWithPublic("sk-rsa-abc");
        assertEquals("sk-rsa-abc", service.decryptTransport("LLM_API_KEY", cipher));
    }

    @Test
    void resolveForStorage_sensitive() throws Exception {
        // 留空 / 掩码占位 → 保持原值
        assertNull(service.resolveForStorage("sms_access_key_secret", ""));
        assertNull(service.resolveForStorage("sms_access_key_secret", "******"));
        // 新值 → RSA 解密 + AES 落盘
        String stored = service.resolveForStorage("LLM_API_KEY", encryptWithPublic("sk-new-value"));
        assertTrue(service.isEncrypted(stored));
        assertEquals("sk-new-value", service.decryptAtRest(stored));
        // 历史明文直传（兼容） → 同样 AES 落盘
        String storedPlain = service.resolveForStorage("LLM_API_KEY", "sk-legacy");
        assertTrue(service.isEncrypted(storedPlain));
        assertEquals("sk-legacy", service.decryptAtRest(storedPlain));
    }

    @Test
    void resolveForStorage_nonSensitive() {
        assertEquals("gpt-4o", service.resolveForStorage("LLM_MODEL", "gpt-4o"));
        assertEquals("", service.resolveForStorage("LLM_MODEL", ""));
    }

    @Test
    void mask() {
        assertEquals("******", service.mask("sms_access_key_secret", "abc"));
        assertEquals("******", service.mask("LLM_API_KEY", "x"));
        assertEquals("", service.mask("sms_access_key_secret", ""));
        assertEquals("gpt-4o", service.mask("LLM_MODEL", "gpt-4o"));
    }
}