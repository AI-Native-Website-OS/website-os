package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.service.StatsService;
import com.sinounion.vo.DashboardStatsVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Tag(name = "统计管理", description = "数据统计接口")
@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    @Operation(summary = "获取仪表盘统计数据")
    @GetMapping("/dashboard")
    public Result<DashboardStatsVO> getDashboardStats() {
        return Result.success(statsService.getDashboardStats());
    }

    @Operation(summary = "记录页面访问")
    @PostMapping("/page-view")
    public Result<?> recordPageView(
            @RequestParam String pageType,
            @RequestParam(required = false) Long pageId,
            @RequestParam String pageUrl,
            @RequestParam String visitorId,
            @RequestParam String ipAddress,
            @RequestParam(required = false) String userAgent,
            @RequestParam(required = false) String referer,
            Authentication authentication) {
        Long userId = null;
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof org.springframework.security.core.userdetails.User) {
                String username = ((org.springframework.security.core.userdetails.User) principal).getUsername();
                userId = statsService.getUserIdByUsername(username);
            }
        }
        statsService.recordPageView(pageType, pageId, userId, pageUrl, visitorId, ipAddress, userAgent, referer);
        return Result.success("记录成功");
    }

    @Operation(summary = "记录用户行为")
    @PostMapping("/behavior")
    public Result<?> recordBehavior(
            @RequestParam String visitorId,
            @RequestParam String behaviorType,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) Long targetId,
            @RequestParam(required = false) String metadata) {
        statsService.recordBehavior(visitorId, behaviorType, targetType, targetId, metadata);
        return Result.success("记录成功");
    }
}
