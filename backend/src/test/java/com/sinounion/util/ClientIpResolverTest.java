package com.sinounion.util;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ClientIpResolverTest {

    private final ClientIpResolver resolver = new ClientIpResolver();

    private static MockHttpServletRequest request(String remoteAddr) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr(remoteAddr);
        return req;
    }

    @Test
    void usesRealIpHeaderWhenPresent() {
        MockHttpServletRequest req = request("10.0.0.1");
        req.addHeader("X-Real-IP", "203.0.113.5");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void fallsBackToRemoteAddrWhenHeaderMissing() {
        assertEquals("203.0.113.9", resolver.resolve(request("203.0.113.9")));
    }

    @Test
    void fallsBackToRemoteAddrWhenHeaderBlank() {
        MockHttpServletRequest req = request("203.0.113.9");
        req.addHeader("X-Real-IP", "  ");
        assertEquals("203.0.113.9", resolver.resolve(req));
    }

    @Test
    void fallsBackToRemoteAddrWhenHeaderInvalid() {
        MockHttpServletRequest req = request("203.0.113.9");
        req.addHeader("X-Real-IP", "not-an-ip");
        assertEquals("203.0.113.9", resolver.resolve(req));
    }

    @Test
    void realIpWithPortIsNormalized() {
        MockHttpServletRequest req = request("10.0.0.1");
        req.addHeader("X-Real-IP", "203.0.113.5:41234");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void ipv6RealIpIsPreserved() {
        MockHttpServletRequest req = request("10.0.0.1");
        req.addHeader("X-Real-IP", "2001:db8:aaaa::5");
        assertEquals("2001:db8:aaaa::5", resolver.resolve(req));
    }

    @Test
    void nullRequestReturnsNull() {
        assertNull(resolver.resolve(null));
    }
}
