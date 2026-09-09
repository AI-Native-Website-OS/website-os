package com.sinounion.utils;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilsTest {

    private JwtUtils jwtUtils;

    @BeforeEach
    void setUp() {
        jwtUtils = new JwtUtils();
        ReflectionTestUtils.setField(jwtUtils, "secret", "test-secret-key-which-is-at-least-256-bits-long-for-hs512");
        ReflectionTestUtils.setField(jwtUtils, "expiration", 3600000L);
    }

    @Test
    void generateTokenCreatesValidToken() {
        String token = jwtUtils.generateToken(1L, "admin", "SUPER_ADMIN");
        assertNotNull(token);
        assertTrue(token.split("\\.").length == 3);
    }

    @Test
    void parseTokenReturnsCorrectClaims() {
        String token = jwtUtils.generateToken(42L, "testuser", "NORMAL_USER");
        Claims claims = jwtUtils.parseToken(token);
        assertEquals("testuser", claims.getSubject());
        assertEquals(42, claims.get("userId"));
        assertEquals("NORMAL_USER", claims.get("role"));
    }

    @Test
    void getUserIdReturnsCorrectValue() {
        String token = jwtUtils.generateToken(99L, "user99", "VISITOR");
        assertEquals(99L, jwtUtils.getUserId(token));
    }

    @Test
    void getUsernameReturnsCorrectValue() {
        String token = jwtUtils.generateToken(1L, "admin", "SUPER_ADMIN");
        assertEquals("admin", jwtUtils.getUsername(token));
    }

    @Test
    void getRoleReturnsCorrectValue() {
        String token = jwtUtils.generateToken(1L, "admin", "SUPER_ADMIN");
        assertEquals("SUPER_ADMIN", jwtUtils.getRole(token));
    }

    @Test
    void validateTokenReturnsTrueForValidToken() {
        String token = jwtUtils.generateToken(1L, "user", "NORMAL_USER");
        assertTrue(jwtUtils.validateToken(token));
    }

    @Test
    void validateTokenReturnsFalseForInvalidToken() {
        assertFalse(jwtUtils.validateToken("invalid.token.here"));
    }

    @Test
    void validateTokenReturnsFalseForExpiredToken() throws Exception {
        ReflectionTestUtils.setField(jwtUtils, "expiration", -1000L);
        String token = jwtUtils.generateToken(1L, "user", "NORMAL_USER");
        Thread.sleep(100);
        assertFalse(jwtUtils.validateToken(token));
    }
}
