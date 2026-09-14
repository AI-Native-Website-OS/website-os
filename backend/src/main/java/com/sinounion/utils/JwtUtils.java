package com.sinounion.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtils {

    @Value("${JWT_SECRET}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    @Value("${jwt.refresh-expiration:604800000}")
    private Long refreshExpiration;

    public String generateToken(Long userId, String username, String role, Integer tokenVersion) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("username", username);
        claims.put("role", role);
        claims.put("tokenVersion", tokenVersion != null ? tokenVersion : 0);
        return createToken(claims, username, expiration);
    }

    /** 生成长效刷新令牌（type=refresh），用于前端过期后静默续期。 */
    public String generateRefreshToken(Long userId, String username, String role, Integer tokenVersion) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("username", username);
        claims.put("role", role);
        claims.put("tokenVersion", tokenVersion != null ? tokenVersion : 0);
        claims.put("type", "refresh");
        return createToken(claims, username, refreshExpiration);
    }

    /** 读取令牌中的自定义声明（type 等）；解析失败返回 null。 */
    public String getClaim(String token, String claim) {
        try {
            return parseToken(token).get(claim, String.class);
        } catch (Exception e) {
            return null;
        }
    }

    public String generateToken(Long userId, String username, String role) {
        return generateToken(userId, username, role, 0);
    }

    private String createToken(Map<String, Object> claims, String subject, long exp) {
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + exp))
                .signWith(SignatureAlgorithm.HS512, secret)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .setSigningKey(secret)
                .parseClaimsJws(token)
                .getBody();
    }

    public Long getUserId(String token) {
        Claims claims = parseToken(token);
        return claims.get("userId", Long.class);
    }

    public String getUsername(String token) {
        Claims claims = parseToken(token);
        return claims.getSubject();
    }

    public String getRole(String token) {
        Claims claims = parseToken(token);
        return claims.get("role", String.class);
    }

    public Integer getTokenVersion(String token) {
        Claims claims = parseToken(token);
        return claims.get("tokenVersion", Integer.class);
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
