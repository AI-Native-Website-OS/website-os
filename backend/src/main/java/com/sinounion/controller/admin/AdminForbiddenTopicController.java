package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.entity.ForbiddenTopic;
import com.sinounion.entity.ForbiddenTopicExample;
import com.sinounion.service.ForbiddenQuestionDetector;
import com.sinounion.service.ForbiddenQuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@Tag(name = "管理后台-禁答主题管理")
@RestController
@RequestMapping("/admin/forbidden-topics")
@RequiredArgsConstructor
public class AdminForbiddenTopicController {

    private final ForbiddenQuestionService forbiddenQuestionService;
    private final ForbiddenQuestionDetector forbiddenQuestionDetector;

    // ── Topic CRUD ─────────────────────────────────────────

    @Operation(summary = "获取所有禁答主题")
    @GetMapping
    public Result<List<ForbiddenTopic>> listTopics() {
        return Result.success(forbiddenQuestionService.listAllTopics());
    }

    @Operation(summary = "获取启用的禁答主题")
    @GetMapping("/enabled")
    public Result<List<ForbiddenTopic>> listEnabledTopics() {
        return Result.success(forbiddenQuestionService.listEnabledTopics());
    }

    @Operation(summary = "获取禁答主题详情")
    @GetMapping("/{id:\\d+}")
    public Result<ForbiddenTopic> getTopic(@PathVariable Long id) {
        return Result.success(forbiddenQuestionService.getTopicById(id));
    }

    @Operation(summary = "创建禁答主题")
    @PostMapping
    public Result<ForbiddenTopic> createTopic(@Valid @RequestBody ForbiddenTopic topic) {
        return Result.success(forbiddenQuestionService.createTopic(topic));
    }

    @Operation(summary = "更新禁答主题")
    @PutMapping("/{id}")
    public Result<ForbiddenTopic> updateTopic(@PathVariable Long id, @Valid @RequestBody ForbiddenTopic topic) {
        return Result.success(forbiddenQuestionService.updateTopic(id, topic));
    }

    @Operation(summary = "删除禁答主题")
    @DeleteMapping("/{id}")
    public Result<Void> deleteTopic(@PathVariable Long id) {
        forbiddenQuestionService.deleteTopic(id);
        return Result.success(null);
    }

    // ── Example CRUD ───────────────────────────────────────

    @Operation(summary = "获取主题下的所有示例")
    @GetMapping("/{topicId}/examples")
    public Result<List<ForbiddenTopicExample>> listExamples(@PathVariable Long topicId) {
        return Result.success(forbiddenQuestionService.listExamplesByTopicId(topicId));
    }

    @Operation(summary = "创建示例")
    @PostMapping("/{topicId}/examples")
    public Result<ForbiddenTopicExample> createExample(@PathVariable Long topicId,
                                                       @Valid @RequestBody ForbiddenTopicExample example) {
        example.setTopicId(topicId);
        ForbiddenTopicExample created = forbiddenQuestionService.createExample(example);
        // 异步计算 embedding
        forbiddenQuestionDetector.computeExampleEmbedding(created.getId());
        return Result.success(created);
    }

    @Operation(summary = "更新示例")
    @PutMapping("/{topicId}/examples/{id}")
    public Result<ForbiddenTopicExample> updateExample(@PathVariable Long topicId,
                                                       @PathVariable Long id,
                                                       @Valid @RequestBody ForbiddenTopicExample example) {
        ForbiddenTopicExample updated = forbiddenQuestionService.updateExample(id, example);
        // 内容变更后重新计算 embedding
        forbiddenQuestionDetector.computeExampleEmbedding(id);
        return Result.success(updated);
    }

    @Operation(summary = "删除示例")
    @DeleteMapping("/{topicId}/examples/{id}")
    public Result<Void> deleteExample(@PathVariable Long topicId, @PathVariable Long id) {
        forbiddenQuestionService.deleteExample(id);
        return Result.success(null);
    }

    // ── Detection ──────────────────────────────────────────

    @Operation(summary = "检测用户输入是否命中禁答")
    @PostMapping("/detect")
    public Result<Map<String, Object>> detect(@RequestBody Map<String, String> body) {
        String userInput = body.getOrDefault("user_input", "");
        return Result.success(forbiddenQuestionDetector.detect(userInput));
    }
}
