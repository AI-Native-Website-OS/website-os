package com.sinounion.translation;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * 读取请求中的 locale 查询参数并写入 LocaleContext。
 * 无该参数（如管理后台请求）则不设置，读路径直通中文。
 */
@Component
public class LocaleInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String locale = request.getParameter("locale");
        if (locale != null && !locale.trim().isEmpty()) {
            LocaleContext.set(locale.trim().toLowerCase());
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        LocaleContext.clear();
    }
}
