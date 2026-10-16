package com.sinounion.translation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/**
 * 在读接口返回前，对 locale=en 的响应体做译文覆盖。
 * 未设置 locale（管理后台等）则直通，零侵入现有接口。
 */
@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class TranslationResponseAdvice implements ResponseBodyAdvice<Object> {

    private final TranslationOverlayService overlayService;

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request, ServerHttpResponse response) {
        String locale = LocaleContext.get();
        if (locale == null || body == null) {
            return body;
        }
        try {
            overlayService.overlay(body, locale);
        } catch (Exception e) {
            log.debug("translation overlay failed: {}", e.getMessage());
        }
        return body;
    }
}
