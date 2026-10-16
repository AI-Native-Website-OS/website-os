package com.sinounion.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

/**
 * 启动引导密钥服务：JWT 签名密钥、服务间内部令牌、敏感配置落盘 AES 密钥。
 *
 * 这三个密钥由后端启动时自动生成并持久化到 system_secrets 表（明文，仅内部读取），
 * Java 后端与 Python AI 服务从该表读取同一份值，不再通过 .env 配置。
 * 后端是唯一写入方；已存在的密钥始终复用，保证重启后令牌与存量密文仍可校验/解密。
 */
@Slf4j
@Component
@DependsOn("databaseInitializer")
public class SystemSecretService {

    public static final String JWT_SECRET = "JWT_SECRET";
    public static final String AI_INTERNAL_TOKEN = "AI_INTERNAL_TOKEN";
    public static final String CONFIG_CRYPTO_AES_KEY = "CONFIG_CRYPTO_AES_KEY";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final JdbcTemplate jdbcTemplate;

    private volatile String jwtSecret;
    private volatile String internalToken;
    private volatile String aesKey;
    /** AES 密钥生成后写库失败时为 true：此时不执行存量明文加密迁移，避免重启后无法解密。 */
    private volatile boolean aesKeyEphemeral;

    public SystemSecretService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void init() {
        ensureTable();
        jwtSecret = getOrCreate(JWT_SECRET, () -> randomBase64(64), "JWT 签名密钥（启动自动生成）");
        internalToken = getOrCreate(AI_INTERNAL_TOKEN, () -> randomBase64(48), "后端→AI 服务内部调用令牌（启动自动生成）");
        initAesKey();
        log.info("引导密钥已就绪（来源：system_secrets 表）");
    }

    private void ensureTable() {
        try {
            jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS system_secrets ("
                    + "id BIGSERIAL PRIMARY KEY,"
                    + "secret_key VARCHAR(64) NOT NULL UNIQUE,"
                    + "secret_value TEXT NOT NULL,"
                    + "description VARCHAR(255),"
                    + "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                    + "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        } catch (Exception e) {
            throw new IllegalStateException("初始化 system_secrets 表失败", e);
        }
    }

    private String getOrCreate(String key, java.util.function.Supplier<String> generator, String description) {
        String existing = read(key);
        if (existing != null && !existing.isEmpty()) {
            return existing;
        }
        String candidate = generator.get();
        try {
            jdbcTemplate.update(
                "INSERT INTO system_secrets (secret_key, secret_value, description) VALUES (?, ?, ?)"
                    + " ON CONFLICT (secret_key) DO NOTHING",
                key, candidate, description);
        } catch (Exception e) {
            throw new IllegalStateException("持久化引导密钥失败: " + key, e);
        }
        String stored = read(key);
        if (stored == null || stored.isEmpty()) {
            throw new IllegalStateException("引导密钥写入后读取为空: " + key);
        }
        log.warn("引导密钥 {} 缺失，已自动生成并写入 system_secrets；请妥善备份该表", key);
        return stored;
    }

    private void initAesKey() {
        String existing = read(CONFIG_CRYPTO_AES_KEY);
        if (existing != null && !existing.isEmpty()) {
            aesKey = existing;
            return;
        }
        String candidate = randomBase64(32);
        try {
            jdbcTemplate.update(
                "INSERT INTO system_secrets (secret_key, secret_value, description) VALUES (?, ?, ?)"
                    + " ON CONFLICT (secret_key) DO NOTHING",
                CONFIG_CRYPTO_AES_KEY, candidate, "敏感配置落盘 AES 密钥（启动自动生成）");
            String stored = read(CONFIG_CRYPTO_AES_KEY);
            aesKey = (stored != null && !stored.isEmpty()) ? stored : candidate;
            log.warn("CONFIG_CRYPTO_AES_KEY 缺失，已自动生成并写入 system_secrets；"
                + "存量 enc:v1: 密文如使用旧密钥将无法解密，需在后端重新保存相关配置项");
        } catch (Exception e) {
            aesKey = candidate;
            aesKeyEphemeral = true;
            log.error("CONFIG_CRYPTO_AES_KEY 生成后写库失败，当前使用一次性内存密钥，"
                + "重启后存量密文将无法解密，已跳过存量数据加密迁移", e);
        }
    }

    private String read(String key) {
        try {
            List<String> values = jdbcTemplate.queryForList(
                "SELECT secret_value FROM system_secrets WHERE secret_key = ?", String.class, key);
            return values.isEmpty() ? null : values.get(0);
        } catch (Exception e) {
            log.warn("读取引导密钥失败: {}（{}）", key, e.getMessage());
            return null;
        }
    }

    private static String randomBase64(int byteLength) {
        byte[] buf = new byte[byteLength];
        SECURE_RANDOM.nextBytes(buf);
        return Base64.getEncoder().encodeToString(buf);
    }

    public String getJwtSecret() {
        return jwtSecret;
    }

    public String getInternalToken() {
        return internalToken;
    }

    public String getAesKey() {
        return aesKey;
    }

    public boolean isAesKeyEphemeral() {
        return aesKeyEphemeral;
    }
}
