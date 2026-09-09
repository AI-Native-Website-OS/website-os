package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.PageView;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

@Mapper
public interface PageViewMapper extends BaseMapper<PageView> {

    @Select("SELECT COUNT(*) FROM page_views WHERE visit_time::date = CURRENT_DATE")
    Integer countTodayViews();

    @Select("SELECT COUNT(DISTINCT visitor_id) FROM page_views WHERE visit_time::date = CURRENT_DATE")
    Integer countTodayUniqueVisitors();

    @Select("SELECT page_type, page_id, page_url, COUNT(*) as view_count FROM page_views WHERE visit_time::date >= CURRENT_DATE - INTERVAL '7 days' AND page_type IN ('product', 'solution', 'case', 'resource') GROUP BY page_type, page_id, page_url ORDER BY view_count DESC LIMIT 10")
    List<Map<String, Object>> findTopPagesLast7Days();

    @Select("SELECT page_url, page_type, COUNT(*) as visits FROM page_views WHERE visit_time::date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY page_url, page_type ORDER BY visits DESC LIMIT 20")
    List<Map<String, Object>> findTopPageUrlsLast30Days();

    @Select("SELECT visitor_id, COUNT(*) as visit_count FROM page_views WHERE visit_time::date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY visitor_id ORDER BY visit_count DESC LIMIT 20")
    List<Map<String, Object>> findTopVisitorsLast30Days();

    @Select("SELECT pv.user_id, u.username, u.real_name, COUNT(*) as visit_count FROM page_views pv JOIN users u ON u.id = pv.user_id WHERE pv.user_id IS NOT NULL AND pv.visit_time::date >= CURRENT_DATE - INTERVAL '30 days' AND u.deleted = 0 GROUP BY pv.user_id, u.username, u.real_name ORDER BY visit_count DESC")
    List<Map<String, Object>> findTopUsersLast30Days();

    @Select("SELECT visit_time::date as date, COUNT(*) as \"pageViews\", COUNT(DISTINCT visitor_id) as \"uniqueVisitors\" FROM page_views WHERE visit_time >= CURRENT_DATE - INTERVAL '6 days' GROUP BY visit_time::date ORDER BY date")
    List<Map<String, Object>> findWeeklyTrend();

    @Select("SELECT EXTRACT(HOUR FROM visit_time) as hour, COUNT(*) as visits FROM page_views WHERE visit_time::date = CURRENT_DATE GROUP BY EXTRACT(HOUR FROM visit_time) ORDER BY hour")
    List<Map<String, Object>> findHourlyDistribution();

    @Select("SELECT page_type as name, COUNT(*) as value FROM page_views WHERE visit_time >= CURRENT_DATE - INTERVAL '30 days' GROUP BY page_type ORDER BY value DESC")
    List<Map<String, Object>> findPageTypeDistribution();

    @Select("SELECT COUNT(*) FROM page_views")
    Long countTotalPageViews();

    @Select("SELECT visit_time::date as name, COUNT(*) as value FROM page_views WHERE visit_time >= CURRENT_DATE - INTERVAL '6 days' GROUP BY visit_time::date ORDER BY name")
    List<Map<String, Object>> findDailyViews();
}
