package com.sinounion.controller;

import com.sinounion.util.UploadPathResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.net.URLEncoder;

@Tag(name = "文件访问", description = "上传文件访问接口")
@RestController
@RequestMapping("/files")
public class FileController {

    @Value("${UPLOAD_PATH}")
    private String uploadPath;

    @Operation(summary = "获取上传的文件")
    @GetMapping("/{type}/**")
    public void getFile(@PathVariable String type, HttpServletRequest request, HttpServletResponse response) throws Exception {
        String requestURI = request.getRequestURI();
        String contextPath = request.getContextPath();
        String pathInApp = requestURI.substring(contextPath.length());
        String prefix = "/files/" + type + "/";
        String relativePath = pathInApp.substring(prefix.length());

        String absoluteUploadPath = UploadPathResolver.resolve(uploadPath);
        File file = new File(absoluteUploadPath + File.separator + type, relativePath.replace("/", File.separator)).getCanonicalFile();
        String canonicalUploadPath = new File(absoluteUploadPath).getCanonicalPath();
        if (!file.getCanonicalPath().startsWith(canonicalUploadPath + File.separator)) {
            response.setStatus(403);
            response.getWriter().write("禁止访问");
            return;
        }
        if (!file.exists() || !file.isFile()) {
            response.setStatus(404);
            response.getWriter().write("文件不存在");
            return;
        }

        String fileName = file.getName();
        String contentType = "application/octet-stream";
        if (fileName.endsWith(".pdf")) contentType = "application/pdf";
        else if (fileName.endsWith(".doc")) contentType = "application/msword";
        else if (fileName.endsWith(".docx")) contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (fileName.endsWith(".md")) contentType = "text/markdown";
        else if (fileName.endsWith(".txt")) contentType = "text/plain";
        response.setContentType(contentType);
        response.setHeader("Content-Disposition", "inline; filename*=UTF-8''" + URLEncoder.encode(fileName, "UTF-8").replace("+", "%20"));
        response.setContentLengthLong(file.length());
        try (FileInputStream fis = new FileInputStream(file); OutputStream os = response.getOutputStream()) {
            byte[] buf = new byte[8192];
            int len;
            while ((len = fis.read(buf)) != -1) os.write(buf, 0, len);
            os.flush();
        }
    }
}
