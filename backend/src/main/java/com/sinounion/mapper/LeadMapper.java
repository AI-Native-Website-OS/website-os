package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.Lead;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;
import java.util.Map;

@Mapper
public interface LeadMapper extends BaseMapper<Lead> {

    @Select("SELECT * FROM leads WHERE phone = #{phone} AND source = #{source}")
    Lead findByPhoneAndSource(String phone, String source);

    @Select("SELECT * FROM leads WHERE email = #{email} AND source = #{source}")
    Lead findByEmailAndSource(String email, String source);

    @Select("SELECT * FROM leads WHERE source_page = #{sourcePage} AND status = 'new' " +
            "AND (ip_address = #{ip} OR phone = #{phone} OR email = #{email}) LIMIT 1")
    Lead findDuplicateBySourcePageUnhandled(String sourcePage, String ip, String phone, String email);

    @Select("SELECT * FROM leads WHERE phone = #{phone}")
    List<Lead> findByPhone(String phone);

    @Select("SELECT * FROM leads WHERE email = #{email}")
    List<Lead> findByEmail(String email);

    @Select("SELECT COUNT(*) FROM leads WHERE created_at::date = CURRENT_DATE")
    Integer countTodayLeads();

    @Select("SELECT COALESCE(source, '未知') as name, COUNT(*) as value FROM leads GROUP BY source ORDER BY value DESC")
    List<Map<String, Object>> findLeadSources();

    @Select("SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as leads FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '5 months' GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month")
    List<Map<String, Object>> findMonthlyLeadTrend();

    @Select("SELECT phone FROM leads WHERE phone IS NOT NULL AND TRIM(phone) != '' GROUP BY phone HAVING COUNT(*) > 1 ORDER BY phone")
    List<String> findDuplicatePhones();

    @Select("SELECT name FROM leads WHERE name IS NOT NULL AND TRIM(name) != '' GROUP BY name HAVING COUNT(*) > 1 ORDER BY name")
    List<String> findDuplicateNames();

    @Select("SELECT company FROM leads WHERE company IS NOT NULL AND TRIM(company) != '' GROUP BY company HAVING COUNT(*) > 1 ORDER BY company")
    List<String> findDuplicateCompanies();
}
