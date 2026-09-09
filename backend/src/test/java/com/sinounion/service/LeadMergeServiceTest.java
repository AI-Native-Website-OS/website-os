package com.sinounion.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.Lead;
import com.sinounion.entity.LeadActivity;
import com.sinounion.mapper.LeadActivityMapper;
import com.sinounion.mapper.LeadMapper;
import com.sinounion.service.impl.LeadServiceImpl;
import com.sinounion.vo.DuplicateGroupVO;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LeadMergeServiceTest {

    @Mock
    private LeadMapper leadMapper;

    @Mock
    private LeadActivityMapper activityMapper;

    private LeadServiceImpl service;

    @BeforeAll
    static void initTableInfo() {
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""), Lead.class);
        TableInfoHelper.initTableInfo(
                new MapperBuilderAssistant(new MybatisConfiguration(), ""), LeadActivity.class);
    }

    @BeforeEach
    void setUp() {
        service = new LeadServiceImpl(leadMapper, activityMapper);
    }

    @Test
    void getDuplicateGroups_phoneCondition_returnsGroups() {
        when(leadMapper.findDuplicatePhones()).thenReturn(Arrays.asList("13800000001"));
        when(leadMapper.selectList(any())).thenReturn(Arrays.asList(new Lead(), new Lead()));

        List<DuplicateGroupVO> groups = service.getDuplicateGroups("phone");

        assertEquals(1, groups.size());
        assertEquals("13800000001", groups.get(0).getKey());
        verify(leadMapper, never()).findDuplicateNames();
        verify(leadMapper, never()).findDuplicateCompanies();
    }

    @Test
    void getDuplicateGroups_invalidCondition_throws() {
        assertThrows(BusinessException.class, () -> service.getDuplicateGroups("bad"));
    }

    @Test
    void mergeLeads_backfillsEmptyFieldsAndMigratesActivities() {
        Lead primary = new Lead();
        primary.setId(1L);
        primary.setName("张三");
        primary.setScore(60);

        Lead dup = new Lead();
        dup.setId(2L);
        dup.setCompany("圣诺联合");
        dup.setPhone("13800000001");
        dup.setScore(80);

        when(leadMapper.selectById(1L)).thenReturn(primary);
        when(leadMapper.selectBatchIds(anyList())).thenReturn(Collections.singletonList(dup));

        Lead result = service.mergeLeads(1L, Collections.singletonList(2L), "phone", 99L);

        assertEquals("圣诺联合", result.getCompany());
        assertEquals("13800000001", result.getPhone());
        assertEquals("张三", result.getName());
        assertEquals(80, result.getScore());
        verify(activityMapper).migrateToLead(1L, Collections.singletonList(2L));
        verify(activityMapper).insert(any(LeadActivity.class));
        verify(leadMapper).deleteBatchIds(Collections.singletonList(2L));
    }

    @Test
    void mergeLeads_rejectsMergingPrimaryIntoItself() {
        assertThrows(BusinessException.class,
                () -> service.mergeLeads(1L, Arrays.asList(1L, 2L), "phone", null));
    }

    @Test
    void mergeLeads_rejectsUnknownIds() {
        Lead primary = new Lead();
        primary.setId(1L);
        when(leadMapper.selectById(1L)).thenReturn(primary);
        when(leadMapper.selectBatchIds(anyList())).thenReturn(Collections.singletonList(new Lead()));
        assertThrows(BusinessException.class,
                () -> service.mergeLeads(1L, Arrays.asList(2L, 3L), "phone", null));
    }
}
