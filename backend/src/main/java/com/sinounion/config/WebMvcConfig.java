package com.sinounion.config;

import com.sinounion.translation.LocaleInterceptor;
import com.sinounion.util.UploadPathResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.annotation.PostConstruct;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final LocaleInterceptor localeInterceptor;

    @Value("${UPLOAD_PATH}")
    private String uploadPath;

    private String absoluteUploadPath;

    @PostConstruct
    public void init() {
        absoluteUploadPath = UploadPathResolver.resolve(uploadPath);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + absoluteUploadPath + "/");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(localeInterceptor).addPathPatterns("/**");
    }

    /**
     * 补充 .md 的 MIME 映射：Tomcat 默认不识别该扩展名，
     * 静态资源处理器会回退为 application/octet-stream；此处注册后按 text/markdown 返回。
     */
    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> uploadMimeTypeCustomizer() {
        return factory -> factory.addContextCustomizers(context -> {
            context.addMimeMapping("md", "text/markdown");
            context.addMimeMapping("markdown", "text/markdown");
        });
    }
}
