package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

@Tag(name = "管理后台-SEO文件", description = "llms.txt / llms-full.txt / robots.txt / sitemap.xml 在线编辑")
@RestController
@RequestMapping("/admin/system/files")
public class AdminFileController {

    @Value("${APP_FRONTEND_PUBLIC_DIR}")
    private String frontendPublicDir;

    @Value("${APP_FRONTEND_DIST_DIR:../frontend/dist}")
    private String frontendDistDir;

    private Path resolvePath(String dirStr, String filename) {
        Path dir = Paths.get(dirStr);
        if (!dir.isAbsolute()) {
            dir = Paths.get(System.getProperty("user.dir"), dirStr);
        }
        return dir.resolve(filename);
    }

    @Operation(summary = "读取 llms.txt")
    @GetMapping("/llms-txt")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<Map<String, String>> readLlmsTxt() {
        return readFile("llms.txt", "# 河北圣诺联合科技有限公司\n");
    }

    @Operation(summary = "保存 llms.txt")
    @PostMapping("/llms-txt")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<Void> writeLlmsTxt(@Valid @RequestBody Map<String, String> body) {
        return writeFile("llms.txt", body);
    }

    @Operation(summary = "读取 llms-full.txt")
    @GetMapping("/llms-full-txt")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<Map<String, String>> readLlmsFullTxt() {
        return readFile("llms-full.txt", "# 河北圣诺联合科技有限公司\n");
    }

    @Operation(summary = "保存 llms-full.txt")
    @PostMapping("/llms-full-txt")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<Void> writeLlmsFullTxt(@Valid @RequestBody Map<String, String> body) {
        return writeFile("llms-full.txt", body);
    }

    @Operation(summary = "读取 robots.txt")
    @GetMapping("/robots-txt")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<Map<String, String>> readRobotsTxt() {
        return readFile("robots.txt", "# robots.txt for example.cn\n");
    }

    @Operation(summary = "保存 robots.txt")
    @PostMapping("/robots-txt")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<Void> writeRobotsTxt(@Valid @RequestBody Map<String, String> body) {
        return writeFile("robots.txt", body);
    }

    @Operation(summary = "读取 sitemap.xml")
    @GetMapping("/sitemap-xml")
    @PreAuthorize("hasAuthority('seo:view')")
    public Result<Map<String, String>> readSitemapXml() {
        return readFile("sitemap.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>\n");
    }

    @Operation(summary = "保存 sitemap.xml")
    @PostMapping("/sitemap-xml")
    @PreAuthorize("hasAuthority('seo:edit')")
    public Result<Void> writeSitemapXml(@Valid @RequestBody Map<String, String> body) {
        return writeFile("sitemap.xml", body);
    }

    private Result<Map<String, String>> readFile(String filename, String defaultContent) {
        try {
            Path path = resolvePath(frontendPublicDir, filename);
            String content;
            if (Files.exists(path)) {
                content = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
                if (content.startsWith("\uFEFF")) content = content.substring(1);
            } else {
                content = defaultContent;
            }
            Map<String, String> data = new HashMap<>();
            data.put("content", content);
            data.put("path", path.toAbsolutePath().toString());
            return Result.success(data);
        } catch (IOException e) {
            return Result.error("读取文件失败: " + e.getMessage());
        }
    }

    private Result<Void> writeFile(String filename, Map<String, String> body) {
        String content = body.get("content");
        if (content == null) {
            return Result.error("content 不能为空");
        }
        try {
            // nginx 以 text/plain 无 charset 头静态服务，前置 UTF-8 BOM 避免浏览器乱码
            byte[] bytes = ("\uFEFF" + content).getBytes(StandardCharsets.UTF_8);

            Path publicPath = resolvePath(frontendPublicDir, filename);
            Files.createDirectories(publicPath.getParent());
            Files.write(publicPath, bytes);

            Path distPath = resolvePath(frontendDistDir, filename);
            Files.createDirectories(distPath.getParent());
            Files.write(distPath, bytes);

            return Result.success("保存成功", null);
        } catch (IOException e) {
            return Result.error("保存文件失败: " + e.getMessage());
        }
    }
}
