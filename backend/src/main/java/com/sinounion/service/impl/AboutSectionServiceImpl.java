package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.AboutSection;
import com.sinounion.mapper.AboutSectionMapper;
import com.sinounion.service.AboutSectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class AboutSectionServiceImpl implements AboutSectionService {

    private final AboutSectionMapper mapper;

    @Override
    public AboutSection create(AboutSection section) {
        LambdaQueryWrapper<AboutSection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AboutSection::getTitle, section.getTitle());
        if (mapper.selectCount(wrapper) > 0) {
            throw new BusinessException("关于区块标题已存在：" + section.getTitle());
        }
        mapper.insert(section);
        return section;
    }

    @Override
    public AboutSection update(Long id, AboutSection section) {
        LambdaQueryWrapper<AboutSection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AboutSection::getTitle, section.getTitle()).ne(AboutSection::getId, id);
        if (mapper.selectCount(wrapper) > 0) {
            throw new BusinessException("关于区块标题已存在：" + section.getTitle());
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
    public AboutSection getById(Long id) {
        return mapper.selectById(id);
    }

    @Override
    public List<AboutSection> getAll() {
        LambdaQueryWrapper<AboutSection> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(AboutSection::getSortOrder);
        return mapper.selectList(wrapper);
    }

    @Override
    public List<AboutSection> getActive() {
        LambdaQueryWrapper<AboutSection> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AboutSection::getStatus, 1).orderByAsc(AboutSection::getSortOrder);
        return mapper.selectList(wrapper);
    }

    @Override
    public void reorder(List<Long> ids) {
        IntStream.range(0, ids.size()).forEach(i -> {
            AboutSection s = new AboutSection();
            s.setId(ids.get(i));
            s.setSortOrder(i);
            mapper.updateById(s);
        });
    }
}
