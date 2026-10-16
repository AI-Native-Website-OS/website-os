package com.sinounion.util;

import cn.hutool.cache.CacheUtil;
import cn.hutool.cache.impl.TimedCache;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.extern.slf4j.Slf4j;
import org.lionsoul.ip2region.xdb.Searcher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * IP 归属地解析。
 * 默认使用离线 ip2region（无任何调用配额，返回中文国家/省份/城市）；可通过 {@code app.ip-location-provider} 切换：
 * <ul>
 *   <li>offline（默认）：仅离线 ip2region，零 GEO 配额、无 GEO 外呼；</li>
 *   <li>auto：在线优先，失败回退离线；</li>
 *   <li>online：仅在线（免费 API 默认 ip-api.com，端点与字段均可配置，可换 ipapi.co 等）。</li>
 * </ul>
 * <p>
 * 注意：私网/保留 IP（192.168.x、10.x、172.16-31.x、127.x 等）无法通过任何 IP 库定位到真实地理地址；
 * 此时按 {@code app.ip-location-private-fallback} 的兜底策略解析：默认先用“本机 DNS 服务器公网 IP”的
 * 归属地（纯净离线，无需外网），其次用后端出口公网 IP 的归属地。客户端 IP 若能定位则优先使用，不走兜底。
 *
 * @return 数组 [国家, 省份, 城市]；解析失败或不可用时为 ["", "", ""]
 */
@Slf4j
@Component
public class IpLocationService {

    private static final String[] EMPTY = {"", "", ""};
    private static final String SERVER_LOCATION_KEY = "__server_public_ip__";
    private static final String DNS_LOCATION_KEY = "__system_dns__";
    private static final long SERVER_LOCATION_TTL_MS = 24 * 60 * 60 * 1000L;
    private static final long SERVER_LOCATION_FAIL_TTL_MS = 5 * 60 * 1000L;

    private Searcher searcher;

    @Value("${app.ip-location-provider:offline}")
    private String provider;

    @Value("${app.ip-location-timeout-ms:3000}")
    private int timeoutMs;

    /** 在线 GEO 端点模板；{ip} 为占位符，查询后端自身时替换为空串（多数免费 API 空串=查询调用方）。 */
    @Value("${app.ip-location-online-url:http://ip-api.com/json/{ip}?lang=zh-CN&fields=status,country,regionName,city}")
    private String onlineUrlTemplate;

    @Value("${app.ip-location-country-field:country}")
    private String countryField;

    @Value("${app.ip-location-province-field:regionName}")
    private String provinceField;

    @Value("${app.ip-location-city-field:city}")
    private String cityField;

    /** 可选：成功标志字段与期望值（不匹配则该次在线结果视为失败）。留空则不校验。 */
    @Value("${app.ip-location-status-field:status}")
    private String statusField;

    @Value("${app.ip-location-status-ok:success}")
    private String statusOk;

    /**
     * 私网/回环客户端 IP 无法定位时的归属地兜底策略（逗号分隔，按序尝试）：
     * <ul>
     *   <li>dns：用本机配置的 DNS 服务器公网 IP 的归属地（默认，纯离线，无需外网）；</li>
     *   <li>server：用后端出口公网 IP 的归属地（需外网）；</li>
     *   <li>off：不兜底（保持空）。</li>
     * </ul>
     */
    @Value("${app.ip-location-private-fallback:dns,server}")
    private String privateFallback;

    /** 探测后端自身出口公网 IP 的服务（纯文本返回 IP），仅 server 兜底时使用。 */
    @Value("${app.public-ip-echo-url:https://api.ipify.org}")
    private String publicIpEchoUrl;

    /** 在线查询结果缓存（按 IP 缓存 24h，避免重复请求消耗免费配额） */
    private final TimedCache<String, String[]> onlineCache = CacheUtil.newTimedCache(24 * 60 * 60 * 1000L);

    /** 服务端自身公网 IP 归属地缓存（探测失败时短缓存，避免每请求都外呼） */
    private final TimedCache<String, String[]> serverLocationCache = CacheUtil.newTimedCache(SERVER_LOCATION_TTL_MS);

    /** 本机 DNS 服务器归属地缓存 */
    private final TimedCache<String, String[]> dnsLocationCache = CacheUtil.newTimedCache(SERVER_LOCATION_TTL_MS);

    @PostConstruct
    public void init() {
        try {
            ClassPathResource resource = new ClassPathResource("ip2region.xdb");
            if (!resource.exists()) {
                log.warn("ip2region.xdb not found, IP geolocation disabled");
                return;
            }
            try (InputStream is = resource.getInputStream()) {
                byte[] cBuff = new byte[(int) resource.contentLength()];
                int offset = 0;
                int len;
                while ((len = is.read(cBuff, offset, cBuff.length - offset)) > 0) {
                    offset += len;
                }
                searcher = Searcher.newWithBuffer(cBuff);
                log.info("ip2region loaded: {} bytes", cBuff.length);
            }
        } catch (Exception e) {
            log.warn("Failed to init ip2region searcher: {}", e.getMessage());
            searcher = null;
        }
    }

    /**
     * 解析 IP 归属地。
     *
     * @return 数组 [国家, 省份, 城市]；解析失败或不可用时为 ["", "", ""]
     */
    public String[] lookup(String ip) {
        String[] resolved = resolveByIp(ip);
        if (hasValue(resolved)) {
            return resolved;
        }
        // 本机/内网客户端无法定位：按配置的兜底策略（默认 DNS，其次后端出口公网 IP）解析归属地
        if (WebUtils.isPrivateOrLoopback(ip)) {
            String[] fallback = privateFallbackLocation();
            if (hasValue(fallback)) {
                return fallback;
            }
        }
        return resolved;
    }

    private String[] resolveByIp(String ip) {
        if (ip == null || ip.trim().isEmpty()) {
            return EMPTY;
        }
        String normalized = ip.trim();
        String mode = normalizeMode();

        if (wantsOnline(mode) && isPublicIp(normalized)) {
            String[] online = lookupOnline(normalized);
            if (online != null) {
                return online;
            }
            if (onlineOnly(mode)) {
                return EMPTY;
            }
        }
        return lookupOffline(normalized);
    }

    private String normalizeMode() {
        return provider == null ? "offline" : provider.trim().toLowerCase();
    }

    /** 是否允许在线查询（auto 与 online/ipwho 均允许）。 */
    private boolean wantsOnline(String mode) {
        return "auto".equals(mode) || onlineOnly(mode);
    }

    /** 仅在线（auto 之外），在线失败不回落离线。ipwho 作为 online 的历史别名保留。 */
    private boolean onlineOnly(String mode) {
        return "online".equals(mode) || "ipwho".equals(mode);
    }

    /** 按配置顺序尝试私网兜底策略，返回首个非空归属地。 */
    private String[] privateFallbackLocation() {
        for (String strategy : fallbackStrategies()) {
            String[] location = null;
            if ("dns".equals(strategy)) {
                location = dnsLocation();
            } else if ("server".equals(strategy)) {
                location = serverLocation();
            }
            if (hasValue(location)) {
                return location;
            }
        }
        return EMPTY;
    }

    private List<String> fallbackStrategies() {
        List<String> strategies = new ArrayList<>();
        if (privateFallback == null) {
            return strategies;
        }
        for (String token : privateFallback.split(",")) {
            String value = token.trim().toLowerCase();
            if (value.isEmpty() || "off".equals(value)) {
                continue;
            }
            if (("dns".equals(value) || "server".equals(value)) && !strategies.contains(value)) {
                strategies.add(value);
            }
        }
        return strategies;
    }

    private boolean hasValue(String[] location) {
        if (location == null) {
            return false;
        }
        for (String segment : location) {
            if (segment != null && !segment.isEmpty()) {
                return true;
            }
        }
        return false;
    }

    /**
     * 本机 DNS 服务器归属地：取本机配置的 DNS 公网 IP（跳过私网/回环，如 Docker 的 127.0.0.11），
     * 用离线 ip2region 解析，无需外网。带缓存。
     */
    private String[] dnsLocation() {
        String[] cached = dnsLocationCache.get(DNS_LOCATION_KEY);
        if (cached != null) {
            return cached;
        }
        String[] location = EMPTY;
        for (String dns : systemDnsServers()) {
            if (dns == null || WebUtils.isPrivateOrLoopback(dns)) {
                continue;
            }
            String[] resolved = resolveByIp(dns);
            if (hasValue(resolved)) {
                location = resolved;
                break;
            }
        }
        dnsLocationCache.put(DNS_LOCATION_KEY, location,
                hasValue(location) ? SERVER_LOCATION_TTL_MS : SERVER_LOCATION_FAIL_TTL_MS);
        return location;
    }

    /** 本机配置的 DNS 服务器地址（可被子类/测试覆写）。 */
    List<String> systemDnsServers() {
        return SystemDns.servers();
    }

    /** 服务端自身出口公网 IP 的归属地（带缓存）。 */
    private String[] serverLocation() {
        String[] cached = serverLocationCache.get(SERVER_LOCATION_KEY);
        if (cached != null) {
            return cached;
        }
        String[] location = fetchServerLocation();
        serverLocationCache.put(SERVER_LOCATION_KEY, location,
                hasValue(location) ? SERVER_LOCATION_TTL_MS : SERVER_LOCATION_FAIL_TTL_MS);
        return location;
    }

    private String[] fetchServerLocation() {
        // 仅需一次轻量 IP 回显即可获知出口公网 IP；离线(ip2region)定位不消耗任何 GEO 配额。
        String publicIp = discoverPublicIp();
        if (publicIp == null) {
            return EMPTY;
        }
        String mode = normalizeMode();
        if (wantsOnline(mode)) {
            String[] online = lookupOnline(publicIp);
            if (online != null) {
                return online;
            }
            if (onlineOnly(mode)) {
                return EMPTY;
            }
        }
        return lookupOffline(publicIp);
    }

    private String discoverPublicIp() {
        try {
            String url = publicIpEchoUrl == null ? "" : publicIpEchoUrl.trim();
            if (url.isEmpty()) {
                return null;
            }
            HttpResponse response = HttpRequest.get(url).timeout(timeoutMs).execute();
            if (response.getStatus() != 200) {
                return null;
            }
            String body = response.body() == null ? "" : response.body().trim();
            return WebUtils.isValidIp(body) ? body : null;
        } catch (Exception e) {
            log.debug("Failed to discover server public IP: {}", e.getMessage());
            return null;
        }
    }

    private String[] lookupOnline(String ip) {
        String[] cached = onlineCache.get(ip);
        if (cached != null) {
            return cached;
        }
        try {
            String url = buildOnlineUrl(ip);
            HttpResponse response = HttpRequest.get(url).timeout(timeoutMs).execute();
            if (response.getStatus() != 200) {
                return null;
            }
            String[] result = parseOnlineResponse(response.body());
            if (result != null) {
                onlineCache.put(ip, result);
            }
            return result;
        } catch (Exception e) {
            log.debug("Online IP location lookup failed for {}: {}", ip, e.getMessage());
            return null;
        }
    }

    private String buildOnlineUrl(String ip) {
        String template = onlineUrlTemplate == null ? "" : onlineUrlTemplate.trim();
        return template.replace("{ip}", ip == null ? "" : ip);
    }

    private String[] parseOnlineResponse(String body) {
        if (body == null || body.trim().isEmpty()) {
            return null;
        }
        JSONObject json;
        try {
            json = JSONUtil.parseObj(body);
        } catch (Exception e) {
            return null;
        }
        if (statusField != null && !statusField.trim().isEmpty()) {
            String status = json.getStr(statusField.trim());
            if (status != null && !status.equalsIgnoreCase(statusOk == null ? "" : statusOk.trim())) {
                return null;
            }
        }
        String country = cleanSegment(json.getStr(countryField));
        String province = cleanSegment(json.getStr(provinceField));
        String city = cleanSegment(json.getStr(cityField));
        if (country.isEmpty() && province.isEmpty() && city.isEmpty()) {
            return null;
        }
        return new String[]{country, province, city};
    }

    private String[] lookupOffline(String ip) {
        if (searcher == null) {
            return new String[]{"", "", ""};
        }
        try {
            return parseIp2Region(searcher.search(ip));
        } catch (Exception e) {
            log.debug("ip2region lookup failed for {}: {}", ip, e.getMessage());
            return new String[]{"", "", ""};
        }
    }

    /**
     * 解析 ip2region 的区划字符串，只返回 [国家, 省份, 城市]，不包含 ISP/厂商。
     * 兼容两种数据格式（按最后一个字段是否为 ISO 国家代码判定）：
     * <ul>
     *   <li>本内置库格式：{@code 国家|省份|城市|ISP|国家代码}，如 {@code 中国|天津市|天津市|电信|CN}；</li>
     *   <li>标准 ip2region 格式：{@code 国家|区域|省份|城市|ISP}，如 {@code 中国|0|江苏省|南京市|电信}。</li>
     * </ul>
     */
    static String[] parseIp2Region(String region) {
        if (region == null || region.isEmpty()) {
            return new String[]{"", "", ""};
        }
        String[] parts = region.split("\\|");
        String country = cleanSegment(at(parts, 0));
        String province;
        String city;
        if (parts.length >= 5 && isIsoCountryCode(parts[parts.length - 1])) {
            province = at(parts, 1);
            city = at(parts, 2);
        } else if (parts.length >= 4) {
            province = at(parts, 2);
            city = at(parts, 3);
        } else if (parts.length == 3) {
            province = at(parts, 1);
            city = at(parts, 2);
        } else {
            province = "";
            city = "";
        }
        return new String[]{country, cleanSegment(province), cleanSegment(city)};
    }

    private static String at(String[] parts, int index) {
        return index >= 0 && index < parts.length ? parts[index] : "";
    }

    private static boolean isIsoCountryCode(String value) {
        if (value == null) {
            return false;
        }
        String v = value.trim();
        if (v.length() != 2) {
            return false;
        }
        return (v.charAt(0) >= 'A' && v.charAt(0) <= 'Z' || v.charAt(0) >= 'a' && v.charAt(0) <= 'z')
                && (v.charAt(1) >= 'A' && v.charAt(1) <= 'Z' || v.charAt(1) >= 'a' && v.charAt(1) <= 'z');
    }

    private boolean isPublicIp(String ip) {
        if (ip == null || ip.isEmpty()) return false;
        if (ip.contains(":")) return false; // IPv6 简化处理，不做在线查询
        String[] octets = ip.split("\\.");
        if (octets.length != 4) return false;
        int a = parseInt(octets[0]);
        int b = parseInt(octets[1]);
        if (a == 10) return false;
        if (a == 127) return false;
        if (a == 172 && b >= 16 && b <= 31) return false;
        if (a == 192 && b == 168) return false;
        if (a == 169 && b == 254) return false;
        return true;
    }

    private int parseInt(String s) {
        try {
            return Integer.parseInt(s);
        } catch (Exception e) {
            return -1;
        }
    }

    private static String cleanSegment(String value) {
        if (value == null) return "";
        String v = value.trim();
        if ("0".equals(v) || "内网IP".equals(v) || "局域网".equals(v)
                || "Reserved".equalsIgnoreCase(v) || "保留地址".equals(v)) {
            return "";
        }
        return v;
    }
}