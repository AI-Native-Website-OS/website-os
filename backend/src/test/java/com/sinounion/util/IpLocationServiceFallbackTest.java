package com.sinounion.util;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * 验证私网/回环客户端归属地兜底：使用本机 HttpServer 模拟「出口公网 IP 探测」与「在线 IP 归属地」，
 * 不依赖外部网络。
 */
class IpLocationServiceFallbackTest {

    // 测试夹具用的一个公网地址（可被 ip2region 离线库定位），非任何部署地址
    private static final String PUBLIC_FIXTURE_IP = "114.114.114.114";

    private HttpServer server;
    private int port;

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            String body;
            if (path.startsWith("/myip")) {
                body = PUBLIC_FIXTURE_IP;
            } else if (path.startsWith("/alt")) {
                // 另一种免费 API 的字段风格（演示仅靠配置即可切换）
                body = "{\"code\":0,\"country_name\":\"中国\",\"region\":\"上海市\",\"city\":\"上海市\"}";
            } else {
                body = "{\"status\":\"success\",\"country\":\"中国\",\"regionName\":\"北京市\",\"city\":\"北京市\"}";
            }
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        port = server.getAddress().getPort();
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    private IpLocationService service(String provider, String fallback) {
        IpLocationService service = new IpLocationService();
        ReflectionTestUtils.setField(service, "provider", provider);
        ReflectionTestUtils.setField(service, "timeoutMs", 2000);
        ReflectionTestUtils.setField(service, "onlineUrlTemplate", "http://127.0.0.1:" + port + "/json/{ip}");
        ReflectionTestUtils.setField(service, "countryField", "country");
        ReflectionTestUtils.setField(service, "provinceField", "regionName");
        ReflectionTestUtils.setField(service, "cityField", "city");
        ReflectionTestUtils.setField(service, "statusField", "status");
        ReflectionTestUtils.setField(service, "statusOk", "success");
        ReflectionTestUtils.setField(service, "publicIpEchoUrl", "http://127.0.0.1:" + port + "/myip");
        ReflectionTestUtils.setField(service, "privateFallback", fallback);
        return service;
    }

    @Test
    void loopbackClientFallsBackToServerLocation() {
        String[] location = service("auto", "server").lookup("127.0.0.1");
        assertEquals("中国", location[0]);
        assertEquals("北京市", location[1]);
        assertEquals("北京市", location[2]);
    }

    @Test
    void privateClientFallsBackToServerLocation() {
        String[] location = service("auto", "server").lookup("10.0.0.10");
        assertEquals("中国", location[0]);
    }

    @Test
    void fallbackDisabledKeepsPrivateClientEmpty() {
        String[] location = service("auto", "off").lookup("127.0.0.1");
        assertEquals("", location[0]);
        assertEquals("", location[1]);
        assertEquals("", location[2]);
    }

    @Test
    void offlineProviderFallsBackViaOfflineDatabase() {
        IpLocationService service = service("offline", "server");
        service.init(); // 加载内置 ip2region.xdb，验证“零 GEO 配额”也能给出本机归属地
        String[] location = service.lookup("127.0.0.1");
        assertEquals("中国", location[0]);
    }

    @Test
    void publicClientUsesItsOwnLocationInsteadOfFallback() {
        String[] location = service("auto", "server").lookup("203.0.113.77");
        assertEquals("中国", location[0]);
        assertEquals("北京市", location[1]);
    }

    @Test
    void dnsFallbackResolvesFromSystemDnsPublicIp() {
        IpLocationService service = new IpLocationService() {
            @Override
            List<String> systemDnsServers() {
                return Arrays.asList(PUBLIC_FIXTURE_IP);
            }
        };
        ReflectionTestUtils.setField(service, "provider", "offline");
        ReflectionTestUtils.setField(service, "privateFallback", "dns");
        service.init(); // 加载内置 ip2region.xdb
        String[] location = service.lookup("10.0.0.9");
        assertEquals("中国", location[0]);
    }

    @Test
    void privateDnsServersAreSkipped() {
        IpLocationService service = new IpLocationService() {
            @Override
            List<String> systemDnsServers() {
                return Arrays.asList("127.0.0.11", "10.0.0.1");
            }
        };
        ReflectionTestUtils.setField(service, "provider", "offline");
        ReflectionTestUtils.setField(service, "privateFallback", "dns");
        service.init();
        String[] location = service.lookup("10.0.0.9");
        assertEquals("", location[0]); // Docker/内网 DNS 无法定位，保持空
    }

    @Test
    void onlineApiIsSwitchableByConfigurationOnly() {
        IpLocationService service = new IpLocationService();
        ReflectionTestUtils.setField(service, "provider", "online");
        ReflectionTestUtils.setField(service, "timeoutMs", 2000);
        ReflectionTestUtils.setField(service, "onlineUrlTemplate", "http://127.0.0.1:" + port + "/alt/{ip}");
        ReflectionTestUtils.setField(service, "countryField", "country_name");
        ReflectionTestUtils.setField(service, "provinceField", "region");
        ReflectionTestUtils.setField(service, "cityField", "city");
        ReflectionTestUtils.setField(service, "statusField", "");

        String[] location = service.lookup("203.0.113.77");
        assertEquals("中国", location[0]);
        assertEquals("上海市", location[1]);
        assertEquals("上海市", location[2]);
    }
}
