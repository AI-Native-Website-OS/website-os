package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.Partner;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PartnerMapper extends BaseMapper<Partner> {

    @Select("SELECT * FROM partners WHERE status = 1 ORDER BY sort_order")
    List<Partner> findAllActive();
}
