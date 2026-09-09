package com.sinounion.common;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BusinessExceptionTest {

    @Test
    void exceptionWithMessageOnlyHasCode500() {
        BusinessException e = new BusinessException("业务异常");
        assertEquals(500, e.getCode());
        assertEquals("业务异常", e.getMessage());
    }

    @Test
    void exceptionWithCodeAndMessage() {
        BusinessException e = new BusinessException(400, "参数错误");
        assertEquals(400, e.getCode());
        assertEquals("参数错误", e.getMessage());
    }
}
