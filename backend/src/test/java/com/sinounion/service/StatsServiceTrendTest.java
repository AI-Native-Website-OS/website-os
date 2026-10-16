package com.sinounion.service;

import com.sinounion.mapper.ActivityTrendMapper;
import com.sinounion.mapper.AiChatMapper;
import com.sinounion.mapper.ContactSubmissionMapper;
import com.sinounion.mapper.ContentItemMapper;
import com.sinounion.mapper.LeadMapper;
import com.sinounion.mapper.PageViewMapper;
import com.sinounion.mapper.UserBehaviorMapper;
import com.sinounion.mapper.UserMapper;
import com.sinounion.service.impl.StatsServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatsServiceTrendTest {

    @Mock PageViewMapper pageViewMapper;
    @Mock UserBehaviorMapper behaviorMapper;
    @Mock LeadMapper leadMapper;
    @Mock ContentItemMapper contentItemMapper;
    @Mock ContactSubmissionMapper contactSubmissionMapper;
    @Mock UserMapper userMapper;
    @Mock AiChatMapper aiChatMapper;
    @Mock ActivityTrendMapper activityTrendMapper;

    @InjectMocks StatsServiceImpl statsService;

    private static Map<String, Object> row(String date, long pageViews, long uniqueVisitors) {
        Map<String, Object> m = new HashMap<>();
        m.put("date", date);
        m.put("pageViews", pageViews);
        m.put("uniqueVisitors", uniqueVisitors);
        return m;
    }

    private static List<Map<String, Object>> single(Map<String, Object> row) {
        List<Map<String, Object>> list = new ArrayList<>();
        list.add(row);
        return list;
    }

    /** 数据库只有「今天」一天数据时，7天应返回完整7天，缺失日期补 0。 */
    @Test
    void weeklyTrendAlwaysReturnsSevenDaysWithZeroFill() {
        when(pageViewMapper.findWeeklyTrend())
                .thenReturn(single(row(LocalDate.now().toString(), 10, 4)));

        List<Map<String, Object>> trend = statsService.getWeeklyTrend();

        assertEquals(7, trend.size());
        Map<String, Object> today = trend.get(6);
        assertEquals(LocalDate.now().toString(), today.get("date"));
        assertEquals(10L, today.get("pageViews"));
        assertEquals(4L, today.get("uniqueVisitors"));
        for (int i = 0; i < 6; i++) {
            assertEquals(0L, trend.get(i).get("pageViews"));
            assertEquals(0L, trend.get(i).get("uniqueVisitors"));
        }
        assertEquals(LocalDate.now().minusDays(6).toString(), trend.get(0).get("date"));
    }

    @Test
    void trafficTrend30dAlwaysReturnsThirtyDaysWithZeroFill() {
        when(pageViewMapper.findTrafficTrend30Days())
                .thenReturn(single(row(LocalDate.now().toString(), 7, 2)));

        List<Map<String, Object>> trend = statsService.getTrafficTrend30d();

        assertEquals(30, trend.size());
        assertEquals(LocalDate.now().minusDays(29).toString(), trend.get(0).get("date"));
        assertEquals(0L, trend.get(0).get("pageViews"));
        assertEquals(7L, trend.get(29).get("pageViews"));
        assertEquals(2L, trend.get(29).get("uniqueVisitors"));
    }

    /** 30天与7天即使数据不足也应呈现不同长度的序列。 */
    @Test
    void sevenDayAndThirtyDaySeriesDifferWhenDataIsScarce() {
        when(pageViewMapper.findWeeklyTrend()).thenReturn(Collections.<Map<String, Object>>emptyList());
        when(pageViewMapper.findTrafficTrend30Days()).thenReturn(Collections.<Map<String, Object>>emptyList());

        assertEquals(7, statsService.getWeeklyTrend().size());
        assertEquals(30, statsService.getTrafficTrend30d().size());
    }
}
