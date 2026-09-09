package com.sinounion.util;

import java.io.File;
import java.io.IOException;

public class UploadPathResolver {

    private UploadPathResolver() {}

    public static String resolve(String configuredPath) {
        String os = System.getProperty("os.name").toLowerCase();
        boolean isWindows = os.contains("win");

        if (isWindows) {
            File base = new File(configuredPath);
            if (!base.isAbsolute()) {
                base = new File(System.getProperty("user.dir"), configuredPath);
            }
            try {
                return base.getCanonicalPath();
            } catch (IOException e) {
                return base.getAbsolutePath();
            }
        } else {
            return "/app/uploads";
        }
    }
}
