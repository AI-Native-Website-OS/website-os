package com.sinounion.service.impl;

import com.sinounion.entity.*;
import com.sinounion.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.service.StatsService;
import com.sinounion.vo.DashboardStatsVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URLDecoder;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatsServiceImpl implements StatsService {

    private final PageViewMapper pageViewMapper;
    private final UserBehaviorMapper behaviorMapper;
    private final LeadMapper leadMapper;
    private final ContentItemMapper contentItemMapper;
    private final ContactSubmissionMapper contactSubmissionMapper;
    private final UserMapper userMapper;

    @Override
    public DashboardStatsVO getDashboardStats() {
        DashboardStatsVO vo = new DashboardStatsVO();
        vo.setTodayViews(pageViewMapper.countTodayViews());
        vo.setTodayUniqueVisitors(pageViewMapper.countTodayUniqueVisitors());
        vo.setTodayLeads(leadMapper.countTodayLeads());
        long total = contentItemMapper.selectCount(new LambdaQueryWrapper<ContentItem>()
                .in(ContentItem::getModuleKey, "products", "solutions", "cases", "resources"));
        vo.setTotalResources(total);
        List<Map<String, Object>> topPages = pageViewMapper.findTopPagesLast7Days();
        enrichWithPageTitle(topPages);
        vo.setTopPages(topPages);

        Map<String, Integer> behaviorStats = behaviorMapper.countTodayBehaviors();
        if (behaviorStats == null) behaviorStats = new HashMap<>();
        vo.setTodayAiChats(behaviorStats.getOrDefault("ai_chat", 0));
        vo.setTodayFormSubmits(contactSubmissionMapper.countTodaySubmissions());
        vo.setTodayDownloads(behaviorStats.getOrDefault("download", 0));

        return vo;
    }

    @Override
    public List<Map<String, Object>> getWeeklyTrend() {
        return pageViewMapper.findWeeklyTrend();
    }

    @Override
    public List<Map<String, Object>> getHourlyDistribution() {
        return pageViewMapper.findHourlyDistribution();
    }

    @Override
    public List<Map<String, Object>> getPageTypeDistribution() {
        return pageViewMapper.findPageTypeDistribution();
    }

    @Override
    public List<Map<String, Object>> getPageUrlDistribution() {
        List<Map<String, Object>> items = pageViewMapper.findTopUsersLast30Days();
        if (items.isEmpty()) {
            return userMapper.findActiveUsers();
        }
        return items;
    }

    @Override
    public List<Map<String, Object>> getDailyViews() {
        return pageViewMapper.findDailyViews();
    }

    @Override
    public List<Map<String, Object>> getLeadSources() {
        return leadMapper.findLeadSources();
    }

    @Override
    public List<Map<String, Object>> getMonthlyLeadTrend() {
        return leadMapper.findMonthlyLeadTrend();
    }

    @Override
    public List<Map<String, Object>> getMonthlySubmissionTrend() {
        return contactSubmissionMapper.findMonthlySubmissionTrend();
    }

    @Override
    public List<Map<String, Object>> getWeeklyChatTrend() {
        return new ArrayList<>();
    }

    @Override
    public List<Map<String, Object>> getContentCategories() {
        List<Map<String, Object>> result = new ArrayList<>();
        String[][] modules = {{"products", "产品"}, {"solutions", "方案"}, {"cases", "案例"}, {"resources", "资源"}};
        for (String[] m : modules) {
            Map<String, Object> item = new HashMap<>();
            item.put("name", m[1]);
            item.put("count", contentItemMapper.selectCount(new LambdaQueryWrapper<ContentItem>()
                    .eq(ContentItem::getModuleKey, m[0])));
            item.put("views", Optional.ofNullable(contentItemMapper.sumViewCount(m[0])).orElse(0L));
            result.add(item);
        }
        return result;
    }

    @Override
    public Map<String, Object> getLeadPipeline() {
        String[] statuses = {"new", "contacted", "qualified", "quoted", "closed", "invalid"};
        String[] labels = {"待跟进", "已联系", "有意向", "已报价", "已成交", "无效线索"};

        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> stages = new ArrayList<>();

        for (int i = 0; i < statuses.length; i++) {
            Map<String, Object> stage = new HashMap<>();
            stage.put("status", statuses[i]);
            stage.put("label", labels[i]);

            LambdaQueryWrapper<Lead> countWrapper = new LambdaQueryWrapper<>();
            countWrapper.eq(Lead::getStatus, statuses[i]);
            long count = leadMapper.selectCount(countWrapper);
            stage.put("count", count);

            LambdaQueryWrapper<Lead> recentWrapper = new LambdaQueryWrapper<>();
            recentWrapper.eq(Lead::getStatus, statuses[i]);
            recentWrapper.orderByDesc(Lead::getCreatedAt);
            recentWrapper.last("LIMIT 3");
            List<Lead> recent = leadMapper.selectList(recentWrapper);
            stage.put("recent", recent.stream().map(l -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", l.getId());
                m.put("name", l.getName());
                m.put("company", l.getCompany());
                m.put("source", l.getSource());
                m.put("score", l.getScore());
                return m;
            }).collect(Collectors.toList()));

            stages.add(stage);
        }
        result.put("stages", stages);
        return result;
    }

    @Override
    public List<Map<String, Object>> getConversionFunnel() {
        List<Map<String, Object>> result = new ArrayList<>();
        Long totalViews = pageViewMapper.countTotalPageViews();
        Long todayVisitors = pageViewMapper.countTodayUniqueVisitors().longValue();
        Integer todaySubmits = contactSubmissionMapper.countTodaySubmissions();
        Integer todayLeads = leadMapper.countTodayLeads();

        Map<String, Object> step1 = new HashMap<>(); step1.put("name", "页面浏览"); step1.put("value", totalViews); result.add(step1);
        Map<String, Object> step2 = new HashMap<>(); step2.put("name", "独立访客"); step2.put("value", todayVisitors); result.add(step2);
        Map<String, Object> step3 = new HashMap<>(); step3.put("name", "表单提交"); step3.put("value", todaySubmits.longValue()); result.add(step3);
        Map<String, Object> step4 = new HashMap<>(); step4.put("name", "生成线索"); step4.put("value", todayLeads.longValue()); result.add(step4);
        return result;
    }

    @Override
    public Long getUserIdByUsername(String username) {
        com.sinounion.entity.User user = userMapper.findByUsername(username);
        return user != null ? user.getId() : null;
    }

    @Override
    public void recordPageView(String pageType, Long pageId, Long userId, String pageUrl, String visitorId, String ipAddress, String userAgent, String referer) {
        PageView pageView = new PageView();
        pageView.setPageType(pageType);
        pageView.setPageId(pageId);
        pageView.setUserId(userId);
        pageView.setPageUrl(pageUrl);
        pageView.setVisitorId(visitorId);
        pageView.setIpAddress(ipAddress);
        pageView.setUserAgent(userAgent);
        pageView.setReferer(referer);
        pageViewMapper.insert(pageView);
    }

    @Override
    public void recordBehavior(String visitorId, String behaviorType, String targetType, Long targetId, String metadata) {
        UserBehavior behavior = new UserBehavior();
        behavior.setVisitorId(visitorId);
        behavior.setBehaviorType(behaviorType);
        behavior.setTargetType(targetType);
        behavior.setTargetId(targetId);
        behavior.setMetadata(metadata);
        behaviorMapper.insert(behavior);
    }

    private void enrichWithPageTitle(List<Map<String, Object>> items) {
        for (Map<String, Object> item : items) {
            String pageType = (String) item.get("page_type");
            String pageUrl = (String) item.get("page_url");
            if (pageType == null || pageUrl == null) continue;

            if (pageUrl.equals("/")) {
                item.put("page_title", "首页");
                continue;
            }

            String slug = extractSlugFromUrl(pageUrl);
            if (slug == null || slug.isEmpty()) {
                item.put("page_title", formatUrlAsReadable(pageUrl));
                continue;
            }

            String decodedSlug = decodeUrlSegment(slug);
            String cleanSlug = stripTrailingDigits(decodedSlug);
            String pageTitle = lookupTitleByTypeAndSlug(pageType, cleanSlug);
            if (pageTitle != null) {
                item.put("page_title", pageTitle);
            } else {
                item.put("page_title", formatUrlAsReadable(pageUrl));
            }
        }
    }

    private String decodeUrlSegment(String segment) {
        if (segment == null) return null;
        try {
            return URLDecoder.decode(segment, "UTF-8");
        } catch (Exception e) {
            return segment;
        }
    }

    private String stripTrailingDigits(String slug) {
        if (slug == null || slug.isEmpty()) return slug;
        return slug.replaceAll("\\d+$", "");
    }

    private String extractSlugFromUrl(String url) {
        if (url == null) return null;
        String[] parts = url.split("/");
        for (int i = parts.length - 1; i >= 0; i--) {
            if (!parts[i].isEmpty()) return parts[i];
        }
        return null;
    }

    private String lookupTitleByTypeAndSlug(String pageType, String slug) {
        String moduleKey = null;
        switch (pageType.toLowerCase()) {
            case "product": moduleKey = "products"; break;
            case "solution": moduleKey = "solutions"; break;
            case "case": moduleKey = "cases"; break;
            case "resource": moduleKey = "resources"; break;
            default: return null;
        }
        ContentItem item = contentItemMapper.findByModuleAndSlug(moduleKey, slug);
        return item != null ? item.getTitle() : null;
    }

    private String formatUrlAsReadable(String url) {
        if (url == null || url.isEmpty()) return "未知页面";
        String[] parts = url.split("/");
        String last = parts[parts.length - 1];
        if (last == null || last.isEmpty()) {
            if (parts.length > 1) last = parts[parts.length - 2];
            else return "首页";
        }
        String decoded = decodeUrlSegment(last);
        if (decoded == null || decoded.equals(last)) {
            String stripped = stripTrailingDigits(last);
            return Arrays.stream(stripped.split("-"))
                    .map(word -> {
                        if (word.isEmpty()) return "";
                        return Character.toUpperCase(word.charAt(0)) + word.substring(1);
                    })
                    .filter(w -> !w.isEmpty())
                    .collect(Collectors.joining(" "));
        }
        return stripTrailingDigits(decoded);
    }
}
