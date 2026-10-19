package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.UserNoticeDismissal;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserNoticeDismissalMapper extends BaseMapper<UserNoticeDismissal> {

    @Select("SELECT notice_id FROM user_notice_dismissals WHERE user_id = #{userId}")
    List<String> findNoticeIdsByUserId(@Param("userId") Long userId);

    @Insert("INSERT INTO user_notice_dismissals(user_id, notice_id) VALUES(#{userId}, #{noticeId}) "
            + "ON CONFLICT (user_id, notice_id) DO NOTHING")
    int insertIfAbsent(@Param("userId") Long userId, @Param("noticeId") String noticeId);
}
