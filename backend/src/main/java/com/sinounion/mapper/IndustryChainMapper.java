package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.IndustryChain;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface IndustryChainMapper extends BaseMapper<IndustryChain> {

    @Select("SELECT * FROM industry_chains WHERE parent_id = #{parentId} AND status = 1 ORDER BY sort_order")
    List<IndustryChain> findByParentId(Long parentId);

    @Select("SELECT * FROM industry_chains WHERE parent_id = 0 AND status = 1 ORDER BY sort_order")
    List<IndustryChain> findRootChains();
}
