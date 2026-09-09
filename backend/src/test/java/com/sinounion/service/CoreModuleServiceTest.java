package com.sinounion.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfo;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.CoreModule;
import com.sinounion.mapper.CoreModuleMapper;
import com.sinounion.service.impl.CoreModuleServiceImpl;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CoreModuleServiceTest {

    @Mock
    private CoreModuleMapper coreModuleMapper;

    private CoreModuleServiceImpl service;

    @BeforeAll
    static void initTableInfo() {
        TableInfo tableInfo = TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""), CoreModule.class);
    }

    @BeforeEach
    void setUp() {
        service = new CoreModuleServiceImpl(coreModuleMapper);
    }

    @Test
    void create_purgesSoftDeletedRowsWithSameKeyBeforeInsert() {
        CoreModule module = new CoreModule();
        module.setModuleName("新闻");
        module.setModuleKey("module");
        when(coreModuleMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
        when(coreModuleMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);

        service.create(module);

        verify(coreModuleMapper).purgeDeletedByKey("module");
        verify(coreModuleMapper).insert(module);
    }

    @Test
    void create_throwsWhenActiveKeyExists() {
        CoreModule module = new CoreModule();
        module.setModuleKey("module");
        when(coreModuleMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
        when(coreModuleMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);

        assertThrows(BusinessException.class, () -> service.create(module));
        verify(coreModuleMapper, never()).insert(any());
    }

    @Test
    void update_purgesSoftDeletedRowsWhenChangingKey() {
        CoreModule existing = new CoreModule();
        existing.setId(1L);
        when(coreModuleMapper.selectById(1L)).thenReturn(existing);
        when(coreModuleMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);

        CoreModule module = new CoreModule();
        module.setModuleKey("new-module");

        service.update(1L, module);

        verify(coreModuleMapper).purgeDeletedByKey("new-module");
        verify(coreModuleMapper).updateById(module);
    }

    @Test
    void delete_softDeletesById() {
        service.delete(1L);
        verify(coreModuleMapper).deleteById(1L);
    }
}
