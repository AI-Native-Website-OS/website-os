package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.UserBehavior;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.Map;

@Mapper
public interface UserBehaviorMapper extends BaseMapper<UserBehavior> {

    @Select("SELECT behavior_type, COUNT(*) as count FROM user_behaviors WHERE created_at::date = CURRENT_DATE GROUP BY behavior_type")
    Map<String, Integer> countTodayBehaviors();

    @Select("SELECT source, COUNT(*) as count FROM leads WHERE created_at::date = CURRENT_DATE GROUP BY source")
    Map<String, Integer> countTodayLeadSources();
}
