package com.sinounion.service;

import com.sinounion.entity.AboutSection;

import java.util.List;

public interface AboutSectionService {
    AboutSection create(AboutSection section);
    AboutSection update(Long id, AboutSection section);
    void delete(Long id);
    AboutSection getById(Long id);
    List<AboutSection> getAll();
    List<AboutSection> getActive();
    void reorder(List<Long> ids);
}
