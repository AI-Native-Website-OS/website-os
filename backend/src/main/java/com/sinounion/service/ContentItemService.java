package com.sinounion.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.entity.ContentItem;

import java.util.List;
import java.util.Map;

public interface ContentItemService {
    Page<ContentItem> getItems(String moduleKey, int page, int size, String keyword, String group, Long categoryId, Integer status, Boolean top);
    List<Map<String, String>> getGroups(String moduleKey);
    ContentItem getBySlug(String moduleKey, String slug);
    ContentItem getById(Long id);
    ContentItem create(ContentItem item);
    ContentItem update(Long id, ContentItem item);
    void delete(Long id);
    void batchDelete(List<Long> ids);
    void batchUpdateStatus(List<Long> ids, int status);
    void incrementView(Long id);
    List<ContentItem> listAllEnabled();
    Map<String, List<ContentItem>> getRelations(String moduleKey, String slug);
}
