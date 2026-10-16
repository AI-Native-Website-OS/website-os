package com.sinounion.util;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 读取本机配置的 DNS 服务器地址，用于「私网/回环客户端 IP 无法定位」时的归属地兜底来源。
 *
 * <p>本机 DNS 通常是运营商提供的公网地址，其归属地可反映部署所在地；
 * 地址在运行时自动解析，不预设任何固定 IP。读取与 {@link IpLocationService} 的 ip2region 离线解析
 * 都不需要访问外网。</p>
 *
 * <p>同理，本机 IPv4/IPv6 网卡地址、DNS 地址等均由程序自行探测，部署环境各不相同，无需人工配置网段。</p>
 *
 * <p>获取顺序：优先使用 JDK 内置的 {@code sun.net.dns.ResolverConfiguration}（跨平台、不受输出本地化影响，
 * 通过反射调用以避免编译期依赖内部 API）；失败则回退读取 {@code /etc/resolv.conf}；Windows 再回退解析
 * {@code ipconfig /all} 输出。</p>
 */
public final class SystemDns {

    private SystemDns() {
    }

    /** 返回本机配置的 DNS 服务器地址（去重、保持顺序）；读取失败返回空列表。 */
    public static List<String> servers() {
        List<String> result = resolveViaJdk();
        if (!result.isEmpty()) {
            return result;
        }
        result = parseResolvConf(readFile("/etc/resolv.conf"));
        if (!result.isEmpty()) {
            return result;
        }
        String os = System.getProperty("os.name", "").toLowerCase();
        if (os.contains("win")) {
            return parseWindowsIpconfig(runCommand("ipconfig", "/all"));
        }
        return Collections.emptyList();
    }

    @SuppressWarnings("unchecked")
    private static List<String> resolveViaJdk() {
        try {
            Class<?> clazz = Class.forName("sun.net.dns.ResolverConfiguration");
            Object config = clazz.getMethod("open").invoke(null);
            Object nameservers = clazz.getMethod("nameservers").invoke(config);
            List<String> result = new ArrayList<>();
            if (nameservers instanceof List) {
                for (Object nameserver : (List<Object>) nameservers) {
                    if (nameserver != null) {
                        addIfValid(result, nameserver.toString());
                    }
                }
            }
            return result;
        } catch (Throwable t) {
            return Collections.emptyList();
        }
    }

    /** 解析 {@code /etc/resolv.conf} 文本中的 nameserver。 */
    static List<String> parseResolvConf(String text) {
        List<String> result = new ArrayList<>();
        if (text == null || text.isEmpty()) {
            return result;
        }
        for (String raw : text.split("\\r?\\n")) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#") || line.startsWith(";")) {
                continue;
            }
            if (!line.toLowerCase().startsWith("nameserver")) {
                continue;
            }
            String[] parts = line.split("\\s+");
            if (parts.length >= 2) {
                addIfValid(result, parts[1]);
            }
        }
        return result;
    }

    /** 解析 {@code ipconfig /all} 文本中的 DNS 服务器（兼容中英文标签与多行续行）。 */
    static List<String> parseWindowsIpconfig(String text) {
        List<String> result = new ArrayList<>();
        if (text == null || text.isEmpty()) {
            return result;
        }
        boolean collecting = false;
        for (String raw : text.split("\\r?\\n")) {
            String line = raw.trim();
            if (line.isEmpty()) {
                collecting = false;
                continue;
            }
            String lower = line.toLowerCase();
            boolean label = lower.contains("dns servers")
                    || line.contains("DNS 服务器")
                    || lower.contains("dns 服务器");
            if (label) {
                collecting = true;
                int idx = line.lastIndexOf(':');
                if (idx >= 0) {
                    addIfValid(result, line.substring(idx + 1).trim());
                }
                continue;
            }
            if (collecting) {
                if (WebUtils.isValidIp(stripZone(line))) {
                    addIfValid(result, line);
                } else {
                    collecting = false;
                }
            }
        }
        return result;
    }

    private static void addIfValid(List<String> result, String ip) {
        if (ip == null) {
            return;
        }
        String value = ip.trim();
        if (WebUtils.isValidIp(stripZone(value)) && !result.contains(value)) {
            result.add(value);
        }
    }

    private static String stripZone(String ip) {
        int zone = ip.indexOf('%');
        return zone >= 0 ? ip.substring(0, zone) : ip;
    }

    private static String readFile(String path) {
        try {
            return new String(Files.readAllBytes(Paths.get(path)), Charset.defaultCharset());
        } catch (Exception e) {
            return "";
        }
    }

    private static String runCommand(String... command) {
        Process process = null;
        try {
            process = new ProcessBuilder(command).redirectErrorStream(true).start();
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), Charset.defaultCharset()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line).append('\n');
                }
            }
            process.waitFor(3, TimeUnit.SECONDS);
            return sb.toString();
        } catch (Exception e) {
            return "";
        } finally {
            if (process != null) {
                process.destroy();
            }
        }
    }
}
