package com.sinounion.entity;

import org.junit.jupiter.api.Test;

import javax.validation.ConstraintViolation;
import javax.validation.Validation;
import javax.validation.Validator;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContentItemValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void bodyWithoutModuleKeyIsValid_whenModuleKeyComesFromPath() {
        ContentItem item = new ContentItem();
        item.setTitle("测试内容");
        // moduleKey is intentionally null: the admin controller sets it from the URL path
        Set<ConstraintViolation<ContentItem>> violations = validator.validate(item);
        Set<String> fields = violations.stream()
                .map(v -> v.getPropertyPath().toString())
                .collect(Collectors.toSet());
        assertFalse(fields.contains("moduleKey"), "moduleKey 由 URL 路径提供，不应在请求体中必填");
    }

    @Test
    void blankTitleIsStillRejected() {
        ContentItem item = new ContentItem();
        item.setModuleKey("news");
        Set<ConstraintViolation<ContentItem>> violations = validator.validate(item);
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("title")),
                "标题仍应必填");
    }
}
