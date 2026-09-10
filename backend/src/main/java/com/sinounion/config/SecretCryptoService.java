package com.sinounion.config;

import com.sinounion.util.SensitiveKeys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 敏感配置项加解密服务。
 *
 * 安全模型：
 *   传输层  — 前端用后端下发的 RSA 公钥（OAEP-SHA256）加密新值，密文以 {@code rsa:v1:} 前缀进入请求体；
 *   存储层  — 敏感值在 system_configs 表中以 AES-256-GCM 密文保存，以 {@code enc:v1:} 前缀标识。
 *
 * AES 密钥来源：环境变量 CONFIG_CRYPTO_AES_KEY（Base64，32 字节；也兼容任意字符串并自动派生）。
 * 未配置时自动生成并持久化到项目 .env，保证重启后仍可解密存量密文。
 */
@Slf4j
@Component
public class SecretCryptoService {

    private static final String ENC_PREFIX = "enc:v1:";
    private static final String RSA_PREFIX = "rsa:v1:";
    private static final String AES_ALGO = "AES";
    private static final String RSA_ALGO = "RSA";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_LEN = 12;

    @Value("${config-crypto.aes-key:}")
    private String configuredAesKey;

    private SecretKey aesKey;
    private KeyPair rsaKeyPair;
    /** 自动生成 AES key 且未能持久化时为 true：此时不执行存量明文加密迁移，避免重启后无法解密。 */
    private volatile boolean aesKeyEphemeral;

    @PostConstruct
    public void init() {
        initRsaKeyPair();
        initAesKey();
    }

    private void initRsaKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(RSA_ALGO);
            generator.initialize(2048);
            rsaKeyPair = generator.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException("初始化 RSA 密钥对失败", e);
        }
    }

    private void initAesKey() {
        try {
            String raw = configuredAesKey == null ? "" : configuredAesKey.trim();
            if (!raw.isEmpty()) {
                aesKey = deriveAesKey(raw);
                return;
            }
            KeyGenerator generator = KeyGenerator.getInstance(AES_ALGO);
            generator.init(256);
            SecretKey generated = generator.generateKey();
            String b64 = Base64.getEncoder().encodeToString(generated.getEncoded());
            if (persistAesKeyToEnv(b64)) {
                aesKey = generated;
                log.warn("CONFIG_CRYPTO_AES_KEY 未配置，已自动生成并写入 .env；生产环境请显式配置强随机密钥。");
            } else {
                aesKey = generated;
                aesKeyEphemeral = true;
                log.error("CONFIG_CRYPTO_AES_KEY 未配置且无法写入 .env，当前使用一次性内存密钥，"
                    + "重启后存量密文将无法解密，已跳过存量数据加密迁移。");
            }
        } catch (Exception e) {
            throw new IllegalStateException("初始化 AES 密钥失败", e);
        }
    }

    private SecretKey deriveAesKey(String raw) throws Exception {
        try {
            byte[] decoded = Base64.getDecoder().decode(raw.trim());
            if (decoded.length == 16 || decoded.length == 24 || decoded.length == 32) {
                return new SecretKeySpec(decoded, AES_ALGO);
            }
        } catch (IllegalArgumentException ignored) {
            // 非 Base64，按普通字符串派生
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] key = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
        return new SecretKeySpec(key, AES_ALGO);
    }

    private boolean persistAesKeyToEnv(String b64) {
        Path envPath = resolveEnvPath();
        try {
            List<String> lines = Files.exists(envPath)
                ? new ArrayList<>(Files.readAllLines(envPath, StandardCharsets.UTF_8))
                : new ArrayList<>();
            for (String line : lines) {
                String t = line.trim();
                if (t.startsWith("CONFIG_CRYPTO_AES_KEY=")) {
                    return true; // 已存在（理论上不会走到这里）
                }
            }
            lines.add("CONFIG_CRYPTO_AES_KEY=" + b64);
            Files.write(envPath, lines, StandardCharsets.UTF_8);
            return true;
        } catch (IOException e) {
            log.error("写入 CONFIG_CRYPTO_AES_KEY 到 .env 失败", e);
            return false;
        }
    }

    private Path resolveEnvPath() {
        String userDir = System.getProperty("user.dir");
        Path p = Paths.get(userDir, "..", ".env").normalize();
        if (Files.exists(p)) return p;
        p = Paths.get(userDir, ".env").normalize();
        if (Files.exists(p)) return p;
        return Paths.get(userDir, "..", ".env").normalize();
    }

    public boolean isSensitive(String key) {
        return SensitiveKeys.isSensitive(key);
    }

    public boolean isAesKeyEphemeral() {
        return aesKeyEphemeral;
    }

    /** 是否 AES 落盘密文。 */
    public boolean isEncrypted(String value) {
        return value != null && value.startsWith(ENC_PREFIX);
    }

    /** 是否为前端传输密文。 */
    public boolean isRsaCipher(String value) {
        return value != null && value.startsWith(RSA_PREFIX);
    }

    /**
     * GET 回显脱敏：敏感且非空 → 掩码占位；未配置 → 空串；非敏感 → 原样。
     */
    public String mask(String key, String value) {
        if (!SensitiveKeys.isSensitive(key)) {
            return value;
        }
        return value == null || value.isEmpty() ? "" : SensitiveKeys.MASK;
    }

    /**
     * 解析提交的密钥值，返回应落盘存储的值。
     *
     * @return 需要写入 DB 的值；返回 null 表示"保持原值不变"（留空或掩码占位）。
     */
    public String resolveForStorage(String key, String payload) {
        if (!SensitiveKeys.isSensitive(key)) {
            return payload;
        }
        String value = payload == null ? "" : payload.trim();
        if (value.isEmpty() || SensitiveKeys.MASK.equals(value)) {
            return null;
        }
        String plain = decryptTransport(key, value);
        if (plain == null || plain.isEmpty()) {
            return "";
        }
        return encryptAtRest(plain);
    }

    /**
     * 解析提交值（RSA 密文 → 明文；非敏感/明文直接返回），供写入 .env 等非 DB 场景使用。
     * 返回 null 表示"未变更"。
     */
    public String resolvePlain(String key, String payload) {
        if (!SensitiveKeys.isSensitive(key)) {
            return payload;
        }
        String value = payload == null ? "" : payload.trim();
        if (value.isEmpty() || SensitiveKeys.MASK.equals(value)) {
            return null;
        }
        return decryptTransport(key, value);
    }

    /** AES-256-GCM 加密（空值原样返回）。 */
    public String encryptAtRest(String plain) {
        if (plain == null || plain.isEmpty()) {
            return plain;
        }
        try {
            byte[] iv = new byte[IV_LEN];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, aesKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return ENC_PREFIX + Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("AES 加密失败", e);
        }
    }

    /** AES-256-GCM 解密；非 enc:v1: 前缀视为历史明文原样返回。 */
    public String decryptAtRest(String stored) {
        if (!isEncrypted(stored)) {
            return stored;
        }
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(ENC_PREFIX.length()));
            byte[] iv = new byte[IV_LEN];
            System.arraycopy(all, 0, iv, 0, IV_LEN);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, aesKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] plain = cipher.doFinal(all, IV_LEN, all.length - IV_LEN);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("AES 解密失败（stored={}）", prefixHint(stored));
            throw new IllegalStateException("敏感配置解密失败，请在后端重新保存该配置项", e);
        }
    }

    /** 解密 RSA 传输密文；非 rsa:v1: 前缀原样返回。 */
    public String decryptTransport(String key, String payload) {
        if (payload == null || payload.isEmpty()) {
            return payload;
        }
        if (!isRsaCipher(payload)) {
            return payload;
        }
        try {
            byte[] data = Base64.getDecoder().decode(payload.substring(RSA_PREFIX.length()));
            Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            cipher.init(Cipher.DECRYPT_MODE, rsaKeyPair.getPrivate());
            byte[] plain = cipher.doFinal(data);
            String text = new String(plain, StandardCharsets.UTF_8);
            if (text.length() > 4096) {
                log.warn("解密出的敏感值异常过长（key={}, len={}）", key, text.length());
            }
            return text;
        } catch (Exception e) {
            log.error("RSA 解密失败（key={}）", key);
            throw new IllegalStateException("加密传输值解析失败，请刷新页面后重试", e);
        }
    }

    /** 导出 RSA 公钥（DER SPKI，Base64 编码），供前端 WebCrypto 导入。 */
    public String publicKeyBase64() {
        try {
            byte[] der = rsaKeyPair.getPublic().getEncoded();
            return Base64.getEncoder().encodeToString(der);
        } catch (Exception e) {
            throw new IllegalStateException("导出 RSA 公钥失败", e);
        }
    }

    private String prefixHint(String value) {
        if (value == null) return "null";
        return value.length() <= 32 ? value : value.substring(0, 32) + "...";
    }
}
