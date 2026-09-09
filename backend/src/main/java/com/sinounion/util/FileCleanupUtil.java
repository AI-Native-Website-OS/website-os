package com.sinounion.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;

public class FileCleanupUtil {

    private static final Logger log = LoggerFactory.getLogger(FileCleanupUtil.class);

    private FileCleanupUtil() {}

    public static void deleteFileByUrl(String absoluteUploadPath, String fileUrl) {
        if (fileUrl == null || fileUrl.isEmpty()) return;
        if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) return;

        String relativePath = fileUrl;
        if (relativePath.startsWith("/uploads/")) {
            relativePath = relativePath.substring("/uploads/".length());
        } else if (relativePath.startsWith("/")) {
            relativePath = relativePath.substring(1);
        }

        File file = new File(absoluteUploadPath, relativePath);
        if (file.exists() && file.isFile()) {
            if (file.delete()) {
                log.info("Deleted file: {}", file.getAbsolutePath());
            } else {
                log.warn("Failed to delete file: {}", file.getAbsolutePath());
            }
        }
    }

    public static void deleteParentDirIfEmpty(String absoluteUploadPath, String fileUrl) {
        if (fileUrl == null || fileUrl.isEmpty()) return;
        String relativePath = fileUrl;
        if (relativePath.startsWith("/uploads/")) {
            relativePath = relativePath.substring("/uploads/".length());
        } else if (relativePath.startsWith("/")) {
            relativePath = relativePath.substring(1);
        }
        File file = new File(absoluteUploadPath, relativePath);
        File parentDir = file.getParentFile();
        if (parentDir != null && parentDir.exists()) {
            File[] files = parentDir.listFiles();
            if (files == null || files.length == 0) {
                if (parentDir.delete()) {
                    log.info("Deleted empty directory: {}", parentDir.getAbsolutePath());
                }
            }
        }
    }

    public static String replaceFile(String absoluteUploadPath, String newFileUrl, String oldFileUrl) {
        if (newFileUrl == null || newFileUrl.isEmpty()) return newFileUrl;
        if (!newFileUrl.startsWith("/uploads/")) return newFileUrl;
        if (oldFileUrl == null || !oldFileUrl.startsWith("/uploads/")) return newFileUrl;
        String rel = oldFileUrl.substring("/uploads/".length());
        int lastSlash = rel.lastIndexOf("/");
        if (lastSlash < 0) return newFileUrl;
        String targetDir = rel.substring(0, lastSlash);
        deleteFileByUrl(absoluteUploadPath, oldFileUrl);
        return moveFileByUrl(absoluteUploadPath, newFileUrl, targetDir);
    }

    public static String moveFileByUrl(String absoluteUploadPath, String fileUrl, String targetDirName) {
        if (fileUrl == null || fileUrl.isEmpty()) return fileUrl;
        if (!fileUrl.startsWith("/uploads/")) return fileUrl;

        String relativePath = fileUrl.substring("/uploads/".length());
        int lastSlash = relativePath.lastIndexOf("/");
        String fileName = relativePath.substring(lastSlash + 1);

        File oldFile = new File(absoluteUploadPath, relativePath.replace("/", File.separator));
        if (!oldFile.exists()) return fileUrl;

        File targetDir = new File(absoluteUploadPath, targetDirName.replace("/", File.separator));
        if (!targetDir.exists() && !targetDir.mkdirs()) {
            log.warn("Failed to create directory: {}", targetDir.getAbsolutePath());
            return fileUrl;
        }

        File newFile = new File(targetDir, fileName);
        if (oldFile.renameTo(newFile)) {
            String newUrl = "/uploads/" + targetDirName.replace(File.separator, "/") + "/" + fileName;
            log.info("Moved file: {} -> {}", oldFile.getAbsolutePath(), newFile.getAbsolutePath());
            return newUrl;
        } else {
            log.warn("Failed to move file: {} -> {}", oldFile.getAbsolutePath(), newFile.getAbsolutePath());
            return fileUrl;
        }
    }
}
