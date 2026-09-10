package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.config.SecretCryptoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 敏感配置传输加密公钥下发。
 *
 * 公钥本身是公开信息（只能加密、不能解密），因此可安全下发给浏览器；
 * 私钥仅保存在后端内存，用于解密前端提交的 rsa:v1: 密文。
 */
@Tag(name = "管理后台-传输加密", description = "敏感配置前端加密公钥")
@RestController
@RequestMapping("/admin/system/crypto")
@RequiredArgsConstructor
public class AdminCryptoController {

    private final SecretCryptoService secretCryptoService;

    @Operation(summary = "获取前端加密公钥（DER SPKI Base64）")
    @GetMapping("/public-key")
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<Map<String, String>> publicKey() {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("algorithm", "RSA-OAEP-256");
        data.put("publicKey", secretCryptoService.publicKeyBase64());
        return Result.success(data);
    }
}
