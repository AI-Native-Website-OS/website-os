package com.sinounion.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * AI 会话/消息统计（表由 Python AI 服务管理，与后端共用同一 PostgreSQL）。
 */
@Mapper
public interface AiChatMapper {

    @Select("SELECT COUNT(*) FROM ai_message WHERE role = 'user' AND to_timestamp(timestamp)::date = CURRENT_DATE")
    Integer countTodayUserMessages();

    @Select("SELECT COUNT(*) FROM ai_message WHERE role = 'user' AND to_timestamp(timestamp)::date = CURRENT_DATE - INTERVAL '1 day'")
    Integer countYesterdayUserMessages();
}
