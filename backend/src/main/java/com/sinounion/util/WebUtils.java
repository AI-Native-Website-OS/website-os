package com.sinounion.util;

/**
 * Web 请求相关的纯函数工具：客户端 IP 的规范化与校验。
 *
 * <p>本类只负责把任意字符串（转发头片段、带端口地址、空白/异常值等）清洗为一个合法的
 * 单个 IP 字符串，并提供 CIDR 匹配所需的字节转换。真实的客户端 IP 解析由
 * {@link com.sinounion.util.ClientIpResolver} 统一实现，页面浏览与线索提交复用同一实例，
 * 避免逻辑分叉。</p>
 */
public final class WebUtils {

    /** 无法被任何 IP 库定位到真实地理位置的私网/保留/回环网段。 */
    private static final String[] PRIVATE_CIDRS = {
            "0.0.0.0/32", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
            "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16",
            "::/128", "::1/128", "fc00::/7", "fe80::/10"
    };

    private static final byte[][] PRIVATE_NETWORKS;
    private static final int[] PRIVATE_PREFIXES;

    static {
        PRIVATE_NETWORKS = new byte[PRIVATE_CIDRS.length][];
        PRIVATE_PREFIXES = new int[PRIVATE_CIDRS.length];
        for (int i = 0; i < PRIVATE_CIDRS.length; i++) {
            int slash = PRIVATE_CIDRS[i].indexOf('/');
            PRIVATE_NETWORKS[i] = ipToBytes(PRIVATE_CIDRS[i].substring(0, slash));
            PRIVATE_PREFIXES[i] = Integer.parseInt(PRIVATE_CIDRS[i].substring(slash + 1));
        }
    }

    private WebUtils() {
    }

    /**
     * 是否为无法定位的私网/回环/保留地址（含空值与非法值）。
     * 用于判定是否需要对客户端 IP 归属地做“服务端自身公网 IP”兜底。
     */
    public static boolean isPrivateOrLoopback(String ip) {
        if (ip == null || ip.trim().isEmpty()) {
            return true;
        }
        byte[] addr = ipToBytes(ip);
        if (addr == null) {
            return true;
        }
        for (int i = 0; i < PRIVATE_NETWORKS.length; i++) {
            if (inCidr(addr, PRIVATE_NETWORKS[i], PRIVATE_PREFIXES[i])) {
                return true;
            }
        }
        return false;
    }

    /**
     * 将一段可能带有端口、方括号、空白或非法内容的字符串规范化为单个合法 IP。
     *
     * <p>支持：IPv4、IPv6、IPv4:端口、[IPv6]:端口、带 zone 的 IPv6。空白、{@code unknown}、
     * 代理链（多值）、非法字符串一律返回 {@code null}，绝不把整条链或端口写入 IP 字段。</p>
     */
    public static String normalizeClientIp(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim();
        if (value.isEmpty()) {
            return null;
        }
        // 去除 RFC 7239 / 部分代理会加的双引号
        if (value.length() >= 2 && value.charAt(0) == '"' && value.charAt(value.length() - 1) == '"') {
            value = value.substring(1, value.length() - 1).trim();
            if (value.isEmpty()) {
                return null;
            }
        }
        // 方括号形式：[IPv6] 或 [IPv6]:端口 或 [IPv4]:端口
        if (value.charAt(0) == '[') {
            int end = value.indexOf(']');
            if (end <= 1) {
                return null;
            }
            String inner = value.substring(1, end).trim();
            return isValidIp(inner) ? stripZone(inner) : null;
        }
        // IPv4:端口（仅当冒号后为纯数字且冒号前是合法 IPv4 时才剥离端口）
        if (value.indexOf(':') >= 0 && value.indexOf('.') >= 0 && !value.contains("::")) {
            int idx = value.lastIndexOf(':');
            String host = value.substring(0, idx);
            String port = value.substring(idx + 1);
            if (isAllDigits(port) && isValidIpv4(host)) {
                return host;
            }
        }
        return isValidIp(value) ? stripZone(value) : null;
    }

    /** 是否为合法 IPv4 或 IPv6 字面量。不触发 DNS 解析（仅接受纯数字/十六进制字面量）。 */
    public static boolean isValidIp(String ip) {
        return isValidIpv4(ip) || isValidIpv6(ip);
    }

    /** 点分十进制 IPv4 校验（0-255，四段）。 */
    public static boolean isValidIpv4(String ip) {
        if (ip == null) {
            return false;
        }
        String value = ip.trim();
        String[] parts = value.split("\\.", -1);
        if (parts.length != 4) {
            return false;
        }
        for (String part : parts) {
            if (part.isEmpty() || part.length() > 3 || !isAllDigits(part)) {
                return false;
            }
            if (Integer.parseInt(part) > 255) {
                return false;
            }
        }
        return true;
    }

    /**
     * IPv6 校验，支持 {@code ::} 压缩、末尾内嵌 IPv4（如 {@code ::ffff:1.2.3.4}）以及 {@code %zone}。
     */
    public static boolean isValidIpv6(String input) {
        if (input == null) {
            return false;
        }
        String ip = input.trim();
        int zoneIdx = ip.indexOf('%');
        if (zoneIdx >= 0) {
            ip = ip.substring(0, zoneIdx);
        }
        if (ip.isEmpty() || ip.indexOf(':') < 0) {
            return false;
        }

        int firstDc = ip.indexOf("::");
        if (firstDc >= 0 && ip.indexOf("::", firstDc + 1) >= 0) {
            return false; // 最多一个 "::"
        }

        String[] headGroups;
        String[] tailGroups;
        if (firstDc >= 0) {
            String head = ip.substring(0, firstDc);
            String tail = ip.substring(firstDc + 2);
            headGroups = head.isEmpty() ? new String[0] : head.split(":", -1);
            tailGroups = tail.isEmpty() ? new String[0] : tail.split(":", -1);
        } else {
            headGroups = ip.split(":", -1);
            tailGroups = new String[0];
        }

        int total = headGroups.length + tailGroups.length;
        int equivalents = 0;
        for (int i = 0; i < total; i++) {
            String group = i < headGroups.length ? headGroups[i] : tailGroups[i - headGroups.length];
            if (group.isEmpty()) {
                return false; // 单冒号两侧出现空组（如 ":::1"）
            }
            if (group.indexOf('.') >= 0) {
                // 内嵌 IPv4：必须是最后一个组，且位于 "::" 之后
                if (i != total - 1) {
                    return false;
                }
                if (firstDc >= 0 && i < headGroups.length) {
                    return false;
                }
                if (!isValidIpv4(group)) {
                    return false;
                }
                equivalents += 2;
            } else {
                if (group.length() > 4 || !isHex(group)) {
                    return false;
                }
                equivalents += 1;
            }
        }

        if (firstDc >= 0) {
            // "::" 必须至少省略一个 16 位组
            return equivalents <= 7;
        }
        return equivalents == 8;
    }

    /**
     * 将合法 IP 转为定长字节（IPv4=4，IPv6=16），用于 CIDR 匹配；非法返回 {@code null}。
     * 已确认是字面量，因此不会触发 DNS。
     */
    public static byte[] ipToBytes(String ip) {
        String value = normalizeClientIp(ip);
        if (value == null) {
            return null;
        }
        try {
            return java.net.InetAddress.getByName(stripZone(value)).getAddress();
        } catch (Exception e) {
            return null;
        }
    }

    /** 判断 ip 字节是否落在给定网络地址 + 前缀长度内。 */
    public static boolean inCidr(byte[] ip, byte[] network, int prefixLength) {
        if (ip == null || network == null || ip.length != network.length) {
            return false;
        }
        int maxPrefix = ip.length * 8;
        if (prefixLength < 0 || prefixLength > maxPrefix) {
            return false;
        }
        int fullBytes = prefixLength / 8;
        int remainingBits = prefixLength % 8;
        for (int i = 0; i < fullBytes; i++) {
            if (ip[i] != network[i]) {
                return false;
            }
        }
        if (remainingBits > 0) {
            int mask = (0xFF << (8 - remainingBits)) & 0xFF;
            if ((ip[fullBytes] & mask) != (network[fullBytes] & mask)) {
                return false;
            }
        }
        return true;
    }

    private static String stripZone(String ip) {
        int zoneIdx = ip.indexOf('%');
        return zoneIdx >= 0 ? ip.substring(0, zoneIdx) : ip;
    }

    private static boolean isAllDigits(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    private static boolean isHex(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            boolean hex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
            if (!hex) {
                return false;
            }
        }
        return true;
    }
}
