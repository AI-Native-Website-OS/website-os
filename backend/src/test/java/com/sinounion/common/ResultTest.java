package com.sinounion.common;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ResultTest {

    @Test
    void successCreatesResultWithCode200() {
        Result<String> result = Result.success("data");
        assertEquals(200, result.getCode());
        assertEquals("success", result.getMessage());
        assertEquals("data", result.getData());
    }

    @Test
    void successWithMessageCreatesResultWithCustomMessage() {
        Result<String> result = Result.success("自定义消息", "data");
        assertEquals(200, result.getCode());
        assertEquals("自定义消息", result.getMessage());
        assertEquals("data", result.getData());
    }

    @Test
    void successNullDataReturnsNull() {
        Result<?> result = Result.success();
        assertEquals(200, result.getCode());
        assertNull(result.getData());
    }

    @Test
    void errorCreatesResultWithCode500() {
        Result<?> result = Result.error("错误信息");
        assertEquals(500, result.getCode());
        assertEquals("错误信息", result.getMessage());
        assertNull(result.getData());
    }

    @Test
    void errorWithCodeCreatesResultWithCustomCode() {
        Result<?> result = Result.error(400, "参数错误");
        assertEquals(400, result.getCode());
        assertEquals("参数错误", result.getMessage());
    }

    @Test
    void errorWithDataIncludesData() {
        Result<String> result = Result.error(403, "禁止访问", "detail");
        assertEquals(403, result.getCode());
        assertEquals("禁止访问", result.getMessage());
        assertEquals("detail", result.getData());
    }
}
