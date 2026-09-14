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

@Tag(name = "管理后台-配置文件", description = "application.yml 在线编辑")
@RestController
@RequestMapping("/admin/system/config-file")
public class AdminConfigFileController {

    @Value("${app.config-file-path:}")
    private String configFilePath;

    private Path resolvePath() {
        if (!configFilePath.isEmpty()) {
            return Paths.get(configFilePath);
        }
        String userDir = System.getProperty("user.dir");
        Path devPath = Paths.get(userDir, "src", "main", "resources", "application.yml");
        if (Files.exists(devPath)) {
            return devPath;
        }
        Path prodPath = Paths.get(userDir, "config", "application.yml");
        if (Files.exists(prodPath)) {
            return prodPath;
        }
        return Paths.get(userDir, "application.yml");
    }

    @Operation(summary = "读取 application.yml 内容")
    @GetMapping
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<Map<String, String>> readConfigFile() {
        try {
            Path path = resolvePath();
            if (!Files.exists(path)) {
                return Result.error("配置文件不存在: " + path.toAbsolutePath());
            }
            String content = new String(Files.readAllBytes(path), StandardCharsets.UTF_8);
            Map<String, String> data = new HashMap<>();
            data.put("content", content);
            data.put("path", path.toAbsolutePath().toString());
            return Result.success(data);
        } catch (IOException e) {
            return Result.error("读取配置文件失败: " + e.getMessage());
        }
    }

    @Operation(summary = "保存 application.yml 内容")
    @PutMapping
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<Void> writeConfigFile(@Valid @RequestBody Map<String, String> body) {
        String content = body.get("content");
        if (content == null) {
            return Result.error("content 不能为空");
        }
        try {
            Path path = resolvePath();
            Files.write(path, content.getBytes(StandardCharsets.UTF_8));
            return Result.success("保存成功，部分修改需要重启服务生效", null);
        } catch (IOException e) {
            return Result.error("保存配置文件失败: " + e.getMessage());
        }
    }
}
