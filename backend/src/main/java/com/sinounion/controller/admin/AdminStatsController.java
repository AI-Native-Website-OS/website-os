package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.service.StatsService;
import com.sinounion.vo.DashboardStatsVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "管理后台-数据统计", description = "数据统计接口")
@RestController
@RequestMapping("/admin/stats")
@RequiredArgsConstructor
public class AdminStatsController {

    private final StatsService statsService;

    @Operation(summary = "获取仪表盘统计数据")
    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<DashboardStatsVO> getDashboardStats() {
        return Result.success(statsService.getDashboardStats());
    }

    @Operation(summary = "周流量趋势（近7天PV/UV）")
    @GetMapping("/chart/weekly-trend")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getWeeklyTrend() {
        return Result.success(statsService.getWeeklyTrend());
    }

    @Operation(summary = "访问时段分布")
    @GetMapping("/chart/hourly-distribution")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getHourlyDistribution() {
        return Result.success(statsService.getHourlyDistribution());
    }

    @Operation(summary = "页面类型分布")
    @GetMapping("/chart/page-type-distribution")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getPageTypeDistribution() {
        return Result.success(statsService.getPageTypeDistribution());
    }

    @Operation(summary = "具体页面URL访问分布")
    @GetMapping("/chart/page-url-distribution")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getPageUrlDistribution() {
        return Result.success(statsService.getPageUrlDistribution());
    }

    @Operation(summary = "每日浏览量（近7天）")
    @GetMapping("/chart/daily-views")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getDailyViews() {
        return Result.success(statsService.getDailyViews());
    }

    @Operation(summary = "线索来源分布")
    @GetMapping("/chart/lead-sources")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getLeadSources() {
        return Result.success(statsService.getLeadSources());
    }

    @Operation(summary = "月度线索趋势")
    @GetMapping("/chart/monthly-lead-trend")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getMonthlyLeadTrend() {
        return Result.success(statsService.getMonthlyLeadTrend());
    }

    @Operation(summary = "月度表单提交趋势")
    @GetMapping("/chart/monthly-submission-trend")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getMonthlySubmissionTrend() {
        return Result.success(statsService.getMonthlySubmissionTrend());
    }

    @Operation(summary = "周对话趋势（近7天）")
    @GetMapping("/chart/weekly-chat-trend")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getWeeklyChatTrend() {
        return Result.success(statsService.getWeeklyChatTrend());
    }

    @Operation(summary = "内容类别统计")
    @GetMapping("/chart/content-categories")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getContentCategories() {
        return Result.success(statsService.getContentCategories());
    }

    @Operation(summary = "转化漏斗")
    @GetMapping("/chart/conversion-funnel")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<List<Map<String, Object>>> getConversionFunnel() {
        return Result.success(statsService.getConversionFunnel());
    }

    @Operation(summary = "线索管道数据")
    @GetMapping("/chart/lead-pipeline")
    @PreAuthorize("hasAuthority('stats:view')")
    public Result<Map<String, Object>> getLeadPipeline() {
        return Result.success(statsService.getLeadPipeline());
    }
}
