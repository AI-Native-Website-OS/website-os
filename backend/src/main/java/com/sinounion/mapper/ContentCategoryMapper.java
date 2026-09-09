package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.ContentCategory;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface ContentCategoryMapper extends BaseMapper<ContentCategory> {

    @Delete("DELETE FROM content_categories WHERE module_key = #{moduleKey} AND slug = #{slug} AND deleted = 1")
    int purgeDeletedByModuleAndSlug(@Param("moduleKey") String moduleKey, @Param("slug") String slug);
}
