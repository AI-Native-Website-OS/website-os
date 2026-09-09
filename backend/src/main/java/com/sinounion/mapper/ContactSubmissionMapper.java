package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.ContactSubmission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;
import java.util.Map;

@Mapper
public interface ContactSubmissionMapper extends BaseMapper<ContactSubmission> {

    @Select("SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as submits FROM contact_submissions WHERE created_at >= CURRENT_DATE - INTERVAL '5 months' GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month")
    List<Map<String, Object>> findMonthlySubmissionTrend();

    @Select("SELECT COUNT(*) FROM contact_submissions WHERE created_at::date = CURRENT_DATE")
    Integer countTodaySubmissions();
}
