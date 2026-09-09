package com.sinounion.util;

import com.hankcs.hanlp.HanLP;
import com.hankcs.hanlp.dictionary.py.Pinyin;
import com.hankcs.hanlp.seg.common.Term;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.regex.Pattern;

/**
 * 基于 HanLP 的中文 slug 生成器。
 * 中文先分词，再按词转写拼音并用 '-' 连接，最终规范为 [a-z0-9-] 形式。
 */
@Component
public class SlugService {

    private static final Pattern NON_WORD = Pattern.compile("[^a-z0-9]+");
    private static final Pattern LEGACY_TS = Pattern.compile("-\\d{13}$");
    private static final Pattern HAS_CJK = Pattern.compile("[\\u4e00-\\u9fff]");

    /**
     * 将文本转写为 slug。空文本返回空串。
     */
    public String slugify(String text) {
        if (text == null) return "";
        String trimmed = text.trim();
        if (trimmed.isEmpty()) return "";

        List<Term> terms = HanLP.segment(trimmed);
        List<String> wordSlugs = new ArrayList<>();
        for (Term term : terms) {
            String wordSlug = wordToSlug(term.word);
            if (!wordSlug.isEmpty()) {
                wordSlugs.add(wordSlug);
            }
        }
        if (wordSlugs.isEmpty()) return "";
        return normalize(String.join("-", wordSlugs));
    }

    private String wordToSlug(String word) {
        List<Pinyin> pinyins = HanLP.convertToPinyinList(word);
        StringBuilder sb = new StringBuilder(word.length() * 4);
        for (int i = 0; i < word.length(); i++) {
            char c = word.charAt(i);
            if (c < 128) {
                if (Character.isLetterOrDigit(c)) {
                    sb.append(Character.toLowerCase(c));
                } else {
                    sb.append('-');
                }
            } else {
                Pinyin py = pinyins.get(i);
                String withoutTone = (py == null) ? "" : py.getPinyinWithoutTone();
                if (withoutTone == null || withoutTone.isEmpty()) {
                    sb.append('-');
                } else {
                    sb.append(withoutTone);
                }
            }
        }
        return normalize(sb.toString());
    }

    /**
     * 生成唯一 slug：基础 slug 冲突时追加 -2、-3 ...
     *
     * @param base   目标文本
     * @param exists 判定候选 slug 是否已占用
     */
    public String uniqueSlug(String base, Function<String, Boolean> exists) {
        String slug = slugify(base);
        if (slug.isEmpty()) slug = "item";
        String candidate = slug;
        int n = 2;
        while (exists.apply(candidate)) {
            candidate = slug + "-" + n;
            n++;
        }
        return candidate;
    }

    /**
     * 判断 slug 是否为旧版遗留格式（空、含中文、或带 13 位时间戳后缀），
     * 用于触发重新生成。
     */
    public boolean isLegacy(String slug) {
        if (slug == null || slug.trim().isEmpty()) return true;
        return HAS_CJK.matcher(slug).find() || LEGACY_TS.matcher(slug).find();
    }

    private String normalize(String raw) {
        return NON_WORD.matcher(raw.toLowerCase()).replaceAll("-")
                .replaceAll("^-+|-+$", "");
    }
}
