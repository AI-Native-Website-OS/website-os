package com.sinounion.security;

import com.sinounion.util.ClientIpResolver;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import java.util.concurrent.TimeUnit;

@Component
public class LoginRateLimiter {

    private static final String KEY_PREFIX = "login:attempt:";
    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCK_DURATION_MINUTES = 15;
    private static final long WINDOW_MINUTES = 15;

    private final StringRedisTemplate redisTemplate;
    private final ClientIpResolver clientIpResolver;

    public LoginRateLimiter(StringRedisTemplate redisTemplate, ClientIpResolver clientIpResolver) {
        this.redisTemplate = redisTemplate;
        this.clientIpResolver = clientIpResolver;
    }

    public boolean isBlocked(String username, HttpServletRequest request) {
        String ip = getClientIP(request);
        String ipKey = KEY_PREFIX + "ip:" + ip;
        String userKey = KEY_PREFIX + "user:" + username;

        String ipBlocked = redisTemplate.opsForValue().get(ipKey + ":blocked");
        String userBlocked = redisTemplate.opsForValue().get(userKey + ":blocked");

        return ipBlocked != null || userBlocked != null;
    }

    public void recordFailure(String username, HttpServletRequest request) {
        String ip = getClientIP(request);
        String ipKey = KEY_PREFIX + "ip:" + ip;
        String userKey = KEY_PREFIX + "user:" + username;

        long ipCount = redisTemplate.opsForValue().increment(ipKey, 1);
        if (ipCount == 1) {
            redisTemplate.expire(ipKey, WINDOW_MINUTES, TimeUnit.MINUTES);
        }

        long userCount = redisTemplate.opsForValue().increment(userKey, 1);
        if (userCount == 1) {
            redisTemplate.expire(userKey, WINDOW_MINUTES, TimeUnit.MINUTES);
        }

        if (ipCount >= MAX_ATTEMPTS) {
            redisTemplate.opsForValue().set(ipKey + ":blocked", "1", LOCK_DURATION_MINUTES, TimeUnit.MINUTES);
        }
        if (userCount >= MAX_ATTEMPTS) {
            redisTemplate.opsForValue().set(userKey + ":blocked", "1", LOCK_DURATION_MINUTES, TimeUnit.MINUTES);
        }
    }

    public void resetSuccess(String username, HttpServletRequest request) {
        String ip = getClientIP(request);
        redisTemplate.delete(KEY_PREFIX + "ip:" + ip);
        redisTemplate.delete(KEY_PREFIX + "ip:" + ip + ":blocked");
        redisTemplate.delete(KEY_PREFIX + "user:" + username);
        redisTemplate.delete(KEY_PREFIX + "user:" + username + ":blocked");
    }

    private String getClientIP(HttpServletRequest request) {
        return clientIpResolver.resolve(request);
    }
}
