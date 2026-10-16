package com.sinounion.util;

import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;

/**
 * 统一的后端客户端 IP 解析器。页面浏览、线索提交、登录限流等所有场景必须复用本实例，
 * 禁止各自实现，避免逻辑分叉。
 *
 * <p>解析规则：优先取反向代理写入的 {@link #REAL_IP_HEADER} 头；缺失或非法时回退到
 * TCP 直连来源 {@code getRemoteAddr()}。所有返回值经 {@link WebUtils#normalizeClientIp(String)}
 * 清洗为单个合法 IP。</p>
 */
@Component
public class ClientIpResolver {

    /** 反向代理写入真实客户端 IP 的请求头。 */
    static final String REAL_IP_HEADER = "X-Real-IP";

    /** 解析请求的客户端 IP，X-Real-IP 缺失或非法时回退到直连来源。 */
    public String resolve(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String realIp = WebUtils.normalizeClientIp(request.getHeader(REAL_IP_HEADER));
        if (realIp != null) {
            return realIp;
        }
        return WebUtils.normalizeClientIp(request.getRemoteAddr());
    }
}
