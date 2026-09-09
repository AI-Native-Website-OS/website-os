package com.sinounion.vo;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class DashboardStatsVO {
    private Integer todayViews;
    private Integer todayUniqueVisitors;
    private Integer todayLeads;
    private Long totalResources;
    private Integer todayAiChats;
    private Integer todayFormSubmits;
    private Integer todayDownloads;
    private List<Map<String, Object>> topPages;
}
