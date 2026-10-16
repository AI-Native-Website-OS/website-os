package com.sinounion.translation;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.entity.TranslationEntry;
import com.sinounion.entity.TranslationJob;
import com.sinounion.mapper.TranslationEntryMapper;
import com.sinounion.mapper.TranslationJobMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 写路径：管理员新增/修改内容后，为每个可译字段入队后台翻译任务；删除内容时清理译文与任务。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TranslationEnqueueService {

    private final TranslationRegistry registry;
    private final TranslationJobMapper jobMapper;
    private final TranslationEntryMapper entryMapper;
    private final TranslationOverlayService overlayService;
    private final ObjectMapper objectMapper;

    /** 按资源类型 + 实体入队（幂等：同源同 hash 只保留一条）。 */
    public void enqueueEntity(String resourceType, Object entity) {
        if (entity == null || !overlayService.isEnabled()) {
            return;
        }
        TranslatableResource resource = registry.byType(resourceType);
        if (resource == null) {
            return;
        }
        Long id = resource.getId(entity);
        if (id == null) {
            return;
        }
        java.util.Set<String> jsonFields = registry.jsonFields(entity.getClass());
        for (String field : resource.getFields()) {
            String text = resource.getText(entity, field);
            if (!TranslationUtil.hasText(text)) {
                continue;
            }
            if (jsonFields.contains(field)) {
                try {
                    Object tree = objectMapper.readValue(text, Object.class);
                    for (TranslationOverlayService.FieldRef ref
                            : overlayService.collectJsonTexts(resourceType, id, field, tree)) {
                        enqueueField(ref.type, ref.id, ref.field, ref.source);
                    }
                } catch (Exception ignored) {
                    // JSON 解析失败则跳过该字段
                }
            } else {
                enqueueField(resourceType, id, field, text);
            }
        }
    }

    /** 递归入队配置类资源（system_configs 的 JSON 已解析对象）中含中文的叶子节点。 */
    public void enqueueConfigValue(String resourceType, Object value) {
        if (value == null || !overlayService.isEnabled()) {
            return;
        }
        for (TranslationOverlayService.FieldRef ref : overlayService.collectJsonTexts(resourceType, 0L, "", value)) {
            enqueueField(ref.type, ref.id, ref.field, ref.source);
        }
    }

    /** 入队配置类资源（system_configs 的 JSON，如 site_brand）。 */
    public void enqueueConfig(String resourceType, Map<String, Object> map) {
        if (map == null || !overlayService.isEnabled()) {
            return;
        }
        for (String field : registry.configFields(resourceType)) {
            Object raw = map.get(field);
            if (raw instanceof String) {
                enqueueField(resourceType, 0L, field, (String) raw);
            }
        }
    }

    /** 入队单字段：目标语言取源文本的"另一语言"（中文→en，英文→zh）。 */
    private void enqueueField(String resourceType, Long id, String field, String text) {
        if (!TranslationUtil.hasText(text)) {
            return;
        }
        String target = TranslationUtil.hasCjk(text) ? "en" : "zh";
        if (!TranslationUtil.shouldTranslate(text, target)) {
            return;
        }
        try {
            jobMapper.enqueue(resourceType, id, field, target,
                    TranslationUtil.sha256(text), text, "translate");
        } catch (Exception e) {
            log.debug("enqueue translation job failed for {}.{}#{}: {}", resourceType, id, field, e.getMessage());
        }
    }

    /** 删除内容时清理其译文与任务。 */
    public void removeResource(String resourceType, Long id) {
        if (id == null) {
            return;
        }
        try {
            entryMapper.delete(new QueryWrapper<TranslationEntry>()
                    .eq("resource_type", resourceType).eq("resource_id", id));
            jobMapper.delete(new QueryWrapper<TranslationJob>()
                    .eq("resource_type", resourceType).eq("resource_id", id));
        } catch (Exception e) {
            log.debug("remove translation records failed for {}#{}: {}", resourceType, id, e.getMessage());
        }
    }

    public void removeResources(String resourceType, List<Long> ids) {
        if (ids == null) {
            return;
        }
        for (Long id : ids) {
            removeResource(resourceType, id);
        }
    }
}
