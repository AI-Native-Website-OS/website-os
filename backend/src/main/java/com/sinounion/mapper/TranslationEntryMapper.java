package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.TranslationEntry;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TranslationEntryMapper extends BaseMapper<TranslationEntry> {

    @Select("<script>"
        + "SELECT * FROM translation_entries WHERE locale = #{locale} AND resource_type = #{resourceType}"
        + " AND resource_id IN "
        + "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach>"
        + "</script>")
    List<TranslationEntry> selectByResourceIds(@Param("resourceType") String resourceType,
                                               @Param("ids") List<Long> ids,
                                               @Param("locale") String locale);

    @Select("<script>"
        + "SELECT * FROM translation_entries WHERE locale = #{locale}"
        + " AND (resource_type, resource_id) IN "
        + "<foreach collection='keys' item='k' open='(' separator=',' close=')'> (#{k.resourceType}, #{k.resourceId}) </foreach>"
        + "</script>")
    List<TranslationEntry> selectByKeys(@Param("keys") List<EntryKey> keys, @Param("locale") String locale);

    @Select("SELECT * FROM translation_entries WHERE locale = #{locale}")
    List<TranslationEntry> selectAllByLocale(@Param("locale") String locale);

    @Select("SELECT * FROM translation_entries WHERE locale = #{locale} AND resource_type = #{resourceType}")
    List<TranslationEntry> selectByTypeAndLocale(@Param("resourceType") String resourceType,
                                                 @Param("locale") String locale);

    class EntryKey {
        private String resourceType;
        private Long resourceId;

        public EntryKey() {}

        public EntryKey(String resourceType, Long resourceId) {
            this.resourceType = resourceType;
            this.resourceId = resourceId;
        }

        public String getResourceType() { return resourceType; }
        public void setResourceType(String resourceType) { this.resourceType = resourceType; }
        public Long getResourceId() { return resourceId; }
        public void setResourceId(Long resourceId) { this.resourceId = resourceId; }
    }
}
