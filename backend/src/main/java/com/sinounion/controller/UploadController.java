package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.util.ImageDimensionReader;
import com.sinounion.util.UploadPathResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;

@Slf4j
@Tag(name = "文件上传", description = "文件上传接口")
@RestController
@RequestMapping("/upload")
public class UploadController {

    private static final long IMAGE_MAX_SIZE = 10L * 1024 * 1024; // 10MB
    private static final long DOC_MAX_SIZE = 20L * 1024 * 1024;   // 20MB
    private static final int NAME_MAX_LENGTH = 100;
    private static final String FORBIDDEN_NAME_CHARS = "[\\\\/:*?\"<>|]";
    private static final int COVER_WIDTH = 1920;
    private static final int COVER_HEIGHT = 1080;
    private static final int BLOCK_WIDTH = 1920;
    private static final int BLOCK_HEIGHT = 800;

    private static final Set<String> ALLOWED_IMAGE_TYPES = new HashSet<>(Arrays.asList(
            "image/jpeg", "image/png", "image/webp"));

    private static final Set<String> ALLOWED_DOC_TYPES = new HashSet<>(Arrays.asList(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));

    private static final Set<String> FORBIDDEN_DOC_EXTENSIONS = new HashSet<>(Arrays.asList(
            "exe", "php", "jsp", "sh", "bat", "cmd"));

    @Value("${UPLOAD_PATH}")
    private String uploadPath;

    @Value("${upload.allowed-types}")
    private String allowedTypesConfig;

    private String absoluteUploadPath;

    @PostConstruct
    public void init() {
        absoluteUploadPath = UploadPathResolver.resolve(uploadPath);
        log.info("Upload path resolved to: {}", absoluteUploadPath);
        new File(absoluteUploadPath).mkdirs();
    }

    @Operation(summary = "上传文件")
    @PostMapping
    public Result<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "temp") String type,
            @RequestParam(required = false) String subPath,
            @RequestParam(required = false) String validate) {
        try {
            if (file.isEmpty()) {
                return Result.error("文件不能为空");
            }

            String detectedType = detectMimeType(file);
            if ("image".equalsIgnoreCase(validate)) {
                Result<Void> check = validateImage(file, detectedType, BLOCK_WIDTH, BLOCK_HEIGHT);
                if (check != null) return Result.error(check.getMessage());
            } else if ("image-any".equalsIgnoreCase(validate)) {
                Result<Void> check = validateImageAny(file, detectedType);
                if (check != null) return Result.error(check.getMessage());
            } else if ("cover".equalsIgnoreCase(validate)) {
                Result<Void> check = validateImage(file, detectedType, COVER_WIDTH, COVER_HEIGHT);
                if (check != null) return Result.error(check.getMessage());
            } else if ("document".equalsIgnoreCase(validate)) {
                Result<Void> check = validateDocument(file, detectedType);
                if (check != null) return Result.error(check.getMessage());
            } else {
                List<String> allowedTypes = Arrays.asList(allowedTypesConfig.split(","));
                if (detectedType == null || allowedTypes.stream().noneMatch(t -> t.equalsIgnoreCase(detectedType))) {
                    return Result.error("不支持的文件类型: " + (detectedType != null ? detectedType : "未知"));
                }
            }

            String originalFilename = file.getOriginalFilename();
            String suffix = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                suffix = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String fileName = UUID.randomUUID().toString() + suffix;

            String dirPath = absoluteUploadPath + "/" + type;
            if (subPath != null && !subPath.isEmpty()) {
                String safeSubPath = sanitizeSubPath(subPath);
                dirPath += "/" + safeSubPath;
            }

            File dir = new File(dirPath);
            if (!dir.exists() && !dir.mkdirs()) {
                log.error("Failed to create directory: {}", dirPath);
                return Result.error("无法创建上传目录");
            }

            File dest = new File(dir, fileName);
            file.transferTo(dest);
            log.info("File saved: {} (size: {})", dest.getAbsolutePath(), file.getSize());

            String urlPath = "/uploads/" + type;
            if (subPath != null && !subPath.isEmpty()) {
                String safeSubPath = sanitizeSubPath(subPath);
                urlPath += "/" + safeSubPath;
            }
            urlPath += "/" + fileName;

            Map<String, String> result = new LinkedHashMap<>();
            result.put("url", urlPath);
            result.put("name", originalFilename);
            return Result.success(result);

        } catch (IOException e) {
            log.error("Upload failed: {}", e.getMessage(), e);
            return Result.error("文件上传失败: " + e.getMessage());
        }
    }

    private Result<Void> validateImage(MultipartFile file, String detectedType, int width, int height) throws IOException {
        if (detectedType == null || !ALLOWED_IMAGE_TYPES.contains(detectedType)) {
            return Result.error("图片仅支持 jpg / jpeg / png / webp 格式");
        }
        if (file.getSize() > IMAGE_MAX_SIZE) {
            return Result.error("图片大小不能超过 10MB");
        }
        String nameErr = validateFileName(file.getOriginalFilename());
        if (nameErr != null) {
            return Result.error(nameErr);
        }
        ImageDimensionReader.Dimension dim;
        try (InputStream is = file.getInputStream()) {
            dim = ImageDimensionReader.read(is);
        }
        if (dim == null) {
            return Result.error("无法读取图片尺寸");
        }
        if (dim.width != width || dim.height != height) {
            return Result.error("图片尺寸必须为 " + width + " × " + height);
        }
        return null;
    }

    /** 图片校验但**不**限制尺寸：供 HTML 模板内嵌图片使用（尺寸由 HTML 排版决定）。 */
    private Result<Void> validateImageAny(MultipartFile file, String detectedType) {
        if (detectedType == null || !ALLOWED_IMAGE_TYPES.contains(detectedType)) {
            return Result.error("图片仅支持 jpg / jpeg / png / webp 格式");
        }
        if (file.getSize() > IMAGE_MAX_SIZE) {
            return Result.error("图片大小不能超过 10MB");
        }
        String nameErr = validateFileName(file.getOriginalFilename());
        if (nameErr != null) {
            return Result.error(nameErr);
        }
        return null;
    }

    private Result<Void> validateDocument(MultipartFile file, String detectedType) {
        if (detectedType == null || !ALLOWED_DOC_TYPES.contains(detectedType)) {
            return Result.error("文档仅支持 doc / docx / pdf 格式");
        }
        if (file.getSize() > DOC_MAX_SIZE) {
            return Result.error("文件大小不能超过 20MB");
        }
        String nameErr = validateFileName(file.getOriginalFilename());
        if (nameErr != null) {
            return Result.error(nameErr);
        }
        String ext = getExtension(file.getOriginalFilename());
        if (ext != null && FORBIDDEN_DOC_EXTENSIONS.contains(ext.toLowerCase())) {
            return Result.error("不支持该文件类型");
        }
        return null;
    }

    private String validateFileName(String originalFilename) {
        if (originalFilename == null || originalFilename.trim().isEmpty()) {
            return "文件名不能为空";
        }
        String baseName = originalFilename;
        int slash = Math.max(originalFilename.lastIndexOf('\\'), originalFilename.lastIndexOf('/'));
        if (slash >= 0) {
            baseName = originalFilename.substring(slash + 1);
        }
        int dot = baseName.lastIndexOf('.');
        String namePart = dot > 0 ? baseName.substring(0, dot) : baseName;
        if (namePart.length() > NAME_MAX_LENGTH) {
            return "文件名长度不能超过 100 个字符";
        }
        if (namePart.matches(".*" + FORBIDDEN_NAME_CHARS + ".*")) {
            return "文件名不能包含特殊字符";
        }
        return null;
    }

    private String getExtension(String originalFilename) {
        if (originalFilename == null) return null;
        int dot = originalFilename.lastIndexOf('.');
        return dot >= 0 && dot < originalFilename.length() - 1 ? originalFilename.substring(dot + 1) : null;
    }

    private String sanitizeSubPath(String subPath) {
        String[] segments = subPath.split("/");
        List<String> clean = new ArrayList<>();
        for (String seg : segments) {
            String s = seg.trim();
            if (s.isEmpty() || s.equals(".") || s.equals("..")) continue;
            s = s.replaceAll("[\\\\]", "-");
            clean.add(s);
        }
        return String.join("/", clean);
    }

    private String detectMimeType(MultipartFile file) {
        try (InputStream is = file.getInputStream()) {
            byte[] header = new byte[12];
            int read = is.read(header, 0, 12);
            if (read < 4) return null;

            if (header[0] == (byte)0xFF && header[1] == (byte)0xD8) return "image/jpeg";
            if (header[0] == (byte)0x89 && header[1] == (byte)0x50 && header[2] == (byte)0x4E && header[3] == (byte)0x47) return "image/png";
            if (header[0] == (byte)0x47 && header[1] == (byte)0x49 && header[2] == (byte)0x46) return "image/gif";
            if (header[0] == (byte)0x52 && header[1] == (byte)0x49 && header[2] == (byte)0x46 && header[3] == (byte)0x46
                    && header[8] == (byte)0x57 && header[9] == (byte)0x45 && header[10] == (byte)0x42 && header[11] == (byte)0x50) return "image/webp";
            if (header[0] == (byte)0x25 && header[1] == (byte)0x50 && header[2] == (byte)0x44 && header[3] == (byte)0x46) return "application/pdf";
            if (header[0] == (byte)0xD0 && header[1] == (byte)0xCF && header[2] == (byte)0x11 && header[3] == (byte)0xE0) return "application/msword";
            if (header[0] == (byte)0x50 && header[1] == (byte)0x4B && header[2] == (byte)0x03 && header[3] == (byte)0x04) {
                String name = file.getOriginalFilename();
                if (name != null) {
                    String lower = name.toLowerCase();
                    if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
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
            log.warn("MIME detection failed", e);
        }
        return null;
    }
}
