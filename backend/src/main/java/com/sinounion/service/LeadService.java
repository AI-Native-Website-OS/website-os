package com.sinounion.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.entity.Lead;
import com.sinounion.entity.LeadActivity;
import com.sinounion.vo.DuplicateGroupVO;
import com.sinounion.vo.LeadFilterOptionsVO;

import javax.servlet.http.HttpServletResponse;
import java.util.List;

public interface LeadService {
    Lead createLead(Lead lead);
    Lead updateLead(Long id, Lead lead);
    Lead getLeadById(Long id);
    Lead getLeadByPhoneAndSource(String phone, String source);
    Lead getLeadByEmailAndSource(String email, String source);
    Lead getLeadBySourcePageUnhandled(String sourcePage, String ip, String phone, String email);
    Page<Lead> getLeads(int page, int size, String status, String keyword, String sortBy, String sortOrder,
                        String startDate, String endDate, String name, String company, String phone,
                        String sourcePage, String ipAddress, String location);
    LeadFilterOptionsVO getFilterOptions();
    void assignLead(Long leadId, Long userId);
    void updateLeadStatus(Long leadId, String status);
    void addLeadActivity(Long leadId, LeadActivity activity);
    List<LeadActivity> getLeadActivities(Long leadId);
    void deleteLead(Long id);
    void batchUpdateStatus(List<Long> ids, String status);
    void batchDelete(List<Long> ids);
    void exportLeads(String ids, String status, String startDate, String endDate, String keyword, String sortBy, String sortOrder, HttpServletResponse response);

    Lead createLeadFromVisitor(String visitorId, String sourcePage, String interestArea, String metadata);

    void updateLeadIp(Long id, String ipAddress, String country, String province, String city);

    List<DuplicateGroupVO> getDuplicateGroups(String condition);

    Lead mergeLeads(Long primaryId, List<Long> mergedIds, String condition, Long operatorId);
}
