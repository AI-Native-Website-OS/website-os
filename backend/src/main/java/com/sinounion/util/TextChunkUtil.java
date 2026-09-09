package com.sinounion.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

public class TextChunkUtil {

    private static final Logger log = LoggerFactory.getLogger(TextChunkUtil.class);
    private static final int MAX_CHUNKS = 10000;

    private TextChunkUtil() {}

    public static List<String> chunkText(String text, int maxChars, int overlap) {
        if (overlap >= maxChars) {
            throw new IllegalArgumentException(
                "chunkOverlap must be smaller than chunkSize: overlap=" + overlap + " >= chunkSize=" + maxChars
            );
        }

        List<String> chunks = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) return chunks;

        log.info("Document length={}", text.length());
        log.info("Chunk size={}", maxChars);
        log.info("Chunk overlap={}", overlap);

        String clean = text.replaceAll("\\s+", " ").trim();
        if (clean.isEmpty() || maxChars <= 0) return chunks;

        int start = 0;
        while (start < clean.length()) {
            int end = Math.min(start + maxChars, clean.length());
            if (end < clean.length()) {
                int lastSpace = clean.lastIndexOf(' ', end);
                if (lastSpace > start) end = lastSpace;
            }
            int safeStart = Math.max(0, start);
            if (safeStart >= end) break;
            chunks.add(clean.substring(safeStart, end).trim());

            if (chunks.size() > MAX_CHUNKS) {
                throw new IllegalStateException(
                    "Too many chunks generated (" + MAX_CHUNKS + "), possible infinite loop"
                );
            }

            int nextStart = end - overlap;
            if (nextStart <= start) {
                nextStart = start + 1;
            }
            start = nextStart;
        }

        log.info("Generated chunks={}", chunks.size());
        return chunks;
    }
}
