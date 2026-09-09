package com.sinounion.task;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.DependsOn;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.File;

@Slf4j
@Component
@DependsOn("databaseInitializer")
public class TempFileCleanupTask {

    @Value("${UPLOAD_PATH}")
    private String uploadPath;

    @Scheduled(cron = "0 0 0 * * ?")
    public void cleanupTempFiles() {
        File tempDir = new File(uploadPath + "/temp");
        if (!tempDir.exists() || !tempDir.isDirectory()) {
            return;
        }

        File[] files = tempDir.listFiles();
        if (files == null || files.length == 0) {
            return;
        }

        long now = System.currentTimeMillis();
        long twentyFourHours = 24 * 60 * 60 * 1000L;
        int deleted = 0;

        for (File file : files) {
            if (file.isFile() && (now - file.lastModified()) > twentyFourHours) {
                if (file.delete()) {
                    deleted++;
                }
            }
        }

        if (deleted > 0) {
            log.info("清理临时文件完成，共删除 {} 个文件", deleted);
        }
    }
}
