package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.util.UploadPathResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Tag(name = "聊天文件上传", description = "AI对话文件临时上传")
@RestController
@RequestMapping("/upload/chat_temp")
public class ChatUploadController {

    @Value("${UPLOAD_PATH}")
    private String uploadPath;

    private String absoluteUploadPath;

    @PostConstruct
    public void init() {
        absoluteUploadPath = UploadPathResolver.resolve(uploadPath);
    }

    @Value("${upload.allowed-types}")
    private String allowedTypesConfig;

    @Operation(summary = "上传聊天文件")
    @PostMapping
    public Result<Map<String, String>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            return Result.error("文件不能为空");
        }

        List<String> allowedTypes = Arrays.asList(allowedTypesConfig.split(","));
        String detectedType = detectMimeType(file);
        if (detectedType == null || allowedTypes.stream().noneMatch(t -> t.equalsIgnoreCase(detectedType))) {
            return Result.error("不支持的文件类型: " + (detectedType != null ? detectedType : "未知"));
        }

        String originalFilename = file.getOriginalFilename();
        String suffix = originalFilename != null ? originalFilename.substring(originalFilename.lastIndexOf(".")) : "";
        String fileName = UUID.randomUUID().toString() + suffix;

        File dest = new File(absoluteUploadPath + "/temp/" + fileName);
        if (!dest.getParentFile().exists()) {
            dest.getParentFile().mkdirs();
        }
        file.transferTo(dest);

        Map<String, String> result = new HashMap<>();
        result.put("url", "/uploads/temp/" + fileName);
        result.put("name", originalFilename);
        return Result.success(result);
    }

    private String detectMimeType(MultipartFile file) {
        try (InputStream is = file.getInputStream()) {
            byte[] header = new byte[12];
            int read = is.read(header, 0, 12);
            if (read < 4) return null;

            if (header[0] == (byte)0xFF && header[1] == (byte)0xD8) return "image/jpeg";
            if (header[0] == (byte)0x89 && header[1] == (byte)0x50 && header[2] == (byte)0x4E && header[3] == (byte)0x47) return "image/png";
            if (header[0] == (byte)0x47 && header[1] == (byte)0x49 && header[2] == (byte)0x46) return "image/gif";
            if (header[0] == (byte)0x25 && header[1] == (byte)0x50 && header[2] == (byte)0x44 && header[3] == (byte)0x46) return "application/pdf";
            if (header[0] == (byte)0xD0 && header[1] == (byte)0xCF && header[2] == (byte)0x11 && header[3] == (byte)0xE0) return "application/msword";
            if (header[0] == (byte)0x50 && header[1] == (byte)0x4B && header[2] == (byte)0x03 && header[3] == (byte)0x04) {
                String name = file.getOriginalFilename();
                if (name != null) {
                    String lower = name.toLowerCase();
                    if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                }
                return "application/zip";
            }
            if (header[0] == (byte)0xEF && header[1] == (byte)0xBB && header[2] == (byte)0xBF) return "text/plain";
            String textSample = new String(header, java.nio.charset.StandardCharsets.UTF_8).trim();
            if (textSample.length() > 0 && !textSample.contains("\u0000")) {
                String name = file.getOriginalFilename();
                if (name != null) {
                    String lower = name.toLowerCase();
                    if (lower.endsWith(".md")) return "text/markdown";
                    if (lower.endsWith(".txt")) return "text/plain";
                }
            }
        } catch (IOException e) {
            return null;
        }
        return null;
    }
}
