package com.sinounion.service;

import cn.hutool.http.HttpRequest;
import com.sinounion.config.SystemSecretService;
import com.sinounion.utils.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 为后端发往 AI 服务（FastAPI /ai/**）的请求附加鉴权头。
 *
 * <p>AI 服务对管理/破坏性接口强制鉴权，服务间调用使用两种凭据：
 * 携带由 system_secrets 表自动生成的 {@code X-Internal-Token}；
 * 同时附带一枚由共享 JWT 签名密钥签发的服务端 JWT。
 */
@Component
@RequiredArgsConstructor
public class AiRequestSigner {

    private final JwtUtils jwtUtils;
    private final SystemSecretService systemSecretService;

    public void sign(HttpRequest request) {
        if (request == null) {
            return;
        }
        String internalToken = systemSecretService.getInternalToken();
        if (StringUtils.hasText(internalToken)) {
            request.header("X-Internal-Token", internalToken.trim());
        }
        request.header("Authorization", "Bearer " + jwtUtils.generateToken(0L, "system", "SYSTEM"));
    }
}
