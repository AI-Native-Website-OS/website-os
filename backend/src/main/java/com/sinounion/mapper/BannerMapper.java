package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.Banner;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface BannerMapper extends BaseMapper<Banner> {

    @Select("SELECT * FROM banners WHERE status = 1 ORDER BY sort_order")
    List<Banner> findAllActive();
}
