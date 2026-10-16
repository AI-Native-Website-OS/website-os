package com.sinounion.util;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClientIpResolverTest {

    private static final String LOOPBACK = "127.0.0.0/8,::1/128";
    private static final String MULTI = "127.0.0.0/8,::1/128,10.0.0.0/8";
    private static final String V6_PROXY = "127.0.0.0/8,::1/128,2001:db8::/32";

    private static MockHttpServletRequest request(String remoteAddr) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr(remoteAddr);
        return req;
    }

    /** 仅按 CIDR 配置构造，禁用主机名解析（避免测试触发 DNS）。 */
    private static ClientIpResolver resolver(String cidrs) {
        return new ClientIpResolver(cidrs, "");
    }

    @Test
    void directAccessUsesTcpSourceAddress() {
        ClientIpResolver resolver = resolver(LOOPBACK);
        MockHttpServletRequest req = request("203.0.113.9");
        assertEquals("203.0.113.9", resolver.resolve(req));
    }

    @Test
    void localhostAccessKeepsLoopback() {
        ClientIpResolver resolver = resolver(LOOPBACK);
        assertEquals("127.0.0.1", resolver.resolve(request("127.0.0.1")));
        assertEquals("::1", resolver.resolve(request("::1")));
        // 未压缩写法原样保留（等价于 ::1，属正常回环）
        assertEquals("0:0:0:0:0:0:0:1", resolver.resolve(request("0:0:0:0:0:0:0:1")));
    }

    @Test
    void untrustedPeerCannotSpoofForwardingHeaders() {
        ClientIpResolver resolver = resolver(LOOPBACK);
        MockHttpServletRequest req = request("203.0.113.9");
        req.addHeader("X-Forwarded-For", "1.2.3.4");
        req.addHeader("X-Real-IP", "5.6.7.8");
        assertEquals("203.0.113.9", resolver.resolve(req));
    }

    @Test
    void trustedProxySingleForwardedIp() {
        ClientIpResolver resolver = resolver(LOOPBACK);
        MockHttpServletRequest req = request("127.0.0.1");
        req.addHeader("X-Forwarded-For", "203.0.113.5");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void trustedProxyRealIpOnly() {
        ClientIpResolver resolver = resolver(LOOPBACK);
        MockHttpServletRequest req = request("127.0.0.1");
        req.addHeader("X-Real-IP", "203.0.113.5");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void multiLevelTrustedProxiesResolveOriginalClient() {
        ClientIpResolver resolver = resolver(MULTI);
        MockHttpServletRequest req = request("127.0.0.1");
        req.addHeader("X-Forwarded-For", "203.0.113.5, 10.0.0.9");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void spoofedLeftEntryBehindTrustedProxyIsIgnored() {
        ClientIpResolver resolver = resolver(LOOPBACK);
        MockHttpServletRequest req = request("127.0.0.1");
        // 客户端伪造 1.2.3.4，nginx 追加真实客户端 203.0.113.5
        req.addHeader("X-Forwarded-For", "1.2.3.4, 203.0.113.5");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void blankUnknownAndInvalidForwardedValuesFallBackToPeer() {
        ClientIpResolver resolver = resolver(LOOPBACK);
        MockHttpServletRequest req = request("127.0.0.1");
        req.addHeader("X-Forwarded-For", "  , unknown ");
        req.addHeader("X-Real-IP", "not-an-ip");
        assertEquals("127.0.0.1", resolver.resolve(req));
    }

    @Test
    void forwardedValueWithPortIsNormalized() {
        ClientIpResolver resolver = resolver(LOOPBACK);
        MockHttpServletRequest req = request("127.0.0.1");
        req.addHeader("X-Forwarded-For", "203.0.113.5:41234");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void ipv6ClientBehindTrustedV6Proxy() {
        ClientIpResolver resolver = resolver(V6_PROXY);
        MockHttpServletRequest req = request("2001:db8::9");
        req.addHeader("X-Forwarded-For", "2001:db8:aaaa::5");
        assertEquals("2001:db8:aaaa::5", resolver.resolve(req));
    }

    @Test
    void malformedEntriesAreDroppedNotStored() {
        ClientIpResolver resolver = resolver(LOOPBACK);
        MockHttpServletRequest req = request("127.0.0.1");
        req.addHeader("X-Forwarded-For", "garbage, 203.0.113.5");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void multipleForwardedHeadersAreCombined() {
        ClientIpResolver resolver = resolver(MULTI);
        MockHttpServletRequest req = request("127.0.0.1");
        req.addHeader("X-Forwarded-For", "203.0.113.5");
        req.addHeader("X-Forwarded-For", "10.0.0.9");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void allTrustedChainReturnsLeftmost() {
        ClientIpResolver resolver = resolver(MULTI);
        MockHttpServletRequest req = request("127.0.0.1");
        req.addHeader("X-Forwarded-For", "10.0.0.5, 10.0.0.6");
        assertEquals("10.0.0.5", resolver.resolve(req));
    }

    @Test
    void catchAllTrustedRangeIsRejected() {
        ClientIpResolver resolver = resolver("0.0.0.0/0");
        assertFalse(resolver.isTrusted("203.0.113.9"));
        MockHttpServletRequest req = request("203.0.113.9");
        req.addHeader("X-Forwarded-For", "1.2.3.4");
        assertEquals("203.0.113.9", resolver.resolve(req));
    }

    @Test
    void invalidTrustedEntriesAreIgnored() {
        ClientIpResolver resolver = resolver("not-an-ip, 10.0.0.0/8, 10.0.0.0/99");
        assertTrue(resolver.isTrusted("10.1.1.1"));
        assertFalse(resolver.isTrusted("192.168.1.1"));
    }

    @Test
    void emptyTrustedConfigTrustsNothing() {
        ClientIpResolver resolver = resolver("");
        MockHttpServletRequest req = request("203.0.113.9");
        req.addHeader("X-Forwarded-For", "1.2.3.4");
        assertEquals("203.0.113.9", resolver.resolve(req));
    }

    @Test
    void trustedProxyHostIsResolvedAndTrusted() {
        // 模拟项目自带代理：主机名解析为回环地址但不使用默认回环 CIDR，仅靠主机名信任
        ClientIpResolver resolver = new ClientIpResolver("", "localhost");
        assertTrue(resolver.isTrusted("127.0.0.1"));
        MockHttpServletRequest req = request("127.0.0.1");
        req.addHeader("X-Forwarded-For", "203.0.113.5");
        assertEquals("203.0.113.5", resolver.resolve(req));
    }

    @Test
    void unknownTrustedProxyHostTrustsNothing() {
        ClientIpResolver resolver = new ClientIpResolver("", "no-such-proxy-host.invalid");
        assertFalse(resolver.isTrusted("203.0.113.9"));
        MockHttpServletRequest req = request("203.0.113.9");
        req.addHeader("X-Forwarded-For", "1.2.3.4");
        assertEquals("203.0.113.9", resolver.resolve(req));
    }
}
