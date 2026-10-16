package com.sinounion.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 访问趋势的活跃指标：线索 / 下载 / AI 对话。
 * 支持按天（近 N 天）与按小时（某一天）两种粒度。
 */
@Mapper
public interface ActivityTrendMapper {

    // ── 按天 ──────────────────────────────────────────────

    @Select("SELECT created_at::date AS d, COUNT(*) AS c FROM leads WHERE created_at::date >= #{since} GROUP BY created_at::date ORDER BY d")
    List<Map<String, Object>> dailyLeads(@Param("since") LocalDate since);

    @Select("SELECT created_at::date AS d, COUNT(*) AS c FROM user_behaviors WHERE behavior_type = 'download' AND created_at::date >= #{since} GROUP BY created_at::date ORDER BY d")
    List<Map<String, Object>> dailyDownloads(@Param("since") LocalDate since);

    @Select("SELECT to_timestamp(timestamp)::date AS d, COUNT(*) AS c FROM ai_message WHERE role = 'user' AND to_timestamp(timestamp)::date >= #{since} GROUP BY to_timestamp(timestamp)::date ORDER BY d")
    List<Map<String, Object>> dailyAiChats(@Param("since") LocalDate since);

    // ── 按小时 ────────────────────────────────────────────

    @Select("SELECT EXTRACT(HOUR FROM created_at) AS h, COUNT(*) AS c FROM leads WHERE created_at::date = #{day} GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY h")
    List<Map<String, Object>> hourlyLeads(@Param("day") LocalDate day);

    @Select("SELECT EXTRACT(HOUR FROM created_at) AS h, COUNT(*) AS c FROM user_behaviors WHERE behavior_type = 'download' AND created_at::date = #{day} GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY h")
    List<Map<String, Object>> hourlyDownloads(@Param("day") LocalDate day);

    @Select("SELECT EXTRACT(HOUR FROM to_timestamp(timestamp)) AS h, COUNT(*) AS c FROM ai_message WHERE role = 'user' AND to_timestamp(timestamp)::date = #{day} GROUP BY EXTRACT(HOUR FROM to_timestamp(timestamp)) ORDER BY h")
    List<Map<String, Object>> hourlyAiChats(@Param("day") LocalDate day);
}
