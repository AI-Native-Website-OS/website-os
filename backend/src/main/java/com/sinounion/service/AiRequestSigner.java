package com.sinounion.service;

import cn.hutool.http.HttpRequest;
import com.sinounion.utils.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 为后端发往 AI 服务（FastAPI /ai/**）的请求附加鉴权头。
 *
 * <p>AI 服务对管理/破坏性接口强制鉴权，服务间调用使用两种凭据：
 * 配置了 {@code AI_INTERNAL_TOKEN} 时携带 {@code X-Internal-Token}；
 * 同时附带一枚由共享 {@code JWT_SECRET} 签发的服务端 JWT，保证仅配置 JWT_SECRET 时也能通过校验。
 */
@Component
@RequiredArgsConstructor
public class AiRequestSigner {

    private final JwtUtils jwtUtils;

    @Value("${AI_INTERNAL_TOKEN:}")
    private String internalToken;

    public void sign(HttpRequest request) {
        if (request == null) {
            return;
        }
        if (StringUtils.hasText(internalToken)) {
            request.header("X-Internal-Token", internalToken.trim());
        }
        request.header("Authorization", "Bearer " + jwtUtils.generateToken(0L, "system", "SYSTEM"));
    }
}
