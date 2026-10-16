package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.UserBehavior;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.Map;

@Mapper
public interface UserBehaviorMapper extends BaseMapper<UserBehavior> {

    @Select("SELECT COUNT(*) FROM user_behaviors WHERE behavior_type = #{type} AND created_at::date = CURRENT_DATE")
    Integer countBehaviorToday(@Param("type") String type);

    @Select("SELECT COUNT(*) FROM user_behaviors WHERE behavior_type = #{type} AND created_at::date = CURRENT_DATE - INTERVAL '1 day'")
    Integer countBehaviorYesterday(@Param("type") String type);

    @Select("SELECT source, COUNT(*) as count FROM leads WHERE created_at::date = CURRENT_DATE GROUP BY source")
    Map<String, Integer> countTodayLeadSources();
}
