package com.sinounion.translation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sinounion.entity.TranslationEntry;
import com.sinounion.entity.TranslationJob;
import com.sinounion.mapper.SystemConfigMapper;
import com.sinounion.mapper.TranslationEntryMapper;
import com.sinounion.mapper.TranslationJobMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

/**
 * 读路径：把返回对象树中已登记的实体字段，按 locale 用译文覆盖。
 * 未命中/过期的字段保持中文并（在启用时）入队后台翻译任务。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TranslationOverlayService {

    private static final Set<String> SUPPORTED_LOCALES = new java.util.LinkedHashSet<>(java.util.Arrays.asList("zh", "en"));
    private static final long ENABLED_TTL_MS = 10_000L;

    private final TranslationRegistry registry;
    private final TranslationEntryMapper entryMapper;
    private final TranslationJobMapper jobMapper;
    private final SystemConfigMapper systemConfigMapper;
    private final ObjectMapper objectMapper;

    private volatile Boolean cachedEnabled;
    private volatile long cachedEnabledAt;

    /** 按 (resourceType#locale) 缓存译文->原文映射，用于保存时还原中文/英文源内容。 */
    private final Map<String, Map<String, String>> restoreCaches = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<String, Long> restoreCacheAt = new java.util.concurrent.ConcurrentHashMap<>();

    public boolean isEnabled() {
        long now = System.currentTimeMillis();
        Boolean cached = cachedEnabled;
        if (cached != null && now - cachedEnabledAt < ENABLED_TTL_MS) {
            return cached;
        }
        boolean enabled = true;
        try {
            com.sinounion.entity.SystemConfig cfg = systemConfigMapper.findByKey("translation_enabled");
            if (cfg != null && cfg.getConfigValue() != null && !cfg.getConfigValue().trim().isEmpty()) {
                String v = cfg.getConfigValue().trim().toLowerCase();
                enabled = "1".equals(v) || "true".equals(v) || "yes".equals(v) || "on".equals(v);
            }
        } catch (Exception ignored) {
            // 读取失败按启用处理
        }
        cachedEnabled = enabled;
        cachedEnabledAt = now;
        return enabled;
    }

    public boolean isSupportedLocale(String locale) {
        return locale != null && SUPPORTED_LOCALES.contains(locale);
    }

    /** 覆盖对象树中的已登记实体字段。 */
    public void overlay(Object root, String locale) {
        if (root == null || !isSupportedLocale(locale)) {
            return;
        }
        List<FieldRef> refs = new ArrayList<>();
        List<Runnable> after = new ArrayList<>();
        collect(root, refs, after, java.util.Collections.newSetFromMap(new IdentityHashMap<>()), 0, locale);
        apply(refs, locale);
        for (Runnable action : after) {
            action.run();
        }
    }

    /**
     * 递归覆盖配置类资源（system_configs 的 JSON 已解析对象：Map / List / POJO / 字符串）。
     * 仅翻译含中文的字符串叶子节点，路径作为 field 记录。
     */
    public void overlayConfigValue(String locale, String resourceType, Object value) {
        if (value == null || !isSupportedLocale(locale)) {
            return;
        }
        List<FieldRef> refs = new ArrayList<>();
        collectJson(value, resourceType, 0L, "", refs,
                java.util.Collections.newSetFromMap(new IdentityHashMap<>()), locale);
        apply(refs, locale);
    }

    /** 收集 JSON 结构化对象中所有需翻译叶子节点（供写路径入队，无回写副作用）。 */
    List<FieldRef> collectJsonTexts(String resourceType, Long id, String pathPrefix, Object value) {
        List<FieldRef> refs = new ArrayList<>();
        collectJson(value, resourceType, id, pathPrefix,
                refs, java.util.Collections.newSetFromMap(new IdentityHashMap<>()), null);
        return refs;
    }

    /** 覆盖配置类资源（system_configs 的 JSON，如 site_brand）。 */
    public void overlayConfigMap(String locale, String resourceType, Map<String, Object> map) {
        if (map == null || !isSupportedLocale(locale)) {
            return;
        }
        List<String> fields = registry.configFields(resourceType);
        if (fields.isEmpty()) {
            return;
        }
        List<FieldRef> refs = new ArrayList<>();
        for (String field : fields) {
            Object raw = map.get(field);
            if (raw instanceof String && TranslationUtil.shouldTranslate((String) raw, locale)) {
                String source = (String) raw;
                refs.add(new FieldRef(resourceType, 0L, field, source, v -> map.put(field, v)));
            }
        }
        apply(refs, locale);
    }

    private void collect(Object node, List<FieldRef> refs, List<Runnable> after, Set<Object> visited, int depth,
                         String locale) {
        if (node == null || depth > 8) {
            return;
        }
        if (node instanceof CharSequence || node instanceof Number || node instanceof Boolean
                || node instanceof Enum || node instanceof java.time.temporal.Temporal) {
            return;
        }
        if (!visited.add(node)) {
            return;
        }

        if (node instanceof com.sinounion.entity.SystemConfig) {
            collectSystemConfig((com.sinounion.entity.SystemConfig) node, refs, after, locale);
            return;
        }

        TranslatableResource resource = registry.byClass(node.getClass());
        if (resource != null) {
            Long id = resource.getId(node);
            if (id == null) {
                return;
            }
            Set<String> jsonFields = registry.jsonFields(node.getClass());
            for (String field : resource.getFields()) {
                String text = resource.getText(node, field);
                if (!TranslationUtil.hasText(text)) {
                    continue;
                }
                if (jsonFields.contains(field)) {
                    collectJsonField(node, resource, id, field, text, refs, after, locale);
                } else if (TranslationUtil.shouldTranslate(text, locale)) {
                    final Object target = node;
                    final String f = field;
                    refs.add(new FieldRef(resource.getType(), id, field, text, v -> resource.setText(target, f, v)));
                }
            }
            return;
        }

        if (node instanceof Map) {
            for (Object value : ((Map<?, ?>) node).values()) {
                collect(value, refs, after, visited, depth + 1, locale);
            }
            return;
        }
        if (node instanceof Collection) {
            for (Object value : (Collection<?>) node) {
                collect(value, refs, after, visited, depth + 1, locale);
            }
            return;
        }
        if (node.getClass().isArray()) {
            int length = Array.getLength(node);
            for (int i = 0; i < length; i++) {
                collect(Array.get(node, i), refs, after, visited, depth + 1, locale);
            }
            return;
        }
        // 通用 POJO：仅遍历本项目包内对象，避免进入 JDK 内部结构
        if (!node.getClass().getName().startsWith("com.sinounion")) {
            return;
        }
        Class<?> current = node.getClass();
        while (current != null && current != Object.class) {
            for (Field field : current.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers())) {
                    continue;
                }
                try {
                    field.setAccessible(true);
                    collect(field.get(node), refs, after, visited, depth + 1, locale);
                } catch (Exception ignored) {
                    // 忽略不可访问字段
                }
            }
            current = current.getSuperclass();
        }
    }

    /** 解析实体的 JSON 字段，逐叶子登记译文，并在覆盖完成后回写序列化结果。 */
    private void collectJsonField(Object entity, TranslatableResource resource, Long id, String field,
                                  String raw, List<FieldRef> refs, List<Runnable> after, String target) {
        final Object tree;
        try {
            tree = objectMapper.readValue(raw, Object.class);
        } catch (Exception e) {
            return;
        }
        collectJson(tree, resource.getType(), id, field, refs,
                java.util.Collections.newSetFromMap(new IdentityHashMap<>()), target);
        after.add(() -> {
            try {
                resource.setText(entity, field, objectMapper.writeValueAsString(tree));
            } catch (Exception ignored) {
                // 回写失败保持原文
            }
        });
    }

    /** 递归遍历 JSON 结构化对象，收集含中文的字符串叶子节点（路径作为 field）。 */
    void collectJson(Object node, String resourceType, Long id, String path,
                            List<FieldRef> refs, Set<Object> visited, String target) {
        if (node == null) {
            return;
        }
        if (node instanceof String) {
            String text = (String) node;
            if (leafTranslatable(text, target)) {
                refs.add(new FieldRef(resourceType, id, TranslationUtil.pathField(path), text, v -> {}));
            }
            return;
        }
        if (node instanceof Number || node instanceof Boolean || node instanceof Enum) {
            return;
        }
        if (!visited.add(node)) {
            return;
        }
        if (node instanceof Map) {
            for (Map.Entry<?, ?> e : ((Map<?, ?>) node).entrySet()) {
                String key = String.valueOf(e.getKey());
                Object value = e.getValue();
                if (value instanceof String) {
                    String text = (String) value;
                    if (leafTranslatable(text, target)) {
                        final Map<Object, Object> map = (Map<Object, Object>) node;
                        final Object mk = e.getKey();
                        refs.add(new FieldRef(resourceType, id, TranslationUtil.pathField(child(path, key)),
                                text, v -> map.put(mk, v)));
                    }
                } else {
                    collectJson(value, resourceType, id, child(path, key), refs, visited, target);
                }
            }
            return;
        }
        if (node instanceof List) {
            List<?> list = (List<?>) node;
            for (int i = 0; i < list.size(); i++) {
                Object value = list.get(i);
                String key = String.valueOf(i);
                if (value instanceof String) {
                    String text = (String) value;
                    if (leafTranslatable(text, target)) {
                        final List<Object> l = (List<Object>) node;
                        final int idx = i;
                        refs.add(new FieldRef(resourceType, id, TranslationUtil.pathField(child(path, key)),
                                text, v -> l.set(idx, v)));
                    }
                } else {
                    collectJson(value, resourceType, id, child(path, key), refs, visited, target);
                }
            }
            return;
        }
        if (node.getClass().isArray()) {
            int length = Array.getLength(node);
            for (int i = 0; i < length; i++) {
                collectJson(Array.get(node, i), resourceType, id, child(path, String.valueOf(i)), refs, visited, target);
            }
            return;
        }
        if (!node.getClass().getName().startsWith("com.sinounion")) {
            return;
        }
        Class<?> current = node.getClass();
        while (current != null && current != Object.class) {
            for (Field field : current.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers())) {
                    continue;
                }
                try {
                    field.setAccessible(true);
                    Object value = field.get(node);
                    if (value instanceof String) {
                        String text = (String) value;
                        if (leafTranslatable(text, target)) {
                            final Object holder = node;
                            final Field f = field;
                            refs.add(new FieldRef(resourceType, id, TranslationUtil.pathField(child(path, field.getName())),
                                    text, v -> {
                                try {
                                    f.set(holder, v);
                                } catch (Exception ignored) {
                                }
                            }));
                        }
                    } else {
                        collectJson(value, resourceType, id, child(path, field.getName()), refs, visited, target);
                    }
                } catch (Exception ignored) {
                    // 忽略不可访问字段
                }
            }
            current = current.getSuperclass();
        }
    }

    private static String child(String path, String key) {
        return path == null || path.isEmpty() ? key : path + "." + key;
    }

    private static boolean leafTranslatable(String text, String target) {
        return target == null ? TranslationUtil.hasText(text) : TranslationUtil.shouldTranslate(text, target);
    }

    private void apply(List<FieldRef> refs, String locale) {
        if (refs.isEmpty()) {
            return;
        }
        Map<String, FieldRef> byKey = new LinkedHashMap<>();
        Set<String> seenKey = new HashSet<>();
        for (FieldRef ref : refs) {
            if (ref.id == null || !TranslationUtil.hasText(ref.source)) {
                continue;
            }
            byKey.put(key(ref.type, ref.id, ref.field), ref);
            seenKey.add(ref.type + "#" + ref.id);
        }

        Map<String, TranslationEntry> entries = new HashMap<>();
        if (!byKey.isEmpty()) {
            List<TranslationEntryMapper.EntryKey> keys = new ArrayList<>();
            for (String k : seenKey) {
                int idx = k.indexOf('#');
                keys.add(new TranslationEntryMapper.EntryKey(k.substring(0, idx),
                        Long.valueOf(k.substring(idx + 1))));
            }
            for (TranslationEntry entry : entryMapper.selectByKeys(keys, locale)) {
                entries.put(key(entry.getResourceType(), entry.getResourceId(), entry.getField()), entry);
            }
        }

        boolean enabled = isEnabled();
        for (FieldRef ref : byKey.values()) {
            TranslationEntry entry = entries.get(key(ref.type, ref.id, ref.field));
            String sourceHash = TranslationUtil.sha256(ref.source);
            boolean hit = entry != null
                    && !"disabled".equalsIgnoreCase(entry.getStatus())
                    && sourceHash.equals(entry.getSourceHash())
                    && TranslationUtil.hasText(entry.getTranslatedText());
            if (hit) {
                ref.setter.accept(entry.getTranslatedText());
            } else if (enabled) {
                try {
                    jobMapper.enqueue(ref.type, ref.id, ref.field, locale, sourceHash, ref.source, "translate");
                } catch (Exception e) {
                    log.debug("enqueue translation job failed: {}", e.getMessage());
                }
            }
        }
    }

    /** 覆盖 system_configs 中登记为递归翻译的配置 JSON（管理后台读取时也生效）。 */
    private void collectSystemConfig(com.sinounion.entity.SystemConfig sc, List<FieldRef> refs,
                                     List<Runnable> after, String locale) {
        String key = sc.getConfigKey();
        if (key == null || !registry.isRecursiveConfig(key) || !TranslationUtil.hasText(sc.getConfigValue())) {
            return;
        }
        final Object tree;
        try {
            tree = objectMapper.readValue(sc.getConfigValue(), Object.class);
        } catch (Exception e) {
            return;
        }
        collectJson(tree, key, 0L, "", refs,
                java.util.Collections.newSetFromMap(new IdentityHashMap<>()), locale);
        after.add(() -> {
            try {
                sc.setConfigValue(objectMapper.writeValueAsString(tree));
            } catch (Exception ignored) {
                // 序列化失败保持原文
            }
        });
    }

    /**
     * 写路径保护：管理后台按当前语言保存时，把与已存译文完全一致的字段还原为源语言原文
     * （中文内容在英文界面保存、英文内容在中文界面保存均适用），避免译文覆盖源内容。
     * 仅按同资源类型匹配文本，降低误还原风险。
     */
    public void restoreSources(Object root, String locale) {
        if (root == null || !isSupportedLocale(locale)) {
            return;
        }
        String type = resourceTypeFor(root);
        if (type == null) {
            return;
        }
        if (restoreMap(type, locale).isEmpty()) {
            return;
        }
        restoreNode(root, type, locale, java.util.Collections.newSetFromMap(new IdentityHashMap<>()), 0);
    }

    /** 推断当前请求体对应的可翻译资源类型（用于按类型还原，避免跨资源误匹配）。 */
    private String resourceTypeFor(Object node) {
        if (node == null) {
            return null;
        }
        TranslatableResource resource = registry.byClass(node.getClass());
        if (resource != null) {
            return resource.getType();
        }
        if (node instanceof com.sinounion.entity.SystemConfig) {
            String key = ((com.sinounion.entity.SystemConfig) node).getConfigKey();
            if (key != null && (registry.isRecursiveConfig(key) || !registry.configFields(key).isEmpty())) {
                return key;
            }
            return null;
        }
        String simple = node.getClass().getSimpleName();
        if ("FooterConfigDTO".equals(simple)) return "home_footer";
        if (simple.contains("Role")) return "role";
        if (simple.contains("Permission")) return "permission";
        if (simple.contains("ContentItem")) return "content_item";
        if (simple.contains("Category")) return "content_category";
        if (simple.contains("CoreModule")) return "core_module";
        if (simple.contains("AboutSection")) return "about_section";
        if (simple.contains("HomeSection")) return "home_section";
        if (simple.contains("Faq")) return "faq";
        if (simple.contains("Banner")) return "banner";
        if (simple.contains("Contact")) return "contact_info";
        if (simple.contains("Seo")) return "seo_config";
        if (simple.contains("Partner")) return "partner";
        if (simple.contains("IndustryChain")) return "industry_chain";
        return null;
    }

    private Map<String, String> restoreMap(String type, String locale) {
        String cacheKey = type + "#" + locale;
        long now = System.currentTimeMillis();
        Map<String, String> cached = restoreCaches.get(cacheKey);
        Long at = restoreCacheAt.get(cacheKey);
        if (cached != null && at != null && now - at < 10_000L) {
            return cached;
        }
        Map<String, String> map = new HashMap<>();
        try {
            for (TranslationEntry entry : entryMapper.selectByTypeAndLocale(type, locale)) {
                if (TranslationUtil.hasText(entry.getTranslatedText()) && TranslationUtil.hasText(entry.getSourceText())) {
                    map.putIfAbsent(entry.getTranslatedText(), entry.getSourceText());
                }
            }
        } catch (Exception ignored) {
            // 查询失败则不还原（保持原值）
        }
        restoreCaches.put(cacheKey, map);
        restoreCacheAt.put(cacheKey, now);
        return map;
    }

    private void restoreNode(Object node, String inheritedType, String locale, Set<Object> visited, int depth) {
        if (node == null || depth > 8) {
            return;
        }
        if (node instanceof CharSequence || node instanceof Number || node instanceof Boolean
                || node instanceof Enum || node instanceof java.time.temporal.Temporal) {
            return;
        }
        if (!visited.add(node)) {
            return;
        }
        String type = resourceTypeFor(node);
        if (type == null) {
            type = inheritedType;
        }
        if (node instanceof Map) {
            Map<Object, Object> m = (Map<Object, Object>) node;
            for (Map.Entry<Object, Object> e : m.entrySet()) {
                Object v = e.getValue();
                if (v instanceof String) {
                    String r = restoreString((String) v, type, locale);
                    if (!r.equals(v)) {
                        e.setValue(r);
                    }
                } else {
                    restoreNode(v, type, locale, visited, depth + 1);
                }
            }
            return;
        }
        if (node instanceof Collection) {
            for (Object v : (Collection<?>) node) {
                restoreNode(v, type, locale, visited, depth + 1);
            }
            return;
        }
        if (node.getClass().isArray()) {
            int length = Array.getLength(node);
            for (int i = 0; i < length; i++) {
                restoreNode(Array.get(node, i), type, locale, visited, depth + 1);
            }
            return;
        }
        if (!node.getClass().getName().startsWith("com.sinounion")) {
            return;
        }
        Class<?> current = node.getClass();
        while (current != null && current != Object.class) {
            for (Field field : current.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers())) {
                    continue;
                }
                try {
                    field.setAccessible(true);
                    Object v = field.get(node);
                    if (v instanceof String) {
                        String r = restoreString((String) v, type, locale);
                        if (!r.equals(v)) {
                            field.set(node, r);
                        }
                    } else {
                        restoreNode(v, type, locale, visited, depth + 1);
                    }
                } catch (Exception ignored) {
                    // 忽略不可访问字段
                }
            }
            current = current.getSuperclass();
        }
    }

    /** 字符串还原：整串命中直接替换；若为 JSON 结构则逐叶子还原。 */
    private String restoreString(String value, String type, String locale) {
        if (!TranslationUtil.hasText(value) || type == null) {
            return value;
        }
        Map<String, String> map = restoreMap(type, locale);
        if (map.isEmpty()) {
            return value;
        }
        String direct = map.get(value);
        if (direct != null) {
            return direct;
        }
        String trimmed = value.trim();
        boolean looksJson = (trimmed.startsWith("{") && trimmed.endsWith("}"))
                || (trimmed.startsWith("[") && trimmed.endsWith("]"));
        if (looksJson) {
            try {
                Object tree = objectMapper.readValue(value, Object.class);
                boolean[] changed = {false};
                restoreJsonLeaves(tree, map, changed);
                if (changed[0]) {
                    return objectMapper.writeValueAsString(tree);
                }
            } catch (Exception ignored) {
                // 非合法 JSON，按原值处理
            }
        }
        return value;
    }

    private void restoreJsonLeaves(Object node, Map<String, String> map, boolean[] changed) {
        if (node instanceof Map) {
            Map<Object, Object> m = (Map<Object, Object>) node;
            for (Map.Entry<Object, Object> e : m.entrySet()) {
                Object v = e.getValue();
                if (v instanceof String) {
                    String r = map.get(v);
                    if (r != null) {
                        e.setValue(r);
                        changed[0] = true;
                    }
                } else {
                    restoreJsonLeaves(v, map, changed);
                }
            }
        } else if (node instanceof List) {
            List<Object> l = (List<Object>) node;
            for (int i = 0; i < l.size(); i++) {
                Object v = l.get(i);
                if (v instanceof String) {
                    String r = map.get(v);
                    if (r != null) {
                        l.set(i, r);
                        changed[0] = true;
                    }
                } else {
                    restoreJsonLeaves(v, map, changed);
                }
            }
        }
    }

    private static String key(String type, Long id, String field) {
        return type + "#" + id + "#" + field;
    }

    static final class FieldRef {
        final String type;
        final Long id;
        final String field;
        final String source;
        final Consumer<String> setter;

        FieldRef(String type, Long id, String field, String source, Consumer<String> setter) {
            this.type = type;
            this.id = id;
            this.field = field;
            this.source = source;
            this.setter = setter;
        }
    }
}
