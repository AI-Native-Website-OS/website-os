package com.sinounion.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 统一的后端客户端 IP 解析器。页面浏览、线索提交、登录限流等所有场景必须复用本实例，
 * 禁止各自实现，避免逻辑分叉与伪造漏洞。
 *
 * <p>可信代理来源（两者取并集，均要求“精确可信”，绝不整体信任某个网段）：</p>
 * <ol>
 *   <li><b>项目自带部署的固定代理</b>：{@code app.trusted-proxy-hosts} 列出的主机名。
 *       Docker Compose 内部 DNS 可将服务名 {@code sino-website-frontend}（即项目自带 nginx）
 *       解析为其容器 IP，后端据此精确信任该代理，无需公网 IP、无需手工填写代理地址，
 *       也不依赖公网。仅在容器内网 + 固定服务拓扑下生效。</li>
 *   <li><b>可选的自定义 CIDR</b>：{@code app.trusted-proxies}（IP/CIDR 列表），
 *       用于外部 Nginx / 云负载均衡器 / K8s Ingress 等项目无法控制的上游代理；
 *       默认仅本机回环（同机代理）。未配置时保持安全默认。</li>
 * </ol>
 *
 * <p>解析规则：取 TCP 直连来源 {@code getRemoteAddr()}；若其不属于任一可信代理，
 * 一律忽略转发头并使用该直连地址（防伪造）；若可信，则把 X-Forwarded-For 与直连地址拼成链，
 * 从右向左跳过可信代理，第一个非可信地址即真实客户端。所有返回值经 {@link WebUtils} 清洗为单个合法 IP。</p>
 */
@Slf4j
@Component
public class ClientIpResolver {

    /** 默认可信 CIDR：仅本机回环（同机反向代理 / 本地开发）。 */
    static final String DEFAULT_TRUSTED_PROXIES = "127.0.0.0/8,::1/128";
    /** 默认可信代理主机：项目自带 Nginx 前端服务（Docker Compose 内网可解析）。 */
    static final String DEFAULT_TRUSTED_PROXY_HOSTS = "sino-website-frontend";
    /** 主机名解析缓存有效期，避免每请求都做 DNS，同时能跟随后端代理 IP 变化。 */
    static final long HOST_CACHE_TTL_MS = 60_000L;

    private final List<CidrBlock> trustedCidrs;
    private final List<String> trustedHosts;
    private final AtomicReference<HostCache> hostCache =
            new AtomicReference<>(new HostCache(Collections.<CidrBlock>emptyList(), 0L));

    public ClientIpResolver(
            @Value("${app.trusted-proxies:" + DEFAULT_TRUSTED_PROXIES + "}") String trustedProxies,
            @Value("${app.trusted-proxy-hosts:" + DEFAULT_TRUSTED_PROXY_HOSTS + "}") String trustedProxyHosts) {
        this.trustedCidrs = Collections.unmodifiableList(parseCidrs(trustedProxies));
        this.trustedHosts = Collections.unmodifiableList(parseHosts(trustedProxyHosts));
        if (trustedCidrs.isEmpty() && trustedHosts.isEmpty()) {
            log.warn("No trusted proxies configured; all forwarding headers will be ignored and the TCP peer address used");
        }
    }

    /** 解析请求的真实客户端 IP。除非容器未提供 remoteAddr，否则不返回 null。 */
    public String resolve(HttpServletRequest request) {
        String remoteAddr = request == null ? null : WebUtils.normalizeClientIp(request.getRemoteAddr());
        if (remoteAddr == null) {
            return null;
        }
        if (!isTrusted(remoteAddr)) {
            // 直接访问或来源不可信：不信任任何转发头，防止伪造
            return remoteAddr;
        }

        List<String> chain = collectForwardedChain(request);
        if (chain.isEmpty()) {
            String realIp = WebUtils.normalizeClientIp(request.getHeader("X-Real-IP"));
            return realIp != null ? realIp : remoteAddr;
        }

        // 完整链 = 转发头(客户端 -> ... -> 最近的代理) + 直连来源
        chain.add(remoteAddr);
        for (int i = chain.size() - 1; i >= 0; i--) {
            String ip = chain.get(i);
            if (!isTrusted(ip)) {
                return ip;
            }
        }
        // 整条链都在可信范围内（例如本机多级代理），返回最左端（最初的客户端）
        return chain.get(0);
    }

    /** 某地址是否属于可信代理（配置的 CIDR + 解析出的代理主机地址）。 */
    public boolean isTrusted(String ip) {
        byte[] addr = WebUtils.ipToBytes(ip);
        if (addr == null) {
            return false;
        }
        for (CidrBlock block : trustedCidrs) {
            if (block.matches(addr)) {
                return true;
            }
        }
        for (CidrBlock block : resolvedHostBlocks()) {
            if (block.matches(addr)) {
                return true;
            }
        }
        return false;
    }

    private List<CidrBlock> resolvedHostBlocks() {
        if (trustedHosts.isEmpty()) {
            return Collections.emptyList();
        }
        HostCache cache = hostCache.get();
        long now = System.currentTimeMillis();
        if (cache.loadedAt != 0L && now - cache.loadedAt < HOST_CACHE_TTL_MS) {
            return cache.blocks;
        }
        synchronized (this) {
            cache = hostCache.get();
            now = System.currentTimeMillis();
            if (cache.loadedAt == 0L || now - cache.loadedAt >= HOST_CACHE_TTL_MS) {
                cache = new HostCache(resolveHosts(), now);
                hostCache.set(cache);
            }
            return cache.blocks;
        }
    }

    private List<CidrBlock> resolveHosts() {
        Map<String, byte[]> resolved = new LinkedHashMap<>();
        for (String host : trustedHosts) {
            try {
                for (InetAddress address : InetAddress.getAllByName(host)) {
                    byte[] bytes = address.getAddress();
                    if (bytes != null) {
                        resolved.put(address.getHostAddress(), bytes);
                    }
                }
            } catch (Exception e) {
                // 非容器环境（如本地直接运行）解析不到该主机属正常，退化为仅用直连地址
                log.debug("Trusted proxy host '{}' did not resolve: {}", host, e.getMessage());
            }
        }
        List<CidrBlock> blocks = new ArrayList<>();
        for (Map.Entry<String, byte[]> entry : resolved.entrySet()) {
            byte[] bytes = entry.getValue();
            blocks.add(new CidrBlock(bytes, bytes.length * 8, entry.getKey()));
        }
        return Collections.unmodifiableList(blocks);
    }

    private List<String> collectForwardedChain(HttpServletRequest request) {
        List<String> result = new ArrayList<>();
        Enumeration<String> xff = request.getHeaders("X-Forwarded-For");
        if (xff != null) {
            while (xff.hasMoreElements()) {
                String header = xff.nextElement();
                if (header == null || header.trim().isEmpty()) {
                    continue;
                }
                for (String part : header.split(",")) {
                    String ip = WebUtils.normalizeClientIp(part);
                    if (ip != null) {
                        result.add(ip);
                    }
                }
            }
        }
        return result;
    }

    private static List<String> parseHosts(String configured) {
        List<String> hosts = new ArrayList<>();
        if (configured == null || configured.trim().isEmpty()) {
            return hosts;
        }
        for (String token : configured.split(",")) {
            String host = token.trim();
            if (!host.isEmpty()) {
                hosts.add(host);
            }
        }
        return hosts;
    }

    private static List<CidrBlock> parseCidrs(String configured) {
        List<CidrBlock> blocks = new ArrayList<>();
        if (configured == null || configured.trim().isEmpty()) {
            return blocks;
        }
        for (String token : configured.split(",")) {
            String entry = token.trim();
            if (entry.isEmpty()) {
                continue;
            }
            String addrPart = entry;
            Integer prefixOverride = null;
            int slash = entry.indexOf('/');
            if (slash >= 0) {
                addrPart = entry.substring(0, slash).trim();
                String prefixPart = entry.substring(slash + 1).trim();
                try {
                    prefixOverride = Integer.parseInt(prefixPart);
                } catch (NumberFormatException e) {
                    log.warn("Ignoring invalid trusted proxy '{}': bad prefix length", entry);
                    continue;
                }
            }
            byte[] network = WebUtils.ipToBytes(addrPart);
            if (network == null) {
                log.warn("Ignoring invalid trusted proxy '{}': not a valid IP/CIDR", entry);
                continue;
            }
            int maxPrefix = network.length * 8;
            int prefix = prefixOverride == null ? maxPrefix : prefixOverride;
            if (prefix < 0 || prefix > maxPrefix) {
                log.warn("Ignoring invalid trusted proxy '{}': prefix out of range", entry);
                continue;
            }
            if (prefix == 0) {
                // 安全护栏：0.0.0.0/0 或 ::/0 会让所有请求都被当作可信，等同关闭防护
                log.error("Refusing catch-all trusted proxy '{}' (prefix 0); configure the real proxy address instead", entry);
                continue;
            }
            blocks.add(new CidrBlock(network, prefix, entry));
        }
        return blocks;
    }

    private static final class HostCache {
        private final List<CidrBlock> blocks;
        private final long loadedAt;

        HostCache(List<CidrBlock> blocks, long loadedAt) {
            this.blocks = blocks;
            this.loadedAt = loadedAt;
        }
    }

    private static final class CidrBlock {
        private final byte[] network;
        private final int prefixLength;
        private final String source;

        CidrBlock(byte[] network, int prefixLength, String source) {
            this.network = network;
            this.prefixLength = prefixLength;
            this.source = source;
        }

        boolean matches(byte[] ip) {
            return WebUtils.inCidr(ip, network, prefixLength);
        }

        @Override
        public String toString() {
            return source;
        }
    }
}
