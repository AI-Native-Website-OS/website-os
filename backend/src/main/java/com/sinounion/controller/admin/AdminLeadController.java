package com.sinounion.controller.admin;

import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.dto.MergeLeadsDTO;
import com.sinounion.entity.Lead;
import com.sinounion.entity.LeadActivity;
import com.sinounion.entity.User;
import com.sinounion.mapper.UserMapper;
import com.sinounion.service.LeadService;
import com.sinounion.vo.DuplicateGroupVO;
import com.sinounion.vo.LeadFilterOptionsVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import java.util.List;

@Tag(name = "管理后台-线索管理", description = "线索管理接口")
@RestController
@RequestMapping("/admin/leads")
@RequiredArgsConstructor
public class AdminLeadController {

    private final LeadService leadService;
    private final UserMapper userMapper;

    @Operation(summary = "获取线索列表")
    @GetMapping
    @PreAuthorize("hasAuthority('lead:view')")
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

    @Operation(summary = "获取筛选选项")
    @GetMapping("/filter-options")
    @PreAuthorize("hasAuthority('lead:view')")
    public Result<LeadFilterOptionsVO> getFilterOptions() {
        return Result.success(leadService.getFilterOptions());
    }

    @Operation(summary = "获取线索详情")
    @GetMapping("/{id:\\d+}")
    @PreAuthorize("hasAuthority('lead:view')")
    public Result<Lead> getLead(@PathVariable Long id) {
        return Result.success(leadService.getLeadById(id));
    }

    @Operation(summary = "更新线索")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('lead:update')")
    public Result<Lead> update(@PathVariable Long id, @Valid @RequestBody Lead lead) {
        return Result.success(leadService.updateLead(id, lead));
    }

    @Operation(summary = "分配线索")
    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAuthority('lead:assign')")
    public Result<Void> assign(@PathVariable Long id, @RequestParam Long userId) {
        leadService.assignLead(id, userId);
        return Result.success(null);
    }

    @Operation(summary = "更新线索状态")
    @PostMapping("/{id}/status")
    @PreAuthorize("hasAuthority('lead:update')")
    public Result<Void> updateStatus(@PathVariable Long id, @RequestParam String status) {
        leadService.updateLeadStatus(id, status);
        return Result.success(null);
    }

    @Operation(summary = "添加跟进记录")
    @PostMapping("/{id}/activities")
    @PreAuthorize("hasAuthority('lead:update')")
    public Result<Void> addActivity(@PathVariable Long id, @Valid @RequestBody LeadActivity activity) {
        leadService.addLeadActivity(id, activity);
        return Result.success(null);
    }

    @Operation(summary = "获取跟进记录")
    @GetMapping("/{id}/activities")
    @PreAuthorize("hasAuthority('lead:view')")
    public Result<List<LeadActivity>> getActivities(@PathVariable Long id) {
        return Result.success(leadService.getLeadActivities(id));
    }

    @Operation(summary = "批量更新状态")
    @PostMapping("/batch-status")
    @PreAuthorize("hasAuthority('lead:update')")
    public Result<Void> batchUpdateStatus(@RequestBody List<Long> ids, @RequestParam String status) {
        leadService.batchUpdateStatus(ids, status);
        return Result.success(null);
    }

    @Operation(summary = "批量删除")
    @PostMapping("/batch-delete")
    @PreAuthorize("hasAuthority('lead:update')")
    public Result<Void> batchDelete(@RequestBody List<Long> ids) {
        leadService.batchDelete(ids);
        return Result.success(null);
    }

    @Operation(summary = "删除线索")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('lead:update')")
    public Result<Void> delete(@PathVariable Long id) {
        leadService.deleteLead(id);
        return Result.success(null);
    }

    @Operation(summary = "获取疑似重复线索分组")
    @GetMapping("/duplicates")
    @PreAuthorize("hasAuthority('lead:view')")
    public Result<List<DuplicateGroupVO>> duplicates(@RequestParam String condition) {
        return Result.success(leadService.getDuplicateGroups(condition));
    }

    @Operation(summary = "合并线索")
    @PostMapping("/merge")
    @PreAuthorize("hasAuthority('lead:update')")
    public Result<Lead> merge(@Valid @RequestBody MergeLeadsDTO dto, Authentication authentication) {
        Long operatorId = null;
        if (authentication != null && authentication.getPrincipal() instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            User user = userMapper.findByUsername(userDetails.getUsername());
            if (user != null) operatorId = user.getId();
        }
        return Result.success(leadService.mergeLeads(dto.getPrimaryId(), dto.getMergedIds(), dto.getCondition(), operatorId));
    }

    @Operation(summary = "导出线索")
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('lead:export')")
    public void export(
            @RequestParam(required = false) String ids,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            HttpServletResponse response) {
        leadService.exportLeads(ids, status, startDate, endDate, keyword, sortBy, sortOrder, response);
    }
}
