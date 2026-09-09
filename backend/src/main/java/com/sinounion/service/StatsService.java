package com.sinounion.service;

import com.sinounion.vo.DashboardStatsVO;
import java.util.List;
import java.util.Map;

public interface StatsService {
    DashboardStatsVO getDashboardStats();
    void recordPageView(String pageType, Long pageId, Long userId, String pageUrl, String visitorId, String ipAddress, String userAgent, String referer);
    Long getUserIdByUsername(String username);
    void recordBehavior(String visitorId, String behaviorType, String targetType, Long targetId, String metadata);

    List<Map<String, Object>> getWeeklyTrend();
    List<Map<String, Object>> getHourlyDistribution();
    List<Map<String, Object>> getPageTypeDistribution();
    List<Map<String, Object>> getPageUrlDistribution();
    List<Map<String, Object>> getDailyViews();
    List<Map<String, Object>> getLeadSources();
    List<Map<String, Object>> getMonthlyLeadTrend();
    List<Map<String, Object>> getMonthlySubmissionTrend();
    List<Map<String, Object>> getWeeklyChatTrend();
    List<Map<String, Object>> getContentCategories();
    List<Map<String, Object>> getConversionFunnel();
    Map<String, Object> getLeadPipeline();
}
