package com.sinounion.service;

import com.sinounion.entity.HomeSection;

import java.util.List;

public interface HomeSectionService {
    HomeSection create(HomeSection section);
    HomeSection update(Long id, HomeSection section);
    void delete(Long id);
    HomeSection getById(Long id);
    List<HomeSection> getAll();
    List<HomeSection> getActive();
    void reorder(List<Long> ids);
}
