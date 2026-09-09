package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.Faq;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface FaqMapper extends BaseMapper<Faq> {

    @Select("SELECT * FROM faqs WHERE category = #{category} AND status = 1 AND deleted = 0 ORDER BY sort_order")
    List<Faq> findByCategory(String category);

    @Select("SELECT * FROM faqs WHERE product_id = #{productId} AND status = 1 AND deleted = 0 ORDER BY sort_order")
    List<Faq> findByProductId(Long productId);
}
