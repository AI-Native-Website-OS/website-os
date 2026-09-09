package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.ContactInfo;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ContactInfoMapper extends BaseMapper<ContactInfo> {

    @Select("SELECT * FROM contacts ORDER BY sort_order, id")
    List<ContactInfo> findAllOrdered();
}
