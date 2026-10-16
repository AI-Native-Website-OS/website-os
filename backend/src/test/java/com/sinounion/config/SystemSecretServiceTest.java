package com.sinounion.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemSecretServiceTest {

    @Mock
    JdbcTemplate jdbcTemplate;

    @Test
    void reusesExistingSecretsFromTable() {
        Map<String, String> existing = new HashMap<>();
        existing.put("JWT_SECRET", "jwt-existing");
        existing.put("AI_INTERNAL_TOKEN", "token-existing");
        existing.put("CONFIG_CRYPTO_AES_KEY", "aes-existing");
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), any()))
                .thenAnswer(inv -> {
                    String key = inv.getArgument(2);
                    return existing.containsKey(key)
                            ? Collections.singletonList(existing.get(key))
                            : Collections.<String>emptyList();
                });

        SystemSecretService service = new SystemSecretService(jdbcTemplate);
        service.init();

        assertEquals("jwt-existing", service.getJwtSecret());
        assertEquals("token-existing", service.getInternalToken());
        assertEquals("aes-existing", service.getAesKey());
        assertFalse(service.isAesKeyEphemeral());
        verify(jdbcTemplate, never()).update(anyString(), any(), any(), any());
    }

    @Test
    void generatesAndPersistsWhenMissing() {
        Map<String, String> db = new HashMap<>();
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), any()))
                .thenAnswer(inv -> {
                    String key = inv.getArgument(2);
                    return db.containsKey(key)
                            ? Collections.singletonList(db.get(key))
                            : Collections.<String>emptyList();
                });
        when(jdbcTemplate.update(anyString(), any(), any(), any()))
                .thenAnswer(inv -> {
                    Object[] args = inv.getArguments();
                    db.put(String.valueOf(args[1]), String.valueOf(args[2]));
                    return 1;
                });

        SystemSecretService service = new SystemSecretService(jdbcTemplate);
        service.init();

        assertNotNull(service.getJwtSecret());
        assertFalse(service.getJwtSecret().isEmpty());
        assertEquals(db.get("JWT_SECRET"), service.getJwtSecret());
        assertEquals(db.get("AI_INTERNAL_TOKEN"), service.getInternalToken());
        assertEquals(db.get("CONFIG_CRYPTO_AES_KEY"), service.getAesKey());
        assertNotEquals(service.getJwtSecret(), service.getInternalToken());
        assertNotEquals(service.getJwtSecret(), service.getAesKey());
    }
}
