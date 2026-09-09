package com.sinounion.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.entity.ForbiddenTopic;
import com.sinounion.entity.ForbiddenTopicExample;
import com.sinounion.mapper.ForbiddenTopicExampleMapper;
import com.sinounion.mapper.ForbiddenTopicMapper;
import com.sinounion.service.impl.ForbiddenQuestionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ForbiddenQuestionServiceTest {

    @Mock
    private ForbiddenTopicMapper topicMapper;

    @Mock
    private ForbiddenTopicExampleMapper exampleMapper;

    private ForbiddenQuestionService service;

    @BeforeEach
    void setUp() {
        service = new ForbiddenQuestionServiceImpl(topicMapper, exampleMapper);
    }

    @Test
    void createTopic_insertsAndReturns() {
        ForbiddenTopic topic = new ForbiddenTopic();
        topic.setName("测试主题");

        ForbiddenTopic result = service.createTopic(topic);

        verify(topicMapper).insert(topic);
        assertSame(topic, result);
    }

    @Test
    void updateTopic_updatesById() {
        ForbiddenTopic topic = new ForbiddenTopic();
        topic.setName("更新名");

        service.updateTopic(1L, topic);

        assertEquals(1L, topic.getId().longValue());
        verify(topicMapper).updateById(topic);
    }

    @Test
    void deleteTopic_deletesExamplesAndTopic() {
        service.deleteTopic(1L);

        verify(exampleMapper).delete(any(LambdaQueryWrapper.class));
        verify(topicMapper).deleteById(1L);
    }

    @Test
    void getTopicById_returnsTopic() {
        ForbiddenTopic topic = new ForbiddenTopic();
        topic.setId(1L);
        when(topicMapper.selectById(1L)).thenReturn(topic);

        ForbiddenTopic result = service.getTopicById(1L);

        assertSame(topic, result);
    }

    @Test
    void listAllTopics_returnsList() {
        List<ForbiddenTopic> list = Collections.singletonList(new ForbiddenTopic());
        when(topicMapper.selectList(null)).thenReturn(list);

        List<ForbiddenTopic> result = service.listAllTopics();

        assertSame(list, result);
    }

    @Test
    void listEnabledTopics_returnsEnabledOnly() {
        List<ForbiddenTopic> list = Collections.singletonList(new ForbiddenTopic());
        when(topicMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(list);

        List<ForbiddenTopic> result = service.listEnabledTopics();

        assertSame(list, result);
    }

    @Test
    void createExample_insertsAndReturns() {
        ForbiddenTopicExample example = new ForbiddenTopicExample();
        example.setContent("测试内容");

        ForbiddenTopicExample result = service.createExample(example);

        verify(exampleMapper).insert(example);
        assertSame(example, result);
    }

    @Test
    void updateExample_updatesById() {
        ForbiddenTopicExample example = new ForbiddenTopicExample();
        example.setContent("新内容");

        service.updateExample(1L, example);

        assertEquals(1L, example.getId().longValue());
        verify(exampleMapper).updateById(example);
    }

    @Test
    void deleteExample_deletesById() {
        service.deleteExample(1L);
        verify(exampleMapper).deleteById(1L);
    }

    @Test
    void listExamplesByTopicId_returnsExamples() {
        List<ForbiddenTopicExample> list = Collections.singletonList(new ForbiddenTopicExample());
        when(exampleMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(list);

        List<ForbiddenTopicExample> result = service.listExamplesByTopicId(1L);

        assertSame(list, result);
    }

    @Test
    void deleteExamplesByTopicId_usesWrapper() {
        service.deleteExamplesByTopicId(1L);
        verify(exampleMapper).delete(any(LambdaQueryWrapper.class));
    }

    @Test
    void getExampleById_returnsExample() {
        ForbiddenTopicExample example = new ForbiddenTopicExample();
        example.setId(1L);
        when(exampleMapper.selectById(1L)).thenReturn(example);

        ForbiddenTopicExample result = service.getExampleById(1L);

        assertSame(example, result);
    }

    @Test
    void listAllEnabledExamples_usesInSql() {
        List<ForbiddenTopicExample> list = Collections.singletonList(new ForbiddenTopicExample());
        when(exampleMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(list);

        List<ForbiddenTopicExample> result = service.listAllEnabledExamples();

        assertSame(list, result);
    }
}
