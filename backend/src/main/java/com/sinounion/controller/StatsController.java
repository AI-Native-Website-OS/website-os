package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.service.StatsService;
import com.sinounion.util.ClientIpResolver;
import com.sinounion.util.IpLocationService;
import com.sinounion.vo.DashboardStatsVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;

@Tag(name = "统计管理", description = "数据统计接口")
@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;
    private final IpLocationService ipLocationService;
    private final ClientIpResolver clientIpResolver;

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
            @RequestParam(required = false) String userAgent,
            @RequestParam(required = false) String referer,
            HttpServletRequest request,
            Authentication authentication) {
        Long userId = null;
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof org.springframework.security.core.userdetails.User) {
                String username = ((org.springframework.security.core.userdetails.User) principal).getUsername();
                userId = statsService.getUserIdByUsername(username);
            }
        }
        // 归属地以服务端解析的真实客户端 IP 为准，不信任前端传值（与线索提交复用同一解析器）
        String clientIp = clientIpResolver.resolve(request);
        String[] location = ipLocationService.lookup(clientIp);
        statsService.recordPageView(pageType, pageId, userId, pageUrl, visitorId, clientIp, userAgent, referer,
                location[0], location[1], location[2]);
        return Result.success("记录成功");
    }

    @Operation(summary = "记录页面停留时长")
    @PostMapping("/page-leave")
    public Result<?> recordPageLeave(
            @RequestParam String visitorId,
            @RequestParam String pageUrl,
            @RequestParam Integer duration) {
        statsService.updatePageDuration(visitorId, pageUrl, duration);
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
