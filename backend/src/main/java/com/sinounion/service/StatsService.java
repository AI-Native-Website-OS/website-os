package com.sinounion.service;

import com.sinounion.vo.DashboardStatsVO;
import java.util.List;
import java.util.Map;

public interface StatsService {
    DashboardStatsVO getDashboardStats();
    void recordPageView(String pageType, Long pageId, Long userId, String pageUrl, String visitorId, String ipAddress, String userAgent, String referer, String country, String province, String city);
    void updatePageDuration(String visitorId, String pageUrl, Integer duration);
    Long getUserIdByUsername(String username);
    void recordBehavior(String visitorId, String behaviorType, String targetType, Long targetId, String metadata);

    List<Map<String, Object>> getWeeklyTrend();
    List<Map<String, Object>> getTrafficTrend30d();
    List<Map<String, Object>> getActivityTrend(String range);
    List<Map<String, Object>> getHourlyDistribution();
    List<Map<String, Object>> getHourlyDistributionYesterday();
    List<Map<String, Object>> getGeoDistribution(String scope, String source);
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
