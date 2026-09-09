package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.ContentCategory;
import com.sinounion.entity.ContentItem;
import com.sinounion.mapper.ContentCategoryMapper;
import com.sinounion.mapper.ContentItemMapper;
import com.sinounion.service.ContentItemService;
import com.sinounion.service.SeoSyncService;
import com.sinounion.util.SlugService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContentItemServiceImpl implements ContentItemService {

    private final ContentItemMapper contentItemMapper;
    private final ContentCategoryMapper contentCategoryMapper;
    private final SlugService slugService;
    private final ObjectMapper objectMapper;
    private final SeoSyncService seoSyncService;

    @Override
    public Page<ContentItem> getItems(String moduleKey, int page, int size, String keyword, String group, Long categoryId, Integer status, Boolean top) {
        LambdaQueryWrapper<ContentItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ContentItem::getModuleKey, moduleKey);
        if (status != null) wrapper.eq(ContentItem::getStatus, status);
        if (categoryId != null) {
            if (categoryId == 0L) wrapper.isNull(ContentItem::getCategoryId);
            else wrapper.eq(ContentItem::getCategoryId, categoryId);
        }
        if (group != null && !group.isEmpty()) wrapper.eq(ContentItem::getGroupName, group);
        if (Boolean.TRUE.equals(top)) wrapper.eq(ContentItem::getIsTop, 1);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(ContentItem::getTitle, keyword)
                    .or().like(ContentItem::getSummary, keyword)
                    .or().like(ContentItem::getContent, keyword));
        }
        wrapper.orderByDesc(ContentItem::getIsTop).orderByAsc(ContentItem::getSortOrder).orderByDesc(ContentItem::getId);
        return contentItemMapper.selectPage(new Page<>(page, size), wrapper);
    }

    @Override
    public List<Map<String, String>> getGroups(String moduleKey) {
        return contentItemMapper.selectList(new LambdaQueryWrapper<ContentItem>()
                        .eq(ContentItem::getModuleKey, moduleKey)
                        .eq(ContentItem::getStatus, 1)
                        .isNotNull(ContentItem::getGroupName)
                        .ne(ContentItem::getGroupName, "")
                        .select(ContentItem::getGroupName))
                .stream().map(ContentItem::getGroupName).distinct()
                .map(value -> {
                    java.util.HashMap<String, String> m = new java.util.HashMap<>();
                    m.put("value", value);
                    m.put("slug", slugService.slugify(value));
                    return m;
                })
                .collect(Collectors.toList());
    }

    @Override
    public ContentItem getBySlug(String moduleKey, String slug) {
        return contentItemMapper.findByModuleAndSlug(moduleKey, slug);
    }

    @Override
    public ContentItem getById(Long id) {
        return contentItemMapper.selectById(id);
    }

    @Override
    public ContentItem create(ContentItem item) {
        syncGroupNameFromCategory(item);
        ensureSlug(item, null);
        contentItemMapper.purgeDeletedByModuleAndSlug(item.getModuleKey(), item.getSlug());
        LambdaQueryWrapper<ContentItem> keyCheck = new LambdaQueryWrapper<>();
        keyCheck.eq(ContentItem::getModuleKey, item.getModuleKey()).eq(ContentItem::getSlug, item.getSlug());
        if (contentItemMapper.selectCount(keyCheck) > 0) {
            throw new BusinessException("slug已存在：" + item.getSlug());
        }
        contentItemMapper.insert(item);
        seoSyncService.syncFromContent(item);
        return item;
    }

    @Override
    public ContentItem update(Long id, ContentItem item) {
        ContentItem existing = contentItemMapper.selectById(id);
        if (existing == null) return null;
        syncGroupNameFromCategory(item);
        ensureSlug(item, id);
        contentItemMapper.purgeDeletedByModuleAndSlug(item.getModuleKey(), item.getSlug());
        LambdaQueryWrapper<ContentItem> keyCheck = new LambdaQueryWrapper<>();
        keyCheck.eq(ContentItem::getModuleKey, item.getModuleKey())
                .eq(ContentItem::getSlug, item.getSlug())
                .ne(ContentItem::getId, id);
        if (contentItemMapper.selectCount(keyCheck) > 0) {
            throw new BusinessException("slug已存在：" + item.getSlug());
        }
        item.setId(id);
        contentItemMapper.updateById(item);
        seoSyncService.syncFromContent(item);
        return item;
    }

    @Override
    public void delete(Long id) {
        contentItemMapper.deleteById(id);
    }

    @Override
    public void batchDelete(List<Long> ids) {
        for (Long id : ids) contentItemMapper.deleteById(id);
    }

    @Override
    public void batchUpdateStatus(List<Long> ids, int status) {
        for (Long id : ids) {
            ContentItem item = new ContentItem();
            item.setId(id);
            item.setStatus(status);
            contentItemMapper.updateById(item);
        }
    }

    @Override
    public void incrementView(Long id) {
        contentItemMapper.update(null, new LambdaUpdateWrapper<ContentItem>()
                .eq(ContentItem::getId, id)
                .setSql("view_count = COALESCE(view_count, 0) + 1"));
    }

    @Override
    public List<ContentItem> listAllEnabled() {
        LambdaQueryWrapper<ContentItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ContentItem::getStatus, 1);
        return contentItemMapper.selectList(wrapper);
    }

    @Override
    public Map<String, List<ContentItem>> getRelations(String moduleKey, String slug) {
        ContentItem item = getBySlug(moduleKey, slug);
        if (item == null) return Collections.emptyMap();
        Map<String, List<Long>> relationIds = parseRelations(item.getExtraData());
        Map<String, List<ContentItem>> result = new LinkedHashMap<>();
        if (relationIds == null) return result;
        relationIds.forEach((key, ids) -> {
            if (ids == null || ids.isEmpty()) return;
            List<ContentItem> found = contentItemMapper.selectBatchIds(ids).stream()
                    .filter(c -> c.getStatus() != null && c.getStatus() == 1)
                    .collect(Collectors.toList());
            if (!found.isEmpty()) result.put(key, found);
        });
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, List<Long>> parseRelations(String extraData) {
        if (extraData == null || extraData.trim().isEmpty()) return null;
        try {
            Map<String, Object> root = objectMapper.readValue(extraData, Map.class);
            Object relations = root.get("relations");
            if (!(relations instanceof Map)) return null;
            Map<String, List<Long>> result = new LinkedHashMap<>();
            ((Map<String, Object>) relations).forEach((k, v) -> {
                if (v instanceof List) {
                    List<Long> ids = new ArrayList<>();
                    for (Object o : (List<Object>) v) {
                        if (o instanceof Number) ids.add(((Number) o).longValue());
                        else if (o instanceof String) {
                            try { ids.add(Long.valueOf((String) o)); } catch (NumberFormatException ignored) {}
                        }
                    }
                    result.put(k, ids);
                }
            });
            return result;
        } catch (Exception e) {
            return null;
        }
    }

    private void ensureSlug(ContentItem item, Long excludeId) {
        if (!slugService.isLegacy(item.getSlug())) {
            return;
        }
        String slug = slugService.uniqueSlug(item.getTitle(), candidate -> {
            LambdaQueryWrapper<ContentItem> w = new LambdaQueryWrapper<>();
            w.eq(ContentItem::getModuleKey, item.getModuleKey()).eq(ContentItem::getSlug, candidate);
            if (excludeId != null) w.ne(ContentItem::getId, excludeId);
            return contentItemMapper.selectCount(w) > 0;
        });
        item.setSlug(slug);
    }

    private void syncGroupNameFromCategory(ContentItem item) {
        if (item.getCategoryId() == null) return;
        ContentCategory category = contentCategoryMapper.selectById(item.getCategoryId());
        if (category != null) {
            item.setGroupName(category.getName());
        }
    }
}
