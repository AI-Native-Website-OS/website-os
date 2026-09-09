package com.sinounion;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
@MapperScan("com.sinounion.mapper")
@EnableScheduling
public class SinoUnionApplication {
    public static void main(String[] args) {
        String[] searchPaths = {"../.env", ".env", "/app/.env"};
        for (String searchPath : searchPaths) {
            Path file = Paths.get(searchPath);
            if (Files.exists(file)) {
                try {
                    for (String line : Files.readAllLines(file)) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;
                        if (line.startsWith("export ")) line = line.substring(7).trim();
                        int idx = line.indexOf('=');
                        if (idx <= 0) continue;
                        String key = line.substring(0, idx).trim();
                        String val = line.substring(idx + 1).trim();
                        if ((val.startsWith("\"") && val.endsWith("\""))
                                || (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.substring(1, val.length() - 1);
                        }
                        if (System.getProperty(key) == null) {
                            System.setProperty(key, val);
                        }
                    }
                } catch (IOException ignored) {
                }
                break;
            }
        }
        SpringApplication.run(SinoUnionApplication.class, args);
    }
}
