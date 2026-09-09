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

/**
 * IP 归属地解析。
 * 支持两种来源：
 * 1. 在线 ipwho.is（app.ip-location-provider=ipwho/auto 时启用），返回中文国家/省份/城市，带本地缓存与超时；
 * 2. 离线 ip2region（app.ip-location-provider=offline 或在线查询失败时兜底）。
 * <p>
 * 注意：私网/保留 IP（192.168.x、10.x、172.16-31.x、127.x 等）无法通过任何 IP 库定位到真实地理地址，
 * ipwho.is 对私网 IP 会返回 Reserved range，ip2region 会返回内网IP，二者最终归属地均为空。
 *
 * @return 数组 [国家, 省份, 城市]；解析失败或不可用时为 ["", "", ""]
 */
@Slf4j
@Component
public class IpLocationService {

    private Searcher searcher;

    @Value("${app.ip-location-provider:auto}")
    private String provider;

    @Value("${app.ipwho.url:https://ipwho.is}")
    private String ipwhoUrl;

    @Value("${app.ipwho.timeout-ms:3000}")
    private int timeoutMs;

    /** 在线查询结果缓存（ipwho.is 免费额度 1000 次/天，避免重复请求） */
    private final TimedCache<String, String[]> onlineCache = CacheUtil.newTimedCache(24 * 60 * 60 * 1000L);

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
        if (ip == null || ip.trim().isEmpty()) {
            return new String[]{"", "", ""};
        }
        String normalized = ip.trim();
        String mode = provider == null ? "auto" : provider.trim().toLowerCase();

        boolean useOnline = "ipwho".equals(mode) || "auto".equals(mode);
        if (useOnline && isPublicIp(normalized)) {
            String[] online = lookupOnline(normalized);
            if (online != null) {
                return online;
            }
            if ("ipwho".equals(mode)) {
                return new String[]{"", "", ""};
            }
        }
        return lookupOffline(normalized);
    }

    private String[] lookupOnline(String ip) {
        String[] cached = onlineCache.get(ip);
        if (cached != null) {
            return cached;
        }
        try {
            String url = ipwhoUrl.trim().replaceAll("/+$", "") + "/" + ip + "?lang=zh-CN";
            HttpResponse response = HttpRequest.get(url).timeout(timeoutMs).execute();
            if (response.getStatus() != 200) {
                return null;
            }
            JSONObject json = JSONUtil.parseObj(response.body());
            if (!json.getBool("success", false)) {
                return null;
            }
            String[] result = {
                    cleanSegment(json.getStr("country", "")),
                    cleanSegment(json.getStr("region", "")),
                    cleanSegment(json.getStr("city", ""))
            };
            onlineCache.put(ip, result);
            return result;
        } catch (Exception e) {
            log.debug("ipwho.is lookup failed for {}: {}", ip, e.getMessage());
            return null;
        }
    }

    private String[] lookupOffline(String ip) {
        if (searcher == null) {
            return new String[]{"", "", ""};
        }
        try {
            String region = searcher.search(ip);
            // ip2region 返回格式：国家|区域|省份|城市|ISP，例如 "中国|0|广东省|深圳市|电信"
            String[] parts = region.split("\\|");
            String country = parts.length > 0 ? cleanSegment(parts[0]) : "";
            String province = "";
            String city = "";
            if (parts.length >= 4) {
                province = parts[2];
                city = parts[3];
            } else if (parts.length == 3) {
                province = parts[1];
                city = parts[2];
            }
            return new String[]{country, cleanSegment(province), cleanSegment(city)};
        } catch (Exception e) {
            log.debug("ip2region lookup failed for {}: {}", ip, e.getMessage());
            return new String[]{"", "", ""};
        }
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

    private String cleanSegment(String value) {
        if (value == null) return "";
        String v = value.trim();
        if ("0".equals(v) || "内网IP".equals(v) || "局域网".equals(v)
                || "Reserved".equalsIgnoreCase(v) || "保留地址".equals(v)) {
            return "";
        }
        return v;
    }
}