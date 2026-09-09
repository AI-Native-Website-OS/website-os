package com.sinounion.security;

import org.springframework.beans.factory.annotation.Value;
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

    /**
     * 是否信任反向代理透传的 X-Real-IP / X-Forwarded-For 头。
     * 浏览器直连后端端口（nginx 不透传任何 IP 头）时应为 false，仅信任 TCP 连接真实来源 IP。
     */
    @Value("${app.trust-proxy-ip-header:true}")
    private boolean trustProxyIpHeader;

    public LoginRateLimiter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
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
        if (!trustProxyIpHeader) {
            return request.getRemoteAddr();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isEmpty() && !"unknown".equalsIgnoreCase(realIp)) {
            return realIp;
        }
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null || xfHeader.isEmpty()) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0].trim();
    }
}
