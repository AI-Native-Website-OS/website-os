package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.ContentItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ContentItemMapper extends BaseMapper<ContentItem> {

    @Delete("DELETE FROM content_items WHERE module_key = #{moduleKey} AND slug = #{slug} AND deleted = 1")
    int purgeDeletedByModuleAndSlug(@Param("moduleKey") String moduleKey, @Param("slug") String slug);

    @Select("SELECT * FROM content_items WHERE module_key = #{moduleKey} AND slug = #{slug} AND deleted = 0 LIMIT 1")
    ContentItem findByModuleAndSlug(@Param("moduleKey") String moduleKey, @Param("slug") String slug);

    @Select("SELECT COALESCE(SUM(view_count), 0) FROM content_items WHERE module_key = #{moduleKey} AND deleted = 0")
    Long sumViewCount(@Param("moduleKey") String moduleKey);

    @Select("SELECT * FROM content_items WHERE module_key = #{moduleKey} AND deleted = 0 ORDER BY sort_order ASC, id DESC")
    java.util.List<ContentItem> listEnabledByModule(@Param("moduleKey") String moduleKey);
}
