package com.sinounion.util;

import java.io.File;
import java.io.IOException;

public class UploadPathResolver {

    private UploadPathResolver() {}

    /**
     * 解析上传目录：绝对路径原样使用；相对路径统一以项目根目录为基准。
     * 本地通常从 backend/ 目录启动，此时项目根为其父目录；容器内一般传入绝对路径（/app/uploads）。
     */
    public static String resolve(String configuredPath) {
        File base = new File(configuredPath);
        if (!base.isAbsolute()) {
            File userDir = new File(System.getProperty("user.dir"));
            File projectRoot = "backend".equalsIgnoreCase(userDir.getName()) && userDir.getParentFile() != null
                    ? userDir.getParentFile()
                    : userDir;
            base = new File(projectRoot, configuredPath);
        }
        try {
            return base.getCanonicalPath();
        } catch (IOException e) {
            return base.getAbsolutePath();
        }
    }
}
