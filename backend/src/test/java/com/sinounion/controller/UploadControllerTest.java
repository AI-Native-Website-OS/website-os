package com.sinounion.controller;

import com.sinounion.common.Result;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class UploadControllerTest {

    private static final String TMP = System.getProperty("java.io.tmpdir") + "/sino-test-uploads";

    private UploadController newController() {
        UploadController c = new UploadController();
        ReflectionTestUtils.setField(c, "uploadPath", TMP);
        ReflectionTestUtils.setField(c, "allowedTypesConfig", "image/jpeg,image/png,image/webp");
        c.init();
        return c;
    }

    @AfterEach
    void cleanupTempUploads() {
        File dir = new File(TMP);
        if (dir.exists()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) f.delete();
            }
        }
    }

    /** 构造一个最小合法 PNG 文件头，携带指定宽高。 */
    private MockMultipartFile png(int width, int height, String name) {
        byte[] sig = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        byte[] ihdrLen = new byte[]{0, 0, 0, 13};
        byte[] ihdr = "IHDR".getBytes(StandardCharsets.US_ASCII);
        byte[] dim = new byte[13];
        dim[0] = (byte) (width >> 24);
        dim[1] = (byte) (width >> 16);
        dim[2] = (byte) (width >> 8);
        dim[3] = (byte) width;
        dim[4] = (byte) (height >> 24);
        dim[5] = (byte) (height >> 16);
        dim[6] = (byte) (height >> 8);
        dim[7] = (byte) height;
        dim[8] = 8; // bit depth
        dim[9] = 2; // color type
        byte[] body = new byte[sig.length + ihdrLen.length + ihdr.length + dim.length + 4];
        System.arraycopy(sig, 0, body, 0, sig.length);
        System.arraycopy(ihdrLen, 0, body, sig.length, ihdrLen.length);
        System.arraycopy(ihdr, 0, body, sig.length + ihdrLen.length, ihdr.length);
        System.arraycopy(dim, 0, body, sig.length + ihdrLen.length + ihdr.length, dim.length);
        // CRC 占位，维度解析不需要
        return new MockMultipartFile("file", name, "image/png", body);
    }

    @Test
    void coverValidationAccepts1920x1080() throws Exception {
        UploadController c = newController();
        Result<Map<String, String>> r = c.upload(png(1920, 1080, "cover.png"), "temp", null, "cover");
        assertTrue(r.getCode() == 200, () -> "期望通过，实际: " + r.getMessage());
    }

    @Test
    void coverValidationRejects1920x800() throws Exception {
        UploadController c = newController();
        Result<Map<String, String>> r = c.upload(png(1920, 800, "cover.png"), "temp", null, "cover");
        assertFalse(r.getCode() == 200, "1920×800 不应通过 cover 校验");
        assertTrue(r.getMessage().contains("1920 × 1080"), () -> "错误文案应提示 1920 × 1080，实际: " + r.getMessage());
    }

    @Test
    void imageValidationAccepts1920x800() throws Exception {
        UploadController c = newController();
        Result<Map<String, String>> r = c.upload(png(1920, 800, "block.png"), "temp", null, "image");
        assertTrue(r.getCode() == 200, () -> "期望通过，实际: " + r.getMessage());
    }

    @Test
    void imageValidationRejects1920x1080() throws Exception {
        UploadController c = newController();
        Result<Map<String, String>> r = c.upload(png(1920, 1080, "block.png"), "temp", null, "image");
        assertFalse(r.getCode() == 200, "1920×1080 不应通过 image 校验");
        assertTrue(r.getMessage().contains("1920 × 800"), () -> "错误文案应提示 1920 × 800，实际: " + r.getMessage());
    }

    @Test
    void imageAnyValidationAcceptsNonStandardDimensions() throws Exception {
        UploadController c = newController();
        Result<Map<String, String>> r = c.upload(png(640, 480, "html.png"), "temp", null, "image-any");
        assertTrue(r.getCode() == 200, () -> "任意尺寸图片应通过 image-any 校验，实际: " + r.getMessage());
    }

    @Test
    void imageAnyValidationStillRejectsForbiddenType() throws Exception {
        UploadController c = newController();
        byte[] gif = new byte[]{(byte) 0x47, (byte) 0x49, (byte) 0x46, (byte) 0x38, (byte) 0x37, (byte) 0x61};
        MockMultipartFile f = new MockMultipartFile("file", "x.gif", "image/gif", gif);
        Result<Map<String, String>> r = c.upload(f, "temp", null, "image-any");
        assertFalse(r.getCode() == 200, "gif 不应通过 image-any 校验");
        assertTrue(r.getMessage().contains("jpg / jpeg / png / webp"), () -> "应提示格式不支持，实际: " + r.getMessage());
    }
}