package com.sinounion.translation;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/**
 * 一种可翻译资源的描述：资源类型、实体类、主键提取、可译字段（Java 属性名）。
 * 字段读写使用反射，避免为每个实体侵入式加接口。
 */
public class TranslatableResource {

    private static final Map<String, Field> FIELD_CACHE = new ConcurrentHashMap<>();

    private final String type;
    private final Class<?> entityClass;
    private final Function<Object, Long> idResolver;
    private final List<String> fields;

    public TranslatableResource(String type, Class<?> entityClass,
                                Function<Object, Long> idResolver, List<String> fields) {
        this.type = type;
        this.entityClass = entityClass;
        this.idResolver = idResolver;
        this.fields = fields;
    }

    public String getType() {
        return type;
    }

    public Class<?> getEntityClass() {
        return entityClass;
    }

    public List<String> getFields() {
        return fields;
    }

    public Long getId(Object entity) {
        return entity == null ? null : idResolver.apply(entity);
    }

    /** 读取字段文本值（非 String 字段按 toString 处理，null 返回 null）。 */
    public String getText(Object entity, String field) {
        Object value = read(entity, field);
        return value == null ? null : String.valueOf(value);
    }

    public void setText(Object entity, String field, String value) {
        write(entity, field, value);
    }

    private static Field resolveField(Class<?> cls, String name) {
        String key = cls.getName() + "#" + name;
        Field cached = FIELD_CACHE.get(key);
        if (cached != null) {
            return cached;
        }
        Class<?> current = cls;
        while (current != null && current != Object.class) {
            try {
                Field f = current.getDeclaredField(name);
                f.setAccessible(true);
                FIELD_CACHE.put(key, f);
                return f;
            } catch (NoSuchFieldException ignored) {
                current = current.getSuperclass();
            }
        }
        return null;
    }

    private static Object read(Object entity, String field) {
        try {
            Field f = resolveField(entity.getClass(), field);
            return f == null ? null : f.get(entity);
        } catch (Exception e) {
            return null;
        }
    }

    private static void write(Object entity, String field, String value) {
        try {
            Field f = resolveField(entity.getClass(), field);
            if (f != null) {
                f.set(entity, value);
            }
        } catch (Exception ignored) {
            // 覆盖失败不影响主流程（保持原文）
        }
    }
}
