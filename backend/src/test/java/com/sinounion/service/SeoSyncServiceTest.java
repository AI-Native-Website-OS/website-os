package com.sinounion.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SeoSyncServiceTest {

    @Test
    void isPrivateOrigin_localhostAndLoopback() {
        assertTrue(SeoSyncService.isPrivateOrigin("http://localhost:3200"));
        assertTrue(SeoSyncService.isPrivateOrigin("http://127.0.0.1:3200"));
    }

    @Test
    void isPrivateOrigin_privateIpRanges() {
        assertTrue(SeoSyncService.isPrivateOrigin("http://192.168.1.10:3200"));
        assertTrue(SeoSyncService.isPrivateOrigin("http://10.1.2.3"));
        assertTrue(SeoSyncService.isPrivateOrigin("http://172.16.5.6"));
        assertTrue(SeoSyncService.isPrivateOrigin("http://172.31.5.6"));
    }

    @Test
    void isPrivateOrigin_publicDomain() {
        assertFalse(SeoSyncService.isPrivateOrigin("https://www.example.cn"));
        assertFalse(SeoSyncService.isPrivateOrigin("https://example.com"));
        assertFalse(SeoSyncService.isPrivateOrigin("http://8.8.8.8"));
    }

    @Test
    void isPrivateOrigin_nonPrivateIpRanges() {
        assertFalse(SeoSyncService.isPrivateOrigin("http://172.32.1.1"));
        assertFalse(SeoSyncService.isPrivateOrigin("http://11.0.0.1"));
    }

    @Test
    void isPrivateOrigin_invalidInput() {
        assertFalse(SeoSyncService.isPrivateOrigin(null));
        assertFalse(SeoSyncService.isPrivateOrigin(""));
        assertFalse(SeoSyncService.isPrivateOrigin("garbage"));
    }
}