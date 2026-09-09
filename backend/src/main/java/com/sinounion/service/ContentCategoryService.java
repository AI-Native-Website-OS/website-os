package com.sinounion.service;

import com.sinounion.entity.ContentCategory;

import java.util.List;

public interface ContentCategoryService {
    List<ContentCategory> getCategories(String moduleKey);
    List<ContentCategory> getActive(String moduleKey);
    ContentCategory getById(Long id);
    ContentCategory create(ContentCategory category);
    ContentCategory update(Long id, ContentCategory category);
    void delete(Long id);
    void reorder(List<Long> ids);
}
