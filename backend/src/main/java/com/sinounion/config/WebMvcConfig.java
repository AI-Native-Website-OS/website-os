package com.sinounion.config;

import com.sinounion.util.UploadPathResolver;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.annotation.PostConstruct;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

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
}
