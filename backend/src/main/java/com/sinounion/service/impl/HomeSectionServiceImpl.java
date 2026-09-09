package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.HomeSection;
import com.sinounion.mapper.HomeSectionMapper;
import com.sinounion.service.HomeSectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class HomeSectionServiceImpl implements HomeSectionService {

    private final HomeSectionMapper mapper;

    @Override
    public HomeSection create(HomeSection section) {
        LambdaQueryWrapper<HomeSection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(HomeSection::getTitle, section.getTitle());
        if (mapper.selectCount(wrapper) > 0) {
            throw new BusinessException("首页区块标题已存在：" + section.getTitle());
        }
        mapper.insert(section);
        return section;
    }

    @Override
    public HomeSection update(Long id, HomeSection section) {
        LambdaQueryWrapper<HomeSection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(HomeSection::getTitle, section.getTitle()).ne(HomeSection::getId, id);
        if (mapper.selectCount(wrapper) > 0) {
            throw new BusinessException("首页区块标题已存在：" + section.getTitle());
        }
        section.setId(id);
        mapper.updateById(section);
        return section;
    }

    @Override
    public void delete(Long id) {
        mapper.deleteById(id);
    }

    @Override
    public HomeSection getById(Long id) {
        return mapper.selectById(id);
    }

    @Override
    public List<HomeSection> getAll() {
        LambdaQueryWrapper<HomeSection> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(HomeSection::getSortOrder);
        return mapper.selectList(wrapper);
    }

    @Override
    public List<HomeSection> getActive() {
        LambdaQueryWrapper<HomeSection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(HomeSection::getStatus, 1).orderByAsc(HomeSection::getSortOrder);
        return mapper.selectList(wrapper);
    }

    @Override
    public void reorder(List<Long> ids) {
        IntStream.range(0, ids.size()).forEach(i -> {
            HomeSection s = new HomeSection();
            s.setId(ids.get(i));
            s.setSortOrder(i);
            mapper.updateById(s);
        });
    }
}
