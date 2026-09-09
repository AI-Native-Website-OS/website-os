package com.sinounion.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfo;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.ContentItem;
import com.sinounion.mapper.ContentCategoryMapper;
import com.sinounion.mapper.ContentItemMapper;
import com.sinounion.service.impl.ContentItemServiceImpl;
import com.sinounion.util.SlugService;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContentItemServiceTest {

    @Mock
    private ContentItemMapper contentItemMapper;

    @Mock
    private ContentCategoryMapper contentCategoryMapper;

    @Mock
    private SlugService slugService;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private SeoSyncService seoSyncService;

    private ContentItemServiceImpl service;

    @BeforeAll
    static void initTableInfo() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""), ContentItem.class);
    }

    @BeforeEach
    void setUp() {
        service = new ContentItemServiceImpl(contentItemMapper, contentCategoryMapper, slugService, objectMapper, seoSyncService);
    }

    @Test
    void create_purgesSoftDeletedRowsWithSameKeyBeforeInsert() {
        ContentItem item = new ContentItem();
        item.setModuleKey("module");
        item.setSlug("news");
        item.setTitle("新闻");
        when(slugService.isLegacy(any())).thenReturn(false);
        when(contentItemMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);

        service.create(item);

        verify(contentItemMapper).purgeDeletedByModuleAndSlug("module", "news");
        verify(contentItemMapper).insert(item);
    }

    @Test
    void update_purgesSoftDeletedRowsWhenChangingSlug() {
        ContentItem existing = new ContentItem();
        existing.setId(1L);
        when(contentItemMapper.selectById(1L)).thenReturn(existing);
        when(slugService.isLegacy(any())).thenReturn(false);
        when(contentItemMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);

        ContentItem item = new ContentItem();
        item.setModuleKey("module");
        item.setSlug("new-slug");

        service.update(1L, item);

        verify(contentItemMapper).purgeDeletedByModuleAndSlug("module", "new-slug");
        verify(contentItemMapper).updateById(item);
    }
}
