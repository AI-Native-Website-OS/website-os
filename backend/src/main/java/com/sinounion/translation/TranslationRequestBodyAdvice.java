package com.sinounion.translation;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdvice;

import java.lang.reflect.Type;

/**
 * 管理后台在英文界面保存时，把与已存译文一致的字段还原为中文原文（读接口覆盖的逆操作），
 * 避免英文预览值覆盖数据库中的中文源内容。仅作用于 /admin 写请求。
 */
@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class TranslationRequestBodyAdvice implements RequestBodyAdvice {

    private final TranslationOverlayService overlayService;

    @Override
    public boolean supports(MethodParameter methodParameter, Type targetType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public HttpInputMessage beforeBodyRead(HttpInputMessage inputMessage, MethodParameter parameter,
                                           Type targetType,
                                           Class<? extends HttpMessageConverter<?>> converterType) {
        return inputMessage;
    }

    @Override
    public Object afterBodyRead(Object body, HttpInputMessage inputMessage, MethodParameter parameter,
                                Type targetType,
                                Class<? extends HttpMessageConverter<?>> converterType) {
        try {
            String locale = LocaleContext.get();
            if (!"en".equals(locale) || body == null) {
                return body;
            }
            String path = currentPath();
            if (path != null && path.contains("/admin")) {
                overlayService.restoreSources(body, locale);
            }
        } catch (Exception e) {
            log.debug("translation source restore failed: {}", e.getMessage());
        }
        return body;
    }

    @Override
    public Object handleEmptyBody(Object body, HttpInputMessage inputMessage, MethodParameter parameter,
                                  Type targetType,
                                  Class<? extends HttpMessageConverter<?>> converterType) {
        return body;
    }

    private String currentPath() {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null && attrs.getRequest() != null) {
                return attrs.getRequest().getRequestURI();
            }
        } catch (Exception ignored) {
            // 忽略
        }
        return null;
    }
}
