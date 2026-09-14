package com.sinounion.config;

import com.sinounion.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOriginPatterns(Arrays.asList("*"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setAllowedMethods(Arrays.asList("GET","POST","PUT","DELETE","PATCH","OPTIONS"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeRequests()
                // 前台仅允许匿名提交线索：创建线索与访客行为建线索；
                // 线索的查询/详情/状态/指派/跟进等管理能力在 /admin/leads 下并受权限保护。
                .antMatchers(org.springframework.http.HttpMethod.POST, "/leads", "/leads/from-visitor").permitAll()
                .antMatchers(
                    "/auth/login",
                    "/auth/register",
                    "/auth/send-code",
                    "/auth/login-by-code",
                    "/auth/refresh",
                    "/products/**",
                    "/solutions/**",
                    "/cases/**",
                    "/resources/**",
                    "/faqs/**",
                    "/core-modules/**",
                    "/content/**",
                    "/home/**",
                    "/ai/**",
                    "/about/**",
                    "/contacts",
                    "/stats/**",
                    "/seo/**",
                    "/ai-facts/**",
                    "/resources/**",
                    "/resource-categories/**",
                    "/banners/**",
                    "/partners/**",
                    "/industry-chains/**",
                    "/upload/**",
                    "/uploads/**",
                    "/files/**"
                ).permitAll()
                .antMatchers("/admin/**").authenticated()
                .antMatchers(
                    "/swagger-ui/**",
                    "/v3/api-docs/**",
                    "/doc.html",
                    "/swagger-resources/**"
                ).access("hasAuthority('system:api-docs:view')")
                .anyRequest().authenticated()
                .and()
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
