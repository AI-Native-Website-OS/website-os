package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.TranslationJob;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface TranslationJobMapper extends BaseMapper<TranslationJob> {

    /** 幂等入队：同源同 kind 已存在则跳过。 */
    @Insert("INSERT INTO translation_jobs "
        + "(resource_type, resource_id, field, locale, source_hash, source_text, kind, status, attempts) "
        + "VALUES (#{resourceType}, #{resourceId}, #{field}, #{locale}, #{sourceHash}, #{sourceText}, #{kind}, 'pending', 0) "
        + "ON CONFLICT (resource_type, resource_id, field, locale, source_hash, kind) DO NOTHING")
    int enqueue(@Param("resourceType") String resourceType,
                @Param("resourceId") Long resourceId,
                @Param("field") String field,
                @Param("locale") String locale,
                @Param("sourceHash") String sourceHash,
                @Param("sourceText") String sourceText,
                @Param("kind") String kind);
}
