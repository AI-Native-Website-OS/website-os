package com.sinounion.util;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SystemDnsTest {

    // 使用 RFC 5737 文档保留地址作为测试夹具（非任何真实部署地址）
    private static final String DNS_A = "198.51.100.10";
    private static final String DNS_B = "203.0.113.20";

    @Test
    void parsesResolvConfNameservers() {
        String conf = "# comment\n"
                + "nameserver " + DNS_A + "\n"
                + "nameserver 127.0.0.11\n"
                + "search example.com\n";
        List<String> servers = SystemDns.parseResolvConf(conf);
        assertEquals(2, servers.size());
        assertEquals(DNS_A, servers.get(0));
        assertEquals("127.0.0.11", servers.get(1));
    }

    @Test
    void parsesWindowsIpconfigEnglishAndContinuation() {
        String out = "   DNS Servers . . . . . . . . . . . : " + DNS_A + "\n"
                + "                                       " + DNS_B + "\n"
                + "   NetBIOS over Tcpip. . . . . . . . : Enabled\n";
        List<String> servers = SystemDns.parseWindowsIpconfig(out);
        assertEquals(2, servers.size());
        assertEquals(DNS_A, servers.get(0));
        assertEquals(DNS_B, servers.get(1));
    }

    @Test
    void parsesWindowsIpconfigChineseLabel() {
        String out = "   DNS 服务器  . . . . . . . . . . . : " + DNS_A + "\n"
                + "                                       " + DNS_B + "\n"
                + "   TCPIP 上的 NetBIOS  . . . . . . . : 已启用\n";
        List<String> servers = SystemDns.parseWindowsIpconfig(out);
        assertEquals(2, servers.size());
        assertEquals(DNS_A, servers.get(0));
        assertEquals(DNS_B, servers.get(1));
    }

    @Test
    void ignoresIpv6ZoneAndNonIpContent() {
        List<String> servers = SystemDns.parseResolvConf(
                "nameserver fe80::1%eth0\nnameserver not-an-ip\n");
        assertEquals(1, servers.size());
        assertTrue(servers.get(0).startsWith("fe80::1"));
    }
}
