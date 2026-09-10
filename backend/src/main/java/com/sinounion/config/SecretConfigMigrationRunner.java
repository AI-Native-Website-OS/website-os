package com.sinounion.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import com.sinounion.util.SensitiveKeys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 存量敏感明文迁移：启动时将 system_configs 表中历史明文敏感值就地加密为 enc:v1:。
 *
 * 仅在 AES 密钥可持久化（非一次性内存密钥）时执行，避免重启后无法解密。
 */
@Slf4j
@Component
@Order(999)
@RequiredArgsConstructor
public class SecretConfigMigrationRunner implements ApplicationRunner {

    private final SystemConfigMapper systemConfigMapper;
    private final SecretCryptoService secretCryptoService;

    @Override
    public void run(ApplicationArguments args) {
        if (secretCryptoService.isAesKeyEphemeral()) {
            return;
        }
        try {
            List<SystemConfig> all = systemConfigMapper.selectList(new LambdaQueryWrapper<>());
            int migrated = 0;
            for (SystemConfig c : all) {
                String key = c.getConfigKey();
                String value = c.getConfigValue();
                if (!secretCryptoService.isSensitive(key)) {
                    continue;
                }
                if (value == null || value.isEmpty() || SensitiveKeys.MASK.equals(value)) {
                    continue;
                }
                if (secretCryptoService.isEncrypted(value)) {
                    continue;
                }
                c.setConfigValue(secretCryptoService.encryptAtRest(value));
                systemConfigMapper.updateById(c);
                migrated++;
                log.info("存量敏感配置已加密落盘: {}", key);
            }
            if (migrated > 0) {
                log.info("敏感配置明文迁移完成，共 {} 项", migrated);
            }
        } catch (Exception e) {
            log.warn("敏感配置明文迁移跳过（可能表尚未初始化）：{}", e.getMessage());
        }
    }
}
