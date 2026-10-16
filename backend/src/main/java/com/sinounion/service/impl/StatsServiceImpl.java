package com.sinounion.service.impl;

import com.sinounion.entity.*;
import com.sinounion.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.service.StatsService;
import com.sinounion.vo.DashboardStatsVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URLDecoder;
import java.time.LocalDate;
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
    private final AiChatMapper aiChatMapper;
    private final ActivityTrendMapper activityTrendMapper;

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
        vo.setTopPages(mergeByPageTitle(topPages));

        vo.setTodayAiChats(safeAiChat(aiChatMapper::countTodayUserMessages));
        vo.setTodayFormSubmits(contactSubmissionMapper.countTodaySubmissions());
        vo.setTodayDownloads(nullSafe(behaviorMapper.countBehaviorToday("download")));

        vo.setYesterdayViews(pageViewMapper.countYesterdayViews());
        vo.setYesterdayUniqueVisitors(pageViewMapper.countYesterdayUniqueVisitors());
        vo.setYesterdayLeads(leadMapper.countYesterdayLeads());
        vo.setYesterdayFormSubmits(contactSubmissionMapper.countYesterdaySubmissions());
        vo.setYesterdayAiChats(safeAiChat(aiChatMapper::countYesterdayUserMessages));
        vo.setYesterdayDownloads(nullSafe(behaviorMapper.countBehaviorYesterday("download")));

        return vo;
    }

    private static int nullSafe(Integer v) {
        return v == null ? 0 : v;
    }

    /**
     * AI 会话表由 Python 服务管理，可能尚未初始化，查询失败时降级为 0，不影响仪表盘。
     */
    private static int safeAiChat(java.util.function.Supplier<Integer> query) {
        try {
            return nullSafe(query.get());
        } catch (Exception e) {
            return 0;
        }
    }

    @Override
    public List<Map<String, Object>> getWeeklyTrend() {
        return fillDailyTrend(pageViewMapper.findWeeklyTrend(), 7);
    }

    @Override
    public List<Map<String, Object>> getTrafficTrend30d() {
        return fillDailyTrend(pageViewMapper.findTrafficTrend30Days(), 30);
    }

    /**
     * 补齐指定天数的每日序列：数据库缺失的日期以 0 填充，
     * 保证「7天」「30天」即使数据不足也分别完整展示对应天数。
     */
    private List<Map<String, Object>> fillDailyTrend(List<Map<String, Object>> rows, int days) {
        Map<String, long[]> buckets = new LinkedHashMap<>();
        LocalDate since = LocalDate.now().minusDays(days - 1);
        for (int i = 0; i < days; i++) buckets.put(since.plusDays(i).toString(), new long[2]);
        for (Map<String, Object> r : rows) {
            Object d = r.get("date");
            if (d == null) continue;
            String key = d.toString();
            if (key.length() > 10) key = key.substring(0, 10);
            long[] arr = buckets.get(key);
            if (arr == null) continue;
            arr[0] += toLong(r.get("pageViews"));
            arr[1] += toLong(r.get("uniqueVisitors"));
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<String, long[]> e : buckets.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", e.getKey());
            m.put("pageViews", e.getValue()[0]);
            m.put("uniqueVisitors", e.getValue()[1]);
            result.add(m);
        }
        return result;
    }

    @Override
    public List<Map<String, Object>> getActivityTrend(String range) {
        boolean hourly = range == null || "today".equals(range) || "yesterday".equals(range);
        List<Map<String, Object>> result = new ArrayList<>();

        if (hourly) {
            LocalDate day = "yesterday".equals(range) ? LocalDate.now().minusDays(1) : LocalDate.now();
            long[][] buckets = new long[24][3];
            applyHourly(buckets, () -> activityTrendMapper.hourlyLeads(day), 0);
            applyHourly(buckets, () -> activityTrendMapper.hourlyDownloads(day), 1);
            applyHourly(buckets, () -> activityTrendMapper.hourlyAiChats(day), 2);
            for (int h = 0; h < 24; h++) result.add(item(String.valueOf(h), buckets[h]));
        } else {
            int days = "30d".equals(range) ? 30 : 7;
            LocalDate since = LocalDate.now().minusDays(days - 1);
            Map<String, long[]> buckets = new LinkedHashMap<>();
            for (int i = 0; i < days; i++) buckets.put(since.plusDays(i).toString(), new long[3]);
            applyDaily(buckets, () -> activityTrendMapper.dailyLeads(since), 0);
            applyDaily(buckets, () -> activityTrendMapper.dailyDownloads(since), 1);
            applyDaily(buckets, () -> activityTrendMapper.dailyAiChats(since), 2);
            for (Map.Entry<String, long[]> e : buckets.entrySet()) result.add(item(e.getKey(), e.getValue()));
        }
        return result;
    }

    private void applyHourly(long[][] buckets, java.util.concurrent.Callable<List<Map<String, Object>>> query, int idx) {
        try {
            for (Map<String, Object> r : query.call()) {
                int h = (int) toLong(r.get("h"));
                if (h >= 0 && h < 24) buckets[h][idx] += toLong(r.get("c"));
            }
        } catch (Exception ignored) {
            // 数据源表可能未初始化，降级为 0
        }
    }

    private void applyDaily(Map<String, long[]> buckets, java.util.concurrent.Callable<List<Map<String, Object>>> query, int idx) {
        try {
            for (Map<String, Object> r : query.call()) {
                Object d = r.get("d");
                long[] arr = d == null ? null : buckets.get(d.toString());
                if (arr != null) arr[idx] += toLong(r.get("c"));
            }
        } catch (Exception ignored) {
            // 数据源表可能未初始化，降级为 0
        }
    }

    private Map<String, Object> item(String key, long[] v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("leads", v[0]);
        m.put("downloads", v[1]);
        m.put("aiChats", v[2]);
        return m;
    }

    @Override
    public List<Map<String, Object>> getHourlyDistribution() {
        return pageViewMapper.findHourlyDistribution();
    }

    @Override
    public List<Map<String, Object>> getHourlyDistributionYesterday() {
        return pageViewMapper.findHourlyDistributionYesterday();
    }

    @Override
    public List<Map<String, Object>> getGeoDistribution(String scope, String source) {
        boolean byProvince = !"world".equalsIgnoreCase(scope);
        boolean withVisits = !"lead".equalsIgnoreCase(source);
        boolean withLeads = !"visit".equalsIgnoreCase(source);

        List<Map<String, Object>> visits = withVisits
                ? (byProvince ? pageViewMapper.geoDistributionByProvince() : pageViewMapper.geoDistributionByCountry())
                : new ArrayList<>();
        List<Map<String, Object>> leads = withLeads
                ? (byProvince ? leadMapper.geoDistributionByProvince() : leadMapper.geoDistributionByCountry())
                : new ArrayList<>();

        if (withVisits && !withLeads) return normalizeGeo(visits);
        if (withLeads && !withVisits) return normalizeGeo(leads);

        Map<String, Long> merged = new LinkedHashMap<>();
        for (Map<String, Object> m : visits) merged.merge(String.valueOf(m.get("name")), toLong(m.get("value")), Long::sum);
        for (Map<String, Object> m : leads) merged.merge(String.valueOf(m.get("name")), toLong(m.get("value")), Long::sum);

        List<Map<String, Object>> result = new ArrayList<>();
        merged.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .forEach(e -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("name", e.getKey());
                    item.put("value", e.getValue());
                    result.add(item);
                });
        return result;
    }

    private List<Map<String, Object>> normalizeGeo(List<Map<String, Object>> raw) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> m : raw) {
            Map<String, Object> item = new HashMap<>();
            item.put("name", m.get("name"));
            item.put("value", toLong(m.get("value")));
            result.add(item);
        }
        return result;
    }

    private long toLong(Object v) {
        if (v == null) return 0L;
        if (v instanceof Number) return ((Number) v).longValue();
        try {
            return Long.parseLong(v.toString());
        } catch (Exception e) {
            return 0L;
        }
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
    public void recordPageView(String pageType, Long pageId, Long userId, String pageUrl, String visitorId, String ipAddress, String userAgent, String referer, String country, String province, String city) {
        PageView pageView = new PageView();
        pageView.setPageType(pageType);
        pageView.setPageId(pageId);
        pageView.setUserId(userId);
        pageView.setPageUrl(pageUrl);
        pageView.setVisitorId(visitorId);
        pageView.setIpAddress(ipAddress);
        pageView.setCountry(country);
        pageView.setProvince(province);
        pageView.setCity(city);
        pageView.setUserAgent(userAgent);
        pageView.setReferer(referer);
        pageViewMapper.insert(pageView);
    }

    @Override
    public void updatePageDuration(String visitorId, String pageUrl, Integer duration) {
        if (visitorId == null || pageUrl == null || duration == null) return;
        int secs = Math.max(0, Math.min(duration, 7200));
        pageViewMapper.updateLastDuration(visitorId, pageUrl, secs);
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
            Object moduleNameValue = item.get("module_name");
            String moduleName = moduleNameValue != null ? moduleNameValue.toString() : null;
            if (pageType == null || pageUrl == null) continue;

            if (pageUrl.equals("/")) {
                item.put("page_title", "首页");
                continue;
            }

            String slug = extractSlugFromUrl(pageUrl);
            if (slug == null || slug.isEmpty()) {
                // 列表/包裹页（无 slug），用模块名而非 URL 末段，避免出现 "Category" 之类无意义标题
                item.put("page_title", titleFromModule(moduleName, pageUrl, false));
                continue;
            }

            String decodedSlug = decodeUrlSegment(slug);
            String cleanSlug = stripTrailingDigits(decodedSlug);
            String pageTitle = lookupTitleByTypeAndSlug(pageType, cleanSlug);
            if (pageTitle != null) {
                item.put("page_title", pageTitle);
            } else {
                // 详情包裹页（有 slug 但未匹配到内容），用模块名而非 "Detail"
                item.put("page_title", titleFromModule(moduleName, pageUrl, true));
            }
        }
    }

    private String titleFromModule(String moduleName, String pageUrl, boolean detail) {
        if (moduleName != null && !moduleName.trim().isEmpty()) {
            return moduleName + (detail ? "详情" : "列表");
        }
        return formatUrlAsReadable(pageUrl);
    }

    /**
     * 按展示标题合并去重：同一标题（例如同一内容的不同 URL 变体、同名模块）只保留一行，
     * 访问量相加，停留时长按访问量加权平均，最后按「访问量 × 平均停留时长」排序取前 10。
     */
    private List<Map<String, Object>> mergeByPageTitle(List<Map<String, Object>> items) {
        Map<String, Map<String, Object>> byTitle = new LinkedHashMap<>();
        for (Map<String, Object> item : items) {
            Object titleValue = item.get("page_title");
            String title = titleValue != null ? titleValue.toString() : "";
            Map<String, Object> agg = byTitle.get(title);
            if (agg == null) {
                byTitle.put(title, new HashMap<>(item));
            } else {
                long prevViews = toLong(agg.get("view_count"));
                long addViews = toLong(item.get("view_count"));
                long totalViews = prevViews + addViews;
                double mergedAvg = totalViews > 0
                        ? (toDouble(agg.get("avg_duration")) * prevViews + toDouble(item.get("avg_duration")) * addViews) / totalViews
                        : 0d;
                agg.put("view_count", totalViews);
                agg.put("avg_duration", Math.round(mergedAvg));
            }
        }
        List<Map<String, Object>> merged = new ArrayList<>(byTitle.values());
        merged.sort((a, b) -> Long.compare(topPageScore(b), topPageScore(a)));
        return merged.size() > 10 ? new ArrayList<>(merged.subList(0, 10)) : merged;
    }

    private long topPageScore(Map<String, Object> item) {
        return Math.round(toLong(item.get("view_count")) * toDouble(item.get("avg_duration")));
    }

    private double toDouble(Object v) {
        if (v == null) return 0d;
        if (v instanceof Number) return ((Number) v).doubleValue();
        try {
            return Double.parseDouble(v.toString());
        } catch (Exception e) {
            return 0d;
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
        String path = url;
        int q = url.indexOf('?');
        if (q >= 0) {
            String query = url.substring(q + 1);
            for (String kv : query.split("&")) {
                int eq = kv.indexOf('=');
                if (eq > 0 && "slug".equals(kv.substring(0, eq))) {
                    String value = kv.substring(eq + 1);
                    if (!value.isEmpty()) return value;
                }
            }
            path = url.substring(0, q);
        }
        String[] parts = path.split("/");
        for (int i = parts.length - 1; i >= 0; i--) {
            if (!parts[i].isEmpty()) return parts[i];
        }
        return null;
    }

    private String lookupTitleByTypeAndSlug(String pageType, String slug) {
        if (pageType == null) return null;
        String moduleKey;
        switch (pageType.toLowerCase()) {
            case "product": moduleKey = "products"; break;
            case "solution": moduleKey = "solutions"; break;
            case "case": moduleKey = "cases"; break;
            case "resource": moduleKey = "resources"; break;
            default: moduleKey = pageType;
        }
        ContentItem item = contentItemMapper.findByModuleAndSlug(moduleKey, slug);
        return item != null ? item.getTitle() : null;
    }

    private String formatUrlAsReadable(String url) {
        if (url == null || url.isEmpty()) return "未知页面";
        int q = url.indexOf('?');
        if (q >= 0) url = url.substring(0, q);
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
