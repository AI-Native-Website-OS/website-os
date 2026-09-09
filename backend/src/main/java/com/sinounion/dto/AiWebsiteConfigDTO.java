package com.sinounion.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * AI 官网版本介绍与对比配置。
 * 存储于 system_configs（config_key = ai_website_config），JSON 结构。
 * 未配置时由服务端返回默认值。
 */
@Data
public class AiWebsiteConfigDTO {

    /** 页面主标题 */
    private String title;

    /** 页面副标题 */
    private String subtitle;

    /** 版本卡片列表 */
    private List<VersionItem> versions;

    /** 对比表标题 */
    private String comparisonTitle;

    /** 对比表行（feature 为功能名，values 以版本 key 为键） */
    private List<ComparisonRow> comparisonRows;

    @Data
    public static class VersionItem {
        private String key;
        private String name;
        private String tagline;
        private String price;
        private String priceNote;
        private String description;
        private List<String> features = new ArrayList<>();
        private boolean highlight;
        private String ctaLabel;
        private String ctaUrl;
    }

    @Data
    public static class ComparisonRow {
        private String feature;
        private Map<String, String> values = new LinkedHashMap<>();
    }

    /** 返回默认配置，未配置任何数据时的展示兜底 */
    public static AiWebsiteConfigDTO defaults() {
        AiWebsiteConfigDTO dto = new AiWebsiteConfigDTO();
        dto.setTitle("AI 企业官网 · 版本介绍");
        dto.setSubtitle("从内容管理到 AI 顾问，选择适合您企业规模的版本");
        dto.setComparisonTitle("功能对比");

        List<VersionItem> versions = new ArrayList<>();

        VersionItem basic = new VersionItem();
        basic.setKey("basic");
        basic.setName("基础版");
        basic.setTagline("适合个人与初创团队");
        basic.setPrice("¥0");
        basic.setPriceNote("开源免费");
        basic.setDescription("快速搭建品牌官网，内置内容管理与 AI 顾问体验。");
        basic.setFeatures(new ArrayList<>(java.util.Arrays.asList(
                "官网内容管理（产品/方案/案例/资源）",
                "AI 智能顾问（每日限量）",
                "中英双语界面",
                "线索采集与后台管理"
        )));
        basic.setHighlight(false);
        basic.setCtaLabel("免费体验");
        basic.setCtaUrl("/#chat");
        versions.add(basic);

        VersionItem pro = new VersionItem();
        pro.setKey("pro");
        pro.setName("专业版");
        pro.setTagline("适合成长型企业");
        pro.setPrice("¥399");
        pro.setPriceNote("每月");
        pro.setDescription("在基础版之上，解锁完整 AI 能力与营销分析。");
        pro.setFeatures(new ArrayList<>(java.util.Arrays.asList(
                "基础版全部功能",
                "AI 顾问不限量 + 知识库 RAG",
                "AI 长期记忆与意图识别",
                "用户行为追踪与转化分析",
                "SEO / GEO 自动优化",
                "优先技术支持"
        )));
        pro.setHighlight(true);
        pro.setCtaLabel("立即升级");
        pro.setCtaUrl("/#chat");
        versions.add(pro);

        VersionItem enterprise = new VersionItem();
        enterprise.setKey("enterprise");
        enterprise.setName("旗舰版");
        enterprise.setTagline("适合大型企业 / 集团");
        enterprise.setPrice("定制");
        enterprise.setPriceNote("联系我们");
        enterprise.setDescription("专属私有化部署，多站点多语言与深度定制。");
        enterprise.setFeatures(new ArrayList<>(java.util.Arrays.asList(
                "专业版全部功能",
                "私有化部署（本地/专有云）",
                "多站点 / 多语言 / 品牌定制",
                "专属模型微调与知识库",
                "专属客户成功经理"
        )));
        enterprise.setHighlight(false);
        enterprise.setCtaLabel("联系我们");
        enterprise.setCtaUrl("/about#contact");
        versions.add(enterprise);

        dto.setVersions(versions);

        List<ComparisonRow> rows = new ArrayList<>();
        rows.add(row("官网内容管理", "✓", "✓", "✓"));
        rows.add(row("AI 智能顾问", "每日限量", "不限量", "不限量"));
        rows.add(row("知识库 RAG 检索", "—", "✓", "✓"));
        rows.add(row("AI 长期记忆", "—", "✓", "✓"));
        rows.add(row("用户行为追踪", "基础", "✓", "✓"));
        rows.add(row("中英双语", "✓", "✓", "✓"));
        rows.add(row("SEO / GEO 优化", "—", "✓", "✓"));
        rows.add(row("私有化部署", "—", "—", "✓"));
        rows.add(row("专属模型定制", "—", "—", "✓"));
        rows.add(row("技术支持", "社区", "优先", "专属"));
        dto.setComparisonRows(rows);

        return dto;
    }

    private static ComparisonRow row(String feature, String basic, String pro, String enterprise) {
        ComparisonRow r = new ComparisonRow();
        r.setFeature(feature);
        Map<String, String> values = new LinkedHashMap<>();
        values.put("basic", basic);
        values.put("pro", pro);
        values.put("enterprise", enterprise);
        r.setValues(values);
        return r;
    }
}