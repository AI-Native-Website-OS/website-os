package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.ContentCategory;
import com.sinounion.entity.ContentItem;
import com.sinounion.mapper.ContentCategoryMapper;
import com.sinounion.mapper.ContentItemMapper;
import com.sinounion.service.ContentCategoryService;
import com.sinounion.util.SlugService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class ContentCategoryServiceImpl implements ContentCategoryService {

    private final ContentCategoryMapper contentCategoryMapper;
    private final ContentItemMapper contentItemMapper;
    private final SlugService slugService;

    @Override
    public List<ContentCategory> getCategories(String moduleKey) {
        return contentCategoryMapper.selectList(new LambdaQueryWrapper<ContentCategory>()
                .eq(ContentCategory::getModuleKey, moduleKey)
                .orderByAsc(ContentCategory::getSortOrder)
                .orderByAsc(ContentCategory::getId));
    }

    @Override
    public List<ContentCategory> getActive(String moduleKey) {
        return contentCategoryMapper.selectList(new LambdaQueryWrapper<ContentCategory>()
                .eq(ContentCategory::getModuleKey, moduleKey)
                .eq(ContentCategory::getStatus, 1)
                .orderByAsc(ContentCategory::getSortOrder)
                .orderByAsc(ContentCategory::getId));
    }

    @Override
    public ContentCategory getById(Long id) {
        return contentCategoryMapper.selectById(id);
    }

    @Override
    public ContentCategory create(ContentCategory category) {
        if (category.getStatus() == null) category.setStatus(1);
        if (category.getSortOrder() == null) category.setSortOrder(0);
        ensureSlug(category, null);
        contentCategoryMapper.purgeDeletedByModuleAndSlug(category.getModuleKey(), category.getSlug());
        LambdaQueryWrapper<ContentCategory> keyCheck = new LambdaQueryWrapper<>();
        keyCheck.eq(ContentCategory::getModuleKey, category.getModuleKey())
                .eq(ContentCategory::getSlug, category.getSlug());
        if (contentCategoryMapper.selectCount(keyCheck) > 0) {
            throw new BusinessException("分类标识已存在：" + category.getSlug());
        }
        contentCategoryMapper.insert(category);
        return category;
    }

    @Override
    public ContentCategory update(Long id, ContentCategory category) {
        ContentCategory existing = contentCategoryMapper.selectById(id);
        if (existing == null) throw new BusinessException("分类不存在");
        ensureSlug(category, id);
        contentCategoryMapper.purgeDeletedByModuleAndSlug(category.getModuleKey(), category.getSlug());
        LambdaQueryWrapper<ContentCategory> keyCheck = new LambdaQueryWrapper<>();
        keyCheck.eq(ContentCategory::getModuleKey, category.getModuleKey())
                .eq(ContentCategory::getSlug, category.getSlug())
                .ne(ContentCategory::getId, id);
        if (contentCategoryMapper.selectCount(keyCheck) > 0) {
            throw new BusinessException("分类标识已存在：" + category.getSlug());
        }
        category.setId(id);
        contentCategoryMapper.updateById(category);
        syncGroupName(id, category.getName());
        return category;
    }

    @Override
    public void delete(Long id) {
        ContentCategory existing = contentCategoryMapper.selectById(id);
        if (existing == null) return;
        contentItemMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<ContentItem>()
                .eq(ContentItem::getCategoryId, id)
                .set(ContentItem::getCategoryId, null)
                .set(ContentItem::getGroupName, null));
        contentCategoryMapper.deleteById(id);
    }

    @Override
    public void reorder(List<Long> ids) {
        IntStream.range(0, ids.size()).forEach(i -> {
            ContentCategory c = new ContentCategory();
            c.setId(ids.get(i));
            c.setSortOrder(i);
            contentCategoryMapper.updateById(c);
        });
    }

    private void ensureSlug(ContentCategory category, Long excludeId) {
        if (!slugService.isLegacy(category.getSlug())) {
            return;
        }
        String slug = slugService.uniqueSlug(category.getName(), candidate -> {
            LambdaQueryWrapper<ContentCategory> w = new LambdaQueryWrapper<>();
            w.eq(ContentCategory::getModuleKey, category.getModuleKey()).eq(ContentCategory::getSlug, candidate);
            if (excludeId != null) w.ne(ContentCategory::getId, excludeId);
            return contentCategoryMapper.selectCount(w) > 0;
        });
        category.setSlug(slug);
    }

    private void syncGroupName(Long categoryId, String name) {
        contentItemMapper.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<ContentItem>()
                .eq(ContentItem::getCategoryId, categoryId)
                .set(ContentItem::getGroupName, name));
    }
}
