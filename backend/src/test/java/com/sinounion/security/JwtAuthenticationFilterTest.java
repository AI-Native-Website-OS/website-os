package com.sinounion.security;

import com.sinounion.mapper.UserMapper;
import com.sinounion.utils.JwtUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import javax.servlet.FilterChain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    private JwtUtils jwtUtils;
    private UserDetailsService userDetailsService;
    private UserMapper userMapper;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        jwtUtils = mock(JwtUtils.class);
        userDetailsService = mock(UserDetailsService.class);
        userMapper = mock(UserMapper.class);
        filter = new JwtAuthenticationFilter(jwtUtils, userDetailsService, userMapper);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void validTokenForDeletedUserContinuesChainWithout403() throws Exception {
        String token = "valid-token-for-deleted-user";
        when(jwtUtils.validateToken(token)).thenReturn(true);
        when(jwtUtils.getUsername(token)).thenReturn("ghost_user");
        when(userDetailsService.loadUserByUsername("ghost_user"))
                .thenThrow(new UsernameNotFoundException("用户不存在: ghost_user"));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertEquals(200, response.getStatus());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}