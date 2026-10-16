package com.sinounion.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WebUtilsTest {

    @Test
    void normalizeIpv4KeepsSingleAddress() {
        assertEquals("203.0.113.9", WebUtils.normalizeClientIp("203.0.113.9"));
        assertEquals("203.0.113.9", WebUtils.normalizeClientIp("  203.0.113.9  "));
        assertEquals("203.0.113.9", WebUtils.normalizeClientIp("\"203.0.113.9\""));
    }

    @Test
    void normalizeStripsIpv4Port() {
        assertEquals("203.0.113.9", WebUtils.normalizeClientIp("203.0.113.9:54321"));
    }

    @Test
    void normalizeIpv6Variants() {
        assertEquals("::1", WebUtils.normalizeClientIp("::1"));
        assertEquals("::1", WebUtils.normalizeClientIp("[::1]"));
        assertEquals("::1", WebUtils.normalizeClientIp("[::1]:443"));
        assertEquals("2001:db8::1", WebUtils.normalizeClientIp("2001:db8::1"));
        assertEquals("::ffff:203.0.113.9", WebUtils.normalizeClientIp("::ffff:203.0.113.9"));
        assertEquals("fe80::1", WebUtils.normalizeClientIp("fe80::1%eth0"));
    }

    @Test
    void normalizeRejectsBlankUnknownAndInvalid() {
        assertNull(WebUtils.normalizeClientIp(null));
        assertNull(WebUtils.normalizeClientIp(""));
        assertNull(WebUtils.normalizeClientIp("   "));
        assertNull(WebUtils.normalizeClientIp("unknown"));
        assertNull(WebUtils.normalizeClientIp("null"));
        assertNull(WebUtils.normalizeClientIp("abc"));
        assertNull(WebUtils.normalizeClientIp("999.1.1.1"));
        assertNull(WebUtils.normalizeClientIp("1.2.3"));
        assertNull(WebUtils.normalizeClientIp("1.2.3.4:notaport"));
        assertNull(WebUtils.normalizeClientIp("203.0.113.9:"));
    }

    @Test
    void normalizeRejectsWholeProxyChain() {
        assertNull(WebUtils.normalizeClientIp("203.0.113.9, 198.51.100.7"));
        assertNull(WebUtils.normalizeClientIp("203.0.113.9,198.51.100.7,192.0.2.1"));
    }

    @Test
    void ipv4Validation() {
        assertTrue(WebUtils.isValidIpv4("0.0.0.0"));
        assertTrue(WebUtils.isValidIpv4("255.255.255.255"));
        assertFalse(WebUtils.isValidIpv4("256.1.1.1"));
        assertFalse(WebUtils.isValidIpv4("1.2.3.4.5"));
        assertFalse(WebUtils.isValidIpv4("1.2.3"));
        assertFalse(WebUtils.isValidIpv4("1.2.3.a"));
    }

    @Test
    void ipv6Validation() {
        assertTrue(WebUtils.isValidIpv6("::1"));
        assertTrue(WebUtils.isValidIpv6("::"));
        assertTrue(WebUtils.isValidIpv6("2001:db8::1"));
        assertTrue(WebUtils.isValidIpv6("2001:0db8:85a3:0000:0000:8a2e:0370:7334"));
        assertTrue(WebUtils.isValidIpv6("2001:db8:85a3::8a2e:370:7334"));
        assertTrue(WebUtils.isValidIpv6("::ffff:192.168.1.1"));
        assertTrue(WebUtils.isValidIpv6("1:2:3:4:5:6:1.2.3.4"));
        assertFalse(WebUtils.isValidIpv6(":::1"));
        assertFalse(WebUtils.isValidIpv6("1::2::3"));
        assertFalse(WebUtils.isValidIpv6("1:2:3:4:5:6:7:8:9"));
        assertFalse(WebUtils.isValidIpv6("12345::"));
        assertFalse(WebUtils.isValidIpv6("gggg::"));
        assertFalse(WebUtils.isValidIpv6("1.2.3.4::"));
        assertFalse(WebUtils.isValidIpv6("1.2.3.4"));
    }

    @Test
    void isPrivateOrLoopbackClassification() {
        assertTrue(WebUtils.isPrivateOrLoopback("127.0.0.1"));
        assertTrue(WebUtils.isPrivateOrLoopback("::1"));
        assertTrue(WebUtils.isPrivateOrLoopback("10.1.2.3"));
        assertTrue(WebUtils.isPrivateOrLoopback("172.16.0.1"));
        assertTrue(WebUtils.isPrivateOrLoopback("172.31.255.255"));
        assertTrue(WebUtils.isPrivateOrLoopback("192.168.1.1"));
        assertTrue(WebUtils.isPrivateOrLoopback("169.254.1.1"));
        assertTrue(WebUtils.isPrivateOrLoopback("100.64.0.1"));
        assertTrue(WebUtils.isPrivateOrLoopback("0.0.0.0"));
        assertTrue(WebUtils.isPrivateOrLoopback("fe80::1"));
        assertTrue(WebUtils.isPrivateOrLoopback("fd12:3456::1"));
        assertTrue(WebUtils.isPrivateOrLoopback("::ffff:192.168.1.1"));
        assertTrue(WebUtils.isPrivateOrLoopback(null));
        assertTrue(WebUtils.isPrivateOrLoopback(""));
        assertTrue(WebUtils.isPrivateOrLoopback("not-an-ip"));

        assertFalse(WebUtils.isPrivateOrLoopback("8.8.8.8"));
        assertFalse(WebUtils.isPrivateOrLoopback("1.1.1.1"));
        assertFalse(WebUtils.isPrivateOrLoopback("172.32.0.1"));
        assertFalse(WebUtils.isPrivateOrLoopback("203.0.113.77"));
        assertFalse(WebUtils.isPrivateOrLoopback("2001:4860:4860::8888"));
    }

    @Test
    void ipToBytesLengths() {
        assertArrayEquals(new byte[]{127, 0, 0, 1}, WebUtils.ipToBytes("127.0.0.1"));
        assertEquals(16, WebUtils.ipToBytes("::1").length);
        assertNull(WebUtils.ipToBytes("not-an-ip"));
    }

    @Test
    void cidrMatching() {
        assertTrue(WebUtils.inCidr(WebUtils.ipToBytes("10.1.2.3"), WebUtils.ipToBytes("10.0.0.0"), 8));
        assertFalse(WebUtils.inCidr(WebUtils.ipToBytes("11.1.2.3"), WebUtils.ipToBytes("10.0.0.0"), 8));
        assertTrue(WebUtils.inCidr(WebUtils.ipToBytes("172.28.5.5"), WebUtils.ipToBytes("172.28.0.0"), 16));
        assertTrue(WebUtils.inCidr(WebUtils.ipToBytes("192.168.1.1"), WebUtils.ipToBytes("192.168.1.1"), 32));
        assertTrue(WebUtils.inCidr(WebUtils.ipToBytes("2001:db8::5"), WebUtils.ipToBytes("2001:db8::"), 32));
        assertFalse(WebUtils.inCidr(WebUtils.ipToBytes("2001:dead::5"), WebUtils.ipToBytes("2001:db8::"), 32));
        // 家族不一致不应匹配
        assertFalse(WebUtils.inCidr(WebUtils.ipToBytes("10.0.0.1"), WebUtils.ipToBytes("::"), 0));
    }
}
