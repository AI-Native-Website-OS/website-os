package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.entity.ForbiddenTopic;
import com.sinounion.entity.ForbiddenTopicExample;
import com.sinounion.mapper.ForbiddenTopicExampleMapper;
import com.sinounion.mapper.ForbiddenTopicMapper;
import com.sinounion.service.ForbiddenQuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ForbiddenQuestionServiceImpl implements ForbiddenQuestionService {

    private final ForbiddenTopicMapper topicMapper;
    private final ForbiddenTopicExampleMapper exampleMapper;

    // ── Topic CRUD ─────────────────────────────────────────

    @Override
    public ForbiddenTopic createTopic(ForbiddenTopic topic) {
        topicMapper.insert(topic);
        return topic;
    }

    @Override
    public ForbiddenTopic updateTopic(Long id, ForbiddenTopic topic) {
        topic.setId(id);
        topicMapper.updateById(topic);
        return topic;
    }

    @Override
    @Transactional
    public void deleteTopic(Long id) {
        exampleMapper.delete(
            new LambdaQueryWrapper<ForbiddenTopicExample>()
                .eq(ForbiddenTopicExample::getTopicId, id)
        );
        topicMapper.deleteById(id);
    }

    @Override
    public ForbiddenTopic getTopicById(Long id) {
        return topicMapper.selectById(id);
    }

    @Override
    public List<ForbiddenTopic> listAllTopics() {
        return topicMapper.selectList(null);
    }

    @Override
    public List<ForbiddenTopic> listEnabledTopics() {
        return topicMapper.selectList(
            new LambdaQueryWrapper<ForbiddenTopic>()
                .eq(ForbiddenTopic::getEnabled, true)
        );
    }

    // ── Example CRUD ───────────────────────────────────────

    @Override
    public ForbiddenTopicExample createExample(ForbiddenTopicExample example) {
        exampleMapper.insert(example);
        return example;
    }

    @Override
    public ForbiddenTopicExample updateExample(Long id, ForbiddenTopicExample example) {
        example.setId(id);
        example.setUpdatedAt(java.time.LocalDateTime.now());
        exampleMapper.updateById(example);
        return example;
    }

    @Override
    public void deleteExample(Long id) {
        exampleMapper.deleteById(id);
    }

    @Override
    public void deleteExamplesByTopicId(Long topicId) {
        exampleMapper.delete(
            new LambdaQueryWrapper<ForbiddenTopicExample>()
                .eq(ForbiddenTopicExample::getTopicId, topicId)
        );
    }

    @Override
    public ForbiddenTopicExample getExampleById(Long id) {
        return exampleMapper.selectById(id);
    }

    @Override
    public List<ForbiddenTopicExample> listExamplesByTopicId(Long topicId) {
        return exampleMapper.selectList(
            new LambdaQueryWrapper<ForbiddenTopicExample>()
                .eq(ForbiddenTopicExample::getTopicId, topicId)
        );
    }

    @Override
    public List<ForbiddenTopicExample> listAllEnabledExamples() {
        return exampleMapper.selectList(
            new LambdaQueryWrapper<ForbiddenTopicExample>()
                .inSql(ForbiddenTopicExample::getTopicId,
                    "SELECT id FROM forbidden_topics WHERE enabled = true")
        );
    }
}
