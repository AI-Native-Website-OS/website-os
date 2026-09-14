package com.sinounion.util;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * 敏感配置项统一识别。
 *
 * 覆盖两类来源：
 *   1. system_configs 表中的 key（如 sms_access_key_secret）；
 *   2. 管理后台 env-configs 接口受管的环境变量（如 LLM_API_KEY、PG_PASSWORD、JWT_SECRET 等）。
 *
 * 敏感项遵循统一安全策略：GET 不回显明文（返回掩码占位）、传输用 RSA 加密、
 * 写入 system_configs 时用 AES 加密落盘、前端仅可覆盖修改不可回看旧值。
 */
public final class SensitiveKeys {

    private SensitiveKeys() {}

    /** 已配置但不下发明文时，返回的掩码占位符。 */
    public static final String MASK = "******";

    /** 命名不完全符合通用后缀规则、需精确匹配的敏感 key。 */
    private static final Set<String> EXACT = new HashSet<>(Arrays.asList(
        "sms_access_key_secret",
        "JWT_SECRET",
        "SPRING_DATASOURCE_PASSWORD",
        "PG_PASSWORD",
        "SPRING_REDIS_PASSWORD",
        "REDIS_PASSWORD"
    ));

    /** 判断一个配置 key 是否属于敏感项。 */
    public static boolean isSensitive(String key) {
        if (key == null || key.isEmpty()) {
            return false;
        }
        if (EXACT.contains(key)) {
            return true;
        }
        String upper = key.toUpperCase(Locale.ROOT);
        return upper.endsWith("_API_KEY")
            || upper.endsWith("_SECRET")
            || upper.endsWith("_PASSWORD");
    }
}
