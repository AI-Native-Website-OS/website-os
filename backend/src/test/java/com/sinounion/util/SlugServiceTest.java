package com.sinounion.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SlugServiceTest {

    private final SlugService slugService = new SlugService();

    @Test
    void slugify_asciiText() {
        assertEquals("digital-transformation", slugService.slugify("Digital Transformation"));
        assertEquals("smart-bidding", slugService.slugify("  Smart Bidding  "));
    }

    @Test
    void slugify_chineseText_returnsPinyin() {
        assertEquals("zhihui-zhao-cai", slugService.slugify("智慧招采"));
        assertEquals("kexin-shuju-kongjian", slugService.slugify("可信数据空间"));
    }

    @Test
    void slugify_mixedText() {
        assertEquals("sino-union-2024", slugService.slugify("Sino-Union 2024"));
    }

    @Test
    void slugify_empty() {
        assertEquals("", slugService.slugify(""));
        assertEquals("", slugService.slugify("   "));
        assertEquals("", slugService.slugify(null));
    }

    @Test
    void uniqueSlug_appendsSuffixOnCollision() {
        String slug = slugService.uniqueSlug("智慧招采", candidate -> candidate.equals("zhihui-zhao-cai"));
        assertEquals("zhihui-zhao-cai-2", slug);
    }

    @Test
    void isLegacy_detectsOldFormats() {
        assertTrue(slugService.isLegacy(null));
        assertTrue(slugService.isLegacy(""));
        assertTrue(slugService.isLegacy("智慧招采平台"));
        assertTrue(slugService.isLegacy("smart-bidding-1712345678901"));
        assertFalse(slugService.isLegacy("smart-bidding"));
        assertFalse(slugService.isLegacy("smart-bidding-2024"));
    }
}
