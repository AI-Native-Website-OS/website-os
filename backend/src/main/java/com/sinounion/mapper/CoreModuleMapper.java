package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.CoreModule;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface CoreModuleMapper extends BaseMapper<CoreModule> {

    @Delete("DELETE FROM core_modules WHERE module_key = #{moduleKey} AND deleted = 1")
    int purgeDeletedByKey(@Param("moduleKey") String moduleKey);
}
