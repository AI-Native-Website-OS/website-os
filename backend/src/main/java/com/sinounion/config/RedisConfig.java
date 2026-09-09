package com.sinounion.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
@EnableCaching
public class RedisConfig {

    @Value("${spring.redis.host:localhost}")
    private String host;

    @Value("${spring.redis.port:6379}")
    private String portStr;

    @Value("${spring.redis.password:}")
    private String password;

    @Value("${spring.redis.database:0}")
    private String databaseStr;

    @Bean
    public LettuceConnectionFactory redisConnectionFactory() {
        String h = host;
        if (h == null || h.trim().isEmpty()) {
            h = "localhost";
        }

        int p = 6379;
        if (portStr != null && !portStr.trim().isEmpty()) {
            try {
                p = Integer.parseInt(portStr.trim());
            } catch (NumberFormatException ignored) {
            }
        }

        int db = 0;
        if (databaseStr != null && !databaseStr.trim().isEmpty()) {
            try {
                db = Integer.parseInt(databaseStr.trim());
            } catch (NumberFormatException ignored) {
            }
        }

        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration();
        config.setHostName(h);
        config.setPort(p);
        config.setDatabase(db);

        if (password != null && !password.trim().isEmpty()) {
            config.setPassword(org.springframework.data.redis.connection.RedisPassword.of(password));
        }

        return new LettuceConnectionFactory(config);
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }
}
