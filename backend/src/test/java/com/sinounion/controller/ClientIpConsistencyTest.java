package com.sinounion.controller;

import com.sinounion.entity.Lead;
import com.sinounion.mapper.UserMapper;
import com.sinounion.service.LeadService;
import com.sinounion.service.StatsService;
import com.sinounion.util.ClientIpResolver;
import com.sinounion.util.IpLocationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 页面浏览与线索提交必须复用同一 ClientIpResolver，且对同一请求得到一致的客户端 IP。
 */
class ClientIpConsistencyTest {

    @Test
    void pageViewAndLeadResolveIdenticalClientIp() {
        ClientIpResolver resolver = spy(new ClientIpResolver());

        StatsService statsService = mock(StatsService.class);
        LeadService leadService = mock(LeadService.class);
        IpLocationService ipLocationService = mock(IpLocationService.class);
        UserMapper userMapper = mock(UserMapper.class);

        when(ipLocationService.lookup(anyString())).thenReturn(new String[]{"", "", ""});
        when(leadService.getLeadByPhoneAndSource(any(), any())).thenReturn(null);

        StatsController statsController = new StatsController(statsService, ipLocationService, resolver);
        LeadController leadController = new LeadController(leadService, ipLocationService, userMapper, resolver);

        statsController.recordPageView("home", null, "/", "visitor-1", "ua", "", proxyRequest(), null);

        Lead lead = new Lead();
        lead.setPhone("13800000000");
        lead.setSource("form");
        leadController.createLead(lead, proxyRequest(), null);

        ArgumentCaptor<String> ipCaptor = ArgumentCaptor.forClass(String.class);
        verify(statsService).recordPageView(any(), any(), any(), anyString(), anyString(),
                ipCaptor.capture(), any(), any(), anyString(), anyString(), anyString());

        assertEquals("203.0.113.5", ipCaptor.getValue());
        assertEquals("203.0.113.5", lead.getIpAddress());
        assertEquals(ipCaptor.getValue(), lead.getIpAddress());

        // 两个入口都经由同一解析器
        verify(resolver, times(2)).resolve(any());
    }

    private static MockHttpServletRequest proxyRequest() {
        MockHttpServletRequest req = new MockHttpServletRequest();
        req.setRemoteAddr("127.0.0.1");
        req.addHeader("X-Real-IP", "203.0.113.5");
        return req;
    }
}
