package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.LeadActivity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface LeadActivityMapper extends BaseMapper<LeadActivity> {

    @Select("SELECT * FROM lead_activities WHERE lead_id = #{leadId} ORDER BY created_at DESC")
    List<LeadActivity> findByLeadId(Long leadId);

    @Update({
            "<script>",
            "UPDATE lead_activities SET lead_id = #{targetId}",
            "WHERE lead_id IN",
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>",
            "</script>"
    })
    void migrateToLead(@Param("targetId") Long targetId, @Param("ids") List<Long> ids);
}
