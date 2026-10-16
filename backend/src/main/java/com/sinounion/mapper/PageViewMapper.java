package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.PageView;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

@Mapper
public interface PageViewMapper extends BaseMapper<PageView> {

    @Select("SELECT COUNT(*) FROM page_views WHERE visit_time::date = CURRENT_DATE")
    Integer countTodayViews();

    @Select("SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE visit_time::date = CURRENT_DATE")
    Integer countTodayUniqueVisitors();

    /** 记录某访客最近一次页面访问的停留时长（秒） */
    @Update("UPDATE page_views SET duration = #{duration} WHERE id = (SELECT id FROM page_views WHERE visitor_id = #{visitorId} AND page_url = #{pageUrl} ORDER BY visit_time DESC, id DESC LIMIT 1)")
    int updateLastDuration(@Param("visitorId") String visitorId, @Param("pageUrl") String pageUrl, @Param("duration") Integer duration);

    @Select("SELECT COUNT(*) FROM page_views WHERE visit_time::date = CURRENT_DATE - INTERVAL '1 day'")
    Integer countYesterdayViews();

    @Select("SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE visit_time::date = CURRENT_DATE - INTERVAL '1 day'")
    Integer countYesterdayUniqueVisitors();

    @Select("SELECT pv.page_type, pv.page_id, pv.page_url, COUNT(*) as view_count, COALESCE(ROUND(AVG(NULLIF(pv.duration, 0))), 0) as avg_duration, MIN(cm.module_name) as module_name FROM page_views pv JOIN core_modules cm ON cm.module_key = pv.page_type AND cm.is_system = 0 AND cm.deleted = 0 WHERE pv.visit_time::date >= CURRENT_DATE - INTERVAL '7 days' GROUP BY pv.page_type, pv.page_id, pv.page_url ORDER BY COUNT(*) * COALESCE(AVG(NULLIF(pv.duration, 0)), 0) DESC, COUNT(*) DESC")
    List<Map<String, Object>> findTopPagesLast7Days();

    @Select("SELECT page_url, page_type, COUNT(*) as visits FROM page_views WHERE visit_time::date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY page_url, page_type ORDER BY visits DESC LIMIT 20")
    List<Map<String, Object>> findTopPageUrlsLast30Days();

    @Select("SELECT visitor_id, COUNT(*) as visit_count FROM page_views WHERE visit_time::date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY visitor_id ORDER BY visit_count DESC LIMIT 20")
    List<Map<String, Object>> findTopVisitorsLast30Days();

    @Select("SELECT pv.user_id, u.username, u.real_name, COUNT(*) as visit_count FROM page_views pv JOIN users u ON u.id = pv.user_id WHERE pv.user_id IS NOT NULL AND pv.visit_time::date >= CURRENT_DATE - INTERVAL '30 days' AND u.deleted = 0 GROUP BY pv.user_id, u.username, u.real_name ORDER BY visit_count DESC")
    List<Map<String, Object>> findTopUsersLast30Days();

    @Select("SELECT visit_time::date as date, COUNT(*) as \"pageViews\", COUNT(DISTINCT visitor_id) as \"uniqueVisitors\" FROM page_views WHERE visit_time >= CURRENT_DATE - INTERVAL '6 days' GROUP BY visit_time::date ORDER BY date")
    List<Map<String, Object>> findWeeklyTrend();

    @Select("SELECT visit_time::date as date, COUNT(*) as \"pageViews\", COUNT(DISTINCT visitor_id) as \"uniqueVisitors\" FROM page_views WHERE visit_time >= CURRENT_DATE - INTERVAL '29 days' GROUP BY visit_time::date ORDER BY date")
    List<Map<String, Object>> findTrafficTrend30Days();

    @Select("SELECT province AS name, COUNT(*) AS value FROM page_views WHERE province IS NOT NULL AND province <> '' GROUP BY province ORDER BY value DESC")
    List<Map<String, Object>> geoDistributionByProvince();

    @Select("SELECT country AS name, COUNT(*) AS value FROM page_views WHERE country IS NOT NULL AND country <> '' GROUP BY country ORDER BY value DESC")
    List<Map<String, Object>> geoDistributionByCountry();

    @Select("SELECT EXTRACT(HOUR FROM visit_time) as hour, COUNT(*) as visits, COUNT(DISTINCT visitor_id) as \"uniqueVisitors\" FROM page_views WHERE visit_time::date = CURRENT_DATE GROUP BY EXTRACT(HOUR FROM visit_time) ORDER BY hour")
    List<Map<String, Object>> findHourlyDistribution();

    @Select("SELECT EXTRACT(HOUR FROM visit_time) as hour, COUNT(*) as visits, COUNT(DISTINCT visitor_id) as \"uniqueVisitors\" FROM page_views WHERE visit_time::date = CURRENT_DATE - INTERVAL '1 day' GROUP BY EXTRACT(HOUR FROM visit_time) ORDER BY hour")
    List<Map<String, Object>> findHourlyDistributionYesterday();

    @Select("SELECT page_type as name, COUNT(*) as value FROM page_views WHERE visit_time >= CURRENT_DATE - INTERVAL '30 days' GROUP BY page_type ORDER BY value DESC")
    List<Map<String, Object>> findPageTypeDistribution();

    @Select("SELECT COUNT(*) FROM page_views")
    Long countTotalPageViews();

    @Select("SELECT visit_time::date as name, COUNT(*) as value FROM page_views WHERE visit_time >= CURRENT_DATE - INTERVAL '6 days' GROUP BY visit_time::date ORDER BY name")
    List<Map<String, Object>> findDailyViews();
}
