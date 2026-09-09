package com.sinounion.service;

import com.sinounion.entity.ForbiddenTopic;
import com.sinounion.entity.ForbiddenTopicExample;

import java.util.List;

public interface ForbiddenQuestionService {

    // ── Topic CRUD ─────────────────────────────────────────
    ForbiddenTopic createTopic(ForbiddenTopic topic);

    ForbiddenTopic updateTopic(Long id, ForbiddenTopic topic);

    void deleteTopic(Long id);

    ForbiddenTopic getTopicById(Long id);

    List<ForbiddenTopic> listAllTopics();

    List<ForbiddenTopic> listEnabledTopics();

    // ── Example CRUD ───────────────────────────────────────
    ForbiddenTopicExample createExample(ForbiddenTopicExample example);

    ForbiddenTopicExample updateExample(Long id, ForbiddenTopicExample example);

    void deleteExample(Long id);

    void deleteExamplesByTopicId(Long topicId);

    ForbiddenTopicExample getExampleById(Long id);

    List<ForbiddenTopicExample> listExamplesByTopicId(Long topicId);

    List<ForbiddenTopicExample> listAllEnabledExamples();
}
