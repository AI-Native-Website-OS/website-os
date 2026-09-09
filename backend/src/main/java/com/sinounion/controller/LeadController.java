package com.sinounion.controller;

import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.entity.Lead;
import com.sinounion.entity.LeadActivity;
import com.sinounion.entity.User;
import com.sinounion.mapper.UserMapper;
import com.sinounion.service.LeadService;
import com.sinounion.util.IpLocationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;

@Tag(name = "线索管理", description = "线索相关接口")
@RestController
@RequestMapping("/leads")
@RequiredArgsConstructor
public class LeadController {

    private final LeadService leadService;
    private final IpLocationService ipLocationService;
    private final UserMapper userMapper;

    /**
     * 是否信任反向代理透传的 X-Real-IP / X-Forwarded-For 头。
     * 浏览器直连后端端口（nginx 不透传任何 IP 头）时应为 false，仅信任 TCP 连接真实来源 IP。
     */
    @Value("${app.trust-proxy-ip-header:true}")
    private boolean trustProxyIpHeader;

    @Operation(summary = "创建线索")
    @PostMapping
    public Result<Lead> createLead(@Valid @RequestBody Lead lead, HttpServletRequest request, Authentication authentication) {
        enrichClientIp(lead, request);
        // 登录用户联系信息以账号为准，忽略前端传值，避免更换姓名/公司/手机/邮箱绕过防重复提交
        applyAuthenticatedIdentity(lead, authentication);
        boolean hasSourcePage = lead.getSourcePage() != null && !lead.getSourcePage().isEmpty();
        if (hasSourcePage) {
            // 同一详情页已提交且后台未处理（status=new）时禁止重复提交：IP/手机/邮箱任一命中即拦截，
            // 避免仅更换姓名/公司/手机/邮箱绕过；后台处理后状态不再为 new，即可重新提交
            Lead existing = leadService.getLeadBySourcePageUnhandled(
                    lead.getSourcePage(), nonLoopbackIp(lead.getIpAddress()), lead.getPhone(), lead.getEmail());
            if (existing != null) {
                return Result.error(400, "duplicate_submission");
            }
        } else {
            if (lead.getPhone() != null && !lead.getPhone().isEmpty()) {
                Lead existing = leadService.getLeadByPhoneAndSource(lead.getPhone(), lead.getSource());
                if (existing != null) {
                    return Result.error(400, "duplicate_submission");
                }
            }
            if (lead.getEmail() != null && !lead.getEmail().isEmpty()) {
                Lead existing = leadService.getLeadByEmailAndSource(lead.getEmail(), lead.getSource());
                if (existing != null) {
                    return Result.error(400, "duplicate_submission");
                }
            }
        }
        return Result.success(leadService.createLead(lead));
    }

    @Operation(summary = "获取线索列表")
    @GetMapping
    public Result<PageResult<Lead>> getLeads(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String sourcePage,
            @RequestParam(required = false) String ipAddress,
            @RequestParam(required = false) String location) {
        return Result.success(PageResult.of(leadService.getLeads(page, size, status, keyword, sortBy, sortOrder, startDate, endDate, name, company, phone, sourcePage, ipAddress, location)));
    }

    @Operation(summary = "获取线索详情")
    @GetMapping("/{id}")
    public Result<Lead> getLead(@PathVariable Long id) {
        return Result.success(leadService.getLeadById(id));
    }

    @Operation(summary = "更新线索状态")
    @PutMapping("/{id}/status")
    public Result<?> updateLeadStatus(@PathVariable Long id, @RequestParam String status) {
        leadService.updateLeadStatus(id, status);
        return Result.success("更新成功");
    }

    @Operation(summary = "分配线索")
    @PutMapping("/{id}/assign")
    public Result<?> assignLead(@PathVariable Long id, @RequestParam Long userId) {
        leadService.assignLead(id, userId);
        return Result.success("分配成功");
    }

    @Operation(summary = "获取线索跟进记录")
    @GetMapping("/{id}/activities")
    public Result<List<LeadActivity>> getLeadActivities(@PathVariable Long id) {
        return Result.success(leadService.getLeadActivities(id));
    }

    @Operation(summary = "添加线索跟进记录")
    @PostMapping("/{id}/activities")
    public Result<?> addLeadActivity(@PathVariable Long id, @Valid @RequestBody LeadActivity activity) {
        leadService.addLeadActivity(id, activity);
        return Result.success("添加成功");
    }

    @Operation(summary = "从访客行为创建线索")
    @PostMapping("/from-visitor")
    public Result<Lead> createLeadFromVisitor(
            @RequestParam String visitorId,
            @RequestParam(required = false) String sourcePage,
            @RequestParam(required = false) String interestArea,
            @RequestParam(required = false) String metadata,
            HttpServletRequest request) {
        Lead lead = leadService.createLeadFromVisitor(visitorId, sourcePage, interestArea, metadata);
        if (lead.getIpAddress() == null || lead.getIpAddress().isEmpty()) {
            enrichClientIp(lead, request);
            leadService.updateLeadIp(lead.getId(), lead.getIpAddress(), lead.getCountry(), lead.getProvince(), lead.getCity());
        }
        return Result.success(lead);
    }

    /**
     * 从服务端请求中提取真实客户端 IP（X-Forwarded-For → remoteAddr），并解析归属地。
     * 不信任前端传值，避免伪造。
     */
    private void enrichClientIp(Lead lead, HttpServletRequest request) {
        String ip = getClientIp(request);
        lead.setIpAddress(ip);
        String[] location = ipLocationService.lookup(ip);
        lead.setCountry(location[0]);
        lead.setProvince(location[1]);
        lead.setCity(location[2]);
    }

    private String getClientIp(HttpServletRequest request) {
        if (trustProxyIpHeader) {
            String realIp = request.getHeader("X-Real-IP");
            if (realIp != null && !realIp.isEmpty() && !"unknown".equalsIgnoreCase(realIp)) {
                return realIp;
            }
            String xfHeader = request.getHeader("X-Forwarded-For");
            if (xfHeader != null && !xfHeader.isEmpty()) {
                String first = xfHeader.split(",")[0].trim();
                if (!first.isEmpty() && !"unknown".equalsIgnoreCase(first)) {
                    return first;
                }
            }
        }
        return request.getRemoteAddr();
    }

    /**
     * 已登录用户提交线索时，姓名/公司/手机/邮箱一律以账号信息为准，
     * 防止恶意用户通过修改表单字段绕过防重复提交。
     */
    private void applyAuthenticatedIdentity(Lead lead, Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return;
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof org.springframework.security.core.userdetails.User)) return;
        String username = ((org.springframework.security.core.userdetails.User) principal).getUsername();
        User user = userMapper.findByUsername(username);
        if (user == null) return;
        if (StringUtils.hasText(user.getRealName())) lead.setName(user.getRealName());
        if (StringUtils.hasText(user.getCompanyName())) lead.setCompany(user.getCompanyName());
        if (StringUtils.hasText(user.getPhone())) lead.setPhone(user.getPhone());
        if (StringUtils.hasText(user.getEmail())) lead.setEmail(user.getEmail());
    }

    /**
     * 回环地址（本机/本地开发环境）不代表真实访客，排除其参与 IP 去重，
     * 避免本地开发时所有请求共享 127.0.0.1 导致同页线索互相拦截。
     */
    private String nonLoopbackIp(String ip) {
        if (ip == null) return null;
        if (ip.startsWith("127.") || "::1".equals(ip) || "0:0:0:0:0:0:0:1".equals(ip)) return null;
        return ip;
    }
}
