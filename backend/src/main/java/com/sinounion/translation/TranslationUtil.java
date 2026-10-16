package com.sinounion.translation;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** 翻译相关工具方法。 */
public final class TranslationUtil {

    private TranslationUtil() {
    }

    /** 原文 sha256（十六进制小写），用于判断原文是否变化。 */
    public static String sha256(String text) {
        if (text == null) {
            return "";
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    public static boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }

    /** 是否包含中日韩表意文字（用于只翻译含中文的字符串，跳过 URL/标识等）。 */
    public static boolean hasCjk(String s) {
        if (s == null) {
            return false;
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= '\u4E00' && c <= '\u9FFF') {
                return true;
            }
            if (c >= '\u3400' && c <= '\u4DBF') {
                return true;
            }
        }
        return false;
    }

    /** 语言判断：含中文视为 zh，否则视为 en。 */
    public static String detectLang(String s) {
        return hasCjk(s) ? "zh" : "en";
    }

    /** 是否含拉丁字母（用于判断英文正文，跳过纯数字/符号）。 */
    public static boolean hasLatin(String s) {
        if (s == null) {
            return false;
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c < 128 && Character.isLetter(c)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 该文本是否需要翻译到目标语言：源语言与目标语言相同则跳过；
     * 目标为中文时要求含拉丁字母且非 URL/邮箱等，避免把标识符/纯符号误翻。
     */
    public static boolean shouldTranslate(String text, String target) {
        if (!hasText(text) || target == null) {
            return false;
        }
        String src = detectLang(text);
        if (src.equals(target)) {
            return false;
        }
        if ("zh".equals(target)) {
            if (!hasLatin(text)) {
                return false;
            }
            String t = text.trim();
            if (t.matches("(?is)^(https?://|mailto:|www\\.).*")) {
                return false;
            }
            if (t.matches("(?s)^[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}$")) {
                return false;
            }
        }
        return true;
    }

    /** translation 表 field 列上限 64；超长路径用稳定哈希压缩，保证读写一致。 */
    public static String pathField(String path) {
        if (path == null) {
            return "";
        }
        if (path.length() <= 64) {
            return path;
        }
        return "h:" + sha256(path).substring(0, 60);
    }
}
