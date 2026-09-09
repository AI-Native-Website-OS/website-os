package com.sinounion.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class SeoDetailDTO {

    private Long id;

    private String pageType;

    private Long pageId;

    private String title;

    private String description;

    private String keywords;

    private String canonicalUrl;

    private String ogTitle;

    private String ogDescription;

    private String ogImage;

    private String robots;

    private String ogType;

    private String geoSummary;

    private Integer enabled;

    private Integer geoOptional;

    private List<SeoKeywordItem> keywordsList = new ArrayList<>();

    private List<SeoFaqItem> faqs = new ArrayList<>();

    @Data
    public static class SeoKeywordItem {
        private Long id;
        private String keyword;
        private String category;
        private String intentNote;
        private Integer sortOrder;
    }

    @Data
    public static class SeoFaqItem {
        private Long id;
        private String question;
        private String answer;
        private Integer sortOrder;
    }
}
