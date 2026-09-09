package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.Lead;
import com.sinounion.entity.LeadActivity;
import com.sinounion.mapper.LeadActivityMapper;
import com.sinounion.mapper.LeadMapper;
import com.sinounion.service.LeadService;
import com.sinounion.vo.DuplicateGroupVO;
import com.sinounion.vo.LeadFilterOptionsVO;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.servlet.http.HttpServletResponse;
import java.net.URLEncoder;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LeadServiceImpl implements LeadService {

    private final LeadMapper leadMapper;
    private final LeadActivityMapper activityMapper;

    @Override
    public Lead createLead(Lead lead) {
        if (lead.getScore() == null || lead.getScore() == 0) {
            lead.setScore(LeadScoreCalculator.calculateScore(lead));
        }
        leadMapper.insert(lead);
        return lead;
    }

    @Override
    public Lead updateLead(Long id, Lead lead) {
        lead.setId(id);
        lead.setScore(LeadScoreCalculator.calculateScore(lead));
        leadMapper.updateById(lead);
        return lead;
    }

    @Override
    public Lead getLeadById(Long id) {
        return leadMapper.selectById(id);
    }

    @Override
    public Lead getLeadByPhoneAndSource(String phone, String source) {
        return leadMapper.findByPhoneAndSource(phone, source);
    }

    @Override
    public Lead getLeadByEmailAndSource(String email, String source) {
        return leadMapper.findByEmailAndSource(email, source);
    }

    @Override
    public Lead getLeadBySourcePageUnhandled(String sourcePage, String ip, String phone, String email) {
        return leadMapper.findDuplicateBySourcePageUnhandled(sourcePage, ip, phone, email);
    }

    @Override
    public Page<Lead> getLeads(int page, int size, String status, String keyword, String sortBy, String sortOrder,
                               String startDate, String endDate, String name, String company, String phone,
                               String sourcePage, String ipAddress, String location) {
        LambdaQueryWrapper<Lead> wrapper = new LambdaQueryWrapper<>();
        if (hasText(status)) {
            wrapper.eq(Lead::getStatus, status);
        }
        if (hasText(keyword)) {
            String kw = keyword.trim();
            wrapper.and(w -> w.like(Lead::getName, kw)
                    .or().like(Lead::getCompany, kw)
                    .or().like(Lead::getPhone, kw)
                    .or().like(Lead::getStatus, kw)
                    .or().apply("CAST(created_at AS TEXT) LIKE {0}", "%" + kw + "%")
                    .or().like(Lead::getSourcePage, kw)
                    .or().like(Lead::getIpAddress, kw)
                    .or().like(Lead::getCountry, kw)
                    .or().like(Lead::getProvince, kw)
                    .or().like(Lead::getCity, kw));
        }
        if (hasText(name)) {
            wrapper.eq(Lead::getName, name.trim());
        }
        if (hasText(company)) {
            wrapper.eq(Lead::getCompany, company.trim());
        }
        if (hasText(phone)) {
            wrapper.eq(Lead::getPhone, phone.trim());
        }
        if (hasText(sourcePage)) {
            wrapper.eq(Lead::getSourcePage, sourcePage.trim());
        }
        if (hasText(ipAddress)) {
            wrapper.eq(Lead::getIpAddress, ipAddress.trim());
        }
        if (hasText(location)) {
            String loc = location.trim();
            String[] parts = loc.split("\\s+", 3);
            if (parts.length == 3) {
                wrapper.and(w -> w.eq(Lead::getCountry, parts[0]).eq(Lead::getProvince, parts[1]).eq(Lead::getCity, parts[2]));
            } else if (parts.length == 2) {
                wrapper.and(w -> w.eq(Lead::getProvince, parts[0]).eq(Lead::getCity, parts[1]));
            } else {
                wrapper.and(w -> w.eq(Lead::getCountry, parts[0]).or().eq(Lead::getProvince, parts[0]).or().eq(Lead::getCity, parts[0]));
            }
        }
        if (hasText(startDate)) {
            wrapper.ge(Lead::getCreatedAt, LocalDate.parse(startDate).atStartOfDay());
        }
        if (hasText(endDate)) {
            wrapper.le(Lead::getCreatedAt, LocalDate.parse(endDate).plusDays(1).atStartOfDay());
        }
        if (sortBy != null && !sortBy.isEmpty()) {
            boolean asc = !"desc".equalsIgnoreCase(sortOrder);
            if ("name".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getName);
            else if ("company".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getCompany);
            else if ("phone".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getPhone);
            else if ("source".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getSource);
            else if ("score".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getScore);
            else if ("status".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getStatus);
            else if ("createdAt".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getCreatedAt);
            else wrapper.orderByDesc(Lead::getCreatedAt);
        } else {
            wrapper.orderByDesc(Lead::getCreatedAt);
        }
        return leadMapper.selectPage(new Page<>(page, size), wrapper);
    }

    @Override
    public LeadFilterOptionsVO getFilterOptions() {
        LeadFilterOptionsVO vo = new LeadFilterOptionsVO();
        vo.setNames(distinctValues("name"));
        vo.setCompanies(distinctValues("company"));
        vo.setPhones(distinctValues("phone"));
        vo.setSourcePages(distinctValues("source_page"));
        vo.setIps(distinctValues("ip_address"));
        vo.setLocations(distinctLocations());
        return vo;
    }

    private List<String> distinctValues(String column) {
        return leadMapper.selectObjs(new QueryWrapper<Lead>()
                .select("DISTINCT " + column)
                .isNotNull(column)
                .orderByAsc(column))
                .stream()
                .filter(Objects::nonNull)
                .map(String::valueOf)
                .filter(s -> !s.trim().isEmpty())
                .collect(Collectors.toList());
    }

    private List<String> distinctLocations() {
        return leadMapper.selectObjs(new QueryWrapper<Lead>()
                .select("DISTINCT TRIM(CONCAT_WS(' ', country, province, city)) AS location")
                .apply("country IS NOT NULL OR province IS NOT NULL OR city IS NOT NULL")
                .orderByAsc("location"))
                .stream()
                .filter(Objects::nonNull)
                .map(String::valueOf)
                .filter(s -> !s.trim().isEmpty())
                .collect(Collectors.toList());
    }

    private boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }

    @Override
    public void assignLead(Long leadId, Long userId) {
        Lead lead = leadMapper.selectById(leadId);
        lead.setAssignedTo(userId);
        lead.setStatus("contacted");
        leadMapper.updateById(lead);
    }

    @Override
    public void updateLeadStatus(Long leadId, String status) {
        Lead lead = leadMapper.selectById(leadId);
        lead.setStatus(status);
        leadMapper.updateById(lead);
    }

    @Override
    public void deleteLead(Long id) {
        leadMapper.deleteById(id);
    }

    @Override
    public void batchUpdateStatus(List<Long> ids, String status) {
        Lead update = new Lead();
        update.setStatus(status);
        LambdaQueryWrapper<Lead> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(Lead::getId, ids);
        leadMapper.update(update, wrapper);
    }

    @Override
    public void batchDelete(List<Long> ids) {
        leadMapper.deleteBatchIds(ids);
    }

    @Override
    public void addLeadActivity(Long leadId, LeadActivity activity) {
        activity.setLeadId(leadId);
        activityMapper.insert(activity);
    }

    @Override
    public List<LeadActivity> getLeadActivities(Long leadId) {
        return activityMapper.findByLeadId(leadId);
    }

    @Override
    public void exportLeads(String ids, String status, String startDate, String endDate, String keyword, String sortBy, String sortOrder, HttpServletResponse response) {
        try {
            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("线索数据");

            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            setBorder(headerStyle, BorderStyle.THIN);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_50_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerFont.setColor(IndexedColors.BLACK.getIndex());

            CellStyle oddStyle = workbook.createCellStyle();
            setBorder(oddStyle, BorderStyle.THIN);

            CellStyle evenStyle = workbook.createCellStyle();
            setBorder(evenStyle, BorderStyle.THIN);
            evenStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            evenStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row headerRow = sheet.createRow(0);
            String[] headers = {"姓名", "公司", "手机", "邮箱", "来源", "来源页面", "IP", "国家", "省份", "城市", "关注领域", "需求描述", "企业类型", "业务方向", "项目需求", "项目时间线", "评分", "状态", "跟进备注", "创建时间", "更新时间"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            LambdaQueryWrapper<Lead> wrapper = new LambdaQueryWrapper<>();
            if (ids != null && !ids.isEmpty()) {
                List<Long> idList = Arrays.stream(ids.split(","))
                        .map(String::trim)
                        .map(Long::parseLong)
                        .collect(Collectors.toList());
                wrapper.in(Lead::getId, idList);
            }
            if (status != null && !status.isEmpty()) {
                wrapper.eq(Lead::getStatus, status);
            }
            if (keyword != null && !keyword.isEmpty()) {
wrapper.and(w -> w.like(Lead::getName, keyword)
                    .or().like(Lead::getCompany, keyword)
                    .or().like(Lead::getPhone, keyword)
                    .or().like(Lead::getEmail, keyword)
                    .or().like(Lead::getIpAddress, keyword)
                    .or().like(Lead::getCountry, keyword)
                    .or().like(Lead::getCity, keyword));
            }
            if (startDate != null && !startDate.isEmpty()) {
                wrapper.ge(Lead::getCreatedAt, LocalDate.parse(startDate).atStartOfDay());
            }
            if (endDate != null && !endDate.isEmpty()) {
                wrapper.le(Lead::getCreatedAt, LocalDate.parse(endDate).plusDays(1).atStartOfDay());
            }
            if (sortBy != null && !sortBy.isEmpty()) {
                boolean asc = !"desc".equalsIgnoreCase(sortOrder);
                if ("name".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getName);
                else if ("company".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getCompany);
                else if ("phone".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getPhone);
                else if ("source".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getSource);
                else if ("score".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getScore);
                else if ("status".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getStatus);
                else if ("createdAt".equals(sortBy)) wrapper.orderBy(true, asc, Lead::getCreatedAt);
            }
            List<Lead> leads = leadMapper.selectList(wrapper);

            int rowNum = 1;
            for (Lead lead : leads) {
                Row row = sheet.createRow(rowNum);
                CellStyle dataStyle = rowNum % 2 == 0 ? evenStyle : oddStyle;
                row.createCell(0).setCellValue(lead.getName());
                row.createCell(1).setCellValue(lead.getCompany() != null ? lead.getCompany() : "");
                row.createCell(2).setCellValue(lead.getPhone());
                row.createCell(3).setCellValue(lead.getEmail() != null ? lead.getEmail() : "");
                row.createCell(4).setCellValue(lead.getSource() != null ? lead.getSource() : "");
                row.createCell(5).setCellValue(lead.getSourcePage() != null ? lead.getSourcePage() : "");
                row.createCell(6).setCellValue(lead.getIpAddress() != null ? lead.getIpAddress() : "");
                row.createCell(7).setCellValue(lead.getCountry() != null ? lead.getCountry() : "");
                row.createCell(8).setCellValue(lead.getProvince() != null ? lead.getProvince() : "");
                row.createCell(9).setCellValue(lead.getCity() != null ? lead.getCity() : "");
                row.createCell(10).setCellValue(lead.getInterestArea() != null ? lead.getInterestArea() : "");
                row.createCell(11).setCellValue(lead.getRequirement() != null ? lead.getRequirement() : "");
                row.createCell(12).setCellValue(lead.getEnterpriseType() != null ? lead.getEnterpriseType() : "");
                row.createCell(13).setCellValue(lead.getBusinessDirection() != null ? lead.getBusinessDirection() : "");
                row.createCell(14).setCellValue(lead.getProjectRequirement() != null ? lead.getProjectRequirement() : "");
                row.createCell(15).setCellValue(lead.getProjectTimeline() != null ? lead.getProjectTimeline() : "");
                row.createCell(16).setCellValue(lead.getScore() != null ? lead.getScore() : 0);
                row.createCell(17).setCellValue(statusToChinese(lead.getStatus()));
                row.createCell(18).setCellValue(lead.getFollowUpNote() != null ? lead.getFollowUpNote() : "");
                row.createCell(19).setCellValue(lead.getCreatedAt() != null ? lead.getCreatedAt().toString() : "");
                row.createCell(20).setCellValue(lead.getUpdatedAt() != null ? lead.getUpdatedAt().toString() : "");
                for (int i = 0; i < 21; i++) {
                    row.getCell(i).setCellStyle(dataStyle);
                }
                rowNum++;
            }

            String fileName = URLEncoder.encode("leads_" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + ".xlsx", "UTF-8");
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + fileName);
            workbook.write(response.getOutputStream());
            workbook.close();
        } catch (Exception e) {
            throw new RuntimeException("导出线索失败", e);
        }
    }

    private String statusToChinese(String status) {
        if (status == null) return "";
        switch (status) {
            case "new": return "待跟进";
            case "contacted": return "已联系";
            case "qualified": return "有意向";
            case "quoted": return "已报价";
            case "closed": return "已成交";
            case "invalid": return "无效线索";
            default: return status;
        }
    }

    private void setBorder(CellStyle style, BorderStyle border) {
        style.setBorderTop(border);
        style.setBorderBottom(border);
        style.setBorderLeft(border);
        style.setBorderRight(border);
    }

    @Override
    public Lead createLeadFromVisitor(String visitorId, String sourcePage, String interestArea, String metadata) {
        // Check if we already have a lead with this visitorId (stored in metadata or requirement field)
        LambdaQueryWrapper<Lead> existingQuery = new LambdaQueryWrapper<Lead>()
                .like(Lead::getRequirement, "%visitorId:" + visitorId + "%");
        Lead existing = leadMapper.selectOne(existingQuery);
        if (existing != null) {
            // Update existing lead with latest interest area and page
            if (interestArea != null && !interestArea.isEmpty()) {
                existing.setInterestArea(interestArea);
            }
            existing.setScore(existing.getScore() != null ? Math.min(existing.getScore() + 2, 100) : 15);
            leadMapper.updateById(existing);
            return existing;
        }

        Lead lead = new Lead();
        lead.setSource("page_click");
        lead.setSourcePage(sourcePage);
        lead.setInterestArea(interestArea);
        lead.setRequirement("visitorId:" + visitorId + (metadata != null ? "|" + metadata : ""));
        lead.setStatus("new");
        lead.setScore(LeadScoreCalculator.calculateScore(lead));
        leadMapper.insert(lead);
        return lead;
    }

    @Override
    public void updateLeadIp(Long id, String ipAddress, String country, String province, String city) {
        if (id == null) return;
        Lead lead = leadMapper.selectById(id);
        if (lead == null) return;
        if (lead.getIpAddress() == null || lead.getIpAddress().isEmpty()) {
            lead.setIpAddress(ipAddress);
        }
        if (lead.getCountry() == null || lead.getCountry().isEmpty()) {
            lead.setCountry(country);
        }
        if (lead.getProvince() == null || lead.getProvince().isEmpty()) {
            lead.setProvince(province);
        }
        if (lead.getCity() == null || lead.getCity().isEmpty()) {
            lead.setCity(city);
        }
        leadMapper.updateById(lead);
    }

    @Override
    public List<DuplicateGroupVO> getDuplicateGroups(String condition) {
        List<String> keys;
        if ("phone".equals(condition)) {
            keys = leadMapper.findDuplicatePhones();
        } else if ("name".equals(condition)) {
            keys = leadMapper.findDuplicateNames();
        } else if ("company".equals(condition)) {
            keys = leadMapper.findDuplicateCompanies();
        } else {
            throw new BusinessException(400, "无效的查重条件");
        }

        List<DuplicateGroupVO> groups = new ArrayList<>();
        for (String key : keys) {
            if (groups.size() >= 100) break;
            LambdaQueryWrapper<Lead> wrapper = new LambdaQueryWrapper<>();
            if ("phone".equals(condition)) wrapper.eq(Lead::getPhone, key);
            else if ("name".equals(condition)) wrapper.eq(Lead::getName, key);
            else wrapper.eq(Lead::getCompany, key);
            wrapper.orderByAsc(Lead::getCreatedAt).last("LIMIT 50");
            List<Lead> leads = leadMapper.selectList(wrapper);
            if (leads.size() < 2) continue;
            DuplicateGroupVO group = new DuplicateGroupVO();
            group.setKey(key);
            group.setLeads(leads);
            groups.add(group);
        }
        return groups;
    }

    @Override
    @Transactional
    public Lead mergeLeads(Long primaryId, List<Long> mergedIds, String condition, Long operatorId) {
        if (primaryId == null) throw new BusinessException(400, "主线索不能为空");
        if (mergedIds == null || mergedIds.isEmpty()) throw new BusinessException(400, "请至少选择一条要合并的线索");
        if (mergedIds.contains(primaryId)) throw new BusinessException(400, "主线索不能包含在合并列表中");

        Lead primary = leadMapper.selectById(primaryId);
        if (primary == null) throw new BusinessException(400, "主线索不存在");

        List<Lead> merged = leadMapper.selectBatchIds(mergedIds);
        if (merged.size() != mergedIds.size()) throw new BusinessException(400, "存在不存在的线索");

        activityMapper.migrateToLead(primaryId, mergedIds);

        merged.sort(Comparator.comparing(Lead::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())));
        for (Lead m : merged) {
            if (isBlank(primary.getName())) primary.setName(m.getName());
            if (isBlank(primary.getCompany())) primary.setCompany(m.getCompany());
            if (isBlank(primary.getPhone())) primary.setPhone(m.getPhone());
            if (isBlank(primary.getEmail())) primary.setEmail(m.getEmail());
            if (isBlank(primary.getSource())) primary.setSource(m.getSource());
            if (isBlank(primary.getSourcePage())) primary.setSourcePage(m.getSourcePage());
            if (isBlank(primary.getIpAddress())) primary.setIpAddress(m.getIpAddress());
            if (isBlank(primary.getCountry())) primary.setCountry(m.getCountry());
            if (isBlank(primary.getProvince())) primary.setProvince(m.getProvince());
            if (isBlank(primary.getCity())) primary.setCity(m.getCity());
            if (isBlank(primary.getInterestArea())) primary.setInterestArea(m.getInterestArea());
            if (isBlank(primary.getRequirement())) primary.setRequirement(m.getRequirement());
            if (isBlank(primary.getEnterpriseType())) primary.setEnterpriseType(m.getEnterpriseType());
            if (isBlank(primary.getBusinessDirection())) primary.setBusinessDirection(m.getBusinessDirection());
            if (isBlank(primary.getProjectRequirement())) primary.setProjectRequirement(m.getProjectRequirement());
            if (isBlank(primary.getProjectTimeline())) primary.setProjectTimeline(m.getProjectTimeline());
            if (isBlank(primary.getFollowUpNote())) primary.setFollowUpNote(m.getFollowUpNote());
        }

        int maxScore = primary.getScore() != null ? primary.getScore() : 0;
        for (Lead m : merged) {
            maxScore = Math.max(maxScore, m.getScore() != null ? m.getScore() : 0);
        }
        primary.setScore(maxScore);

        leadMapper.updateById(primary);

        LeadActivity act = new LeadActivity();
        act.setLeadId(primaryId);
        act.setActivityType("note");
        act.setContent("系统合并：合并来源线索 " + mergedIds.size() + " 条（ID: "
                + mergedIds.stream().map(String::valueOf).collect(Collectors.joining(", "))
                + "），合并条件：" + conditionLabel(condition));
        act.setOperatorId(operatorId);
        activityMapper.insert(act);

        leadMapper.deleteBatchIds(mergedIds);
        return leadMapper.selectById(primaryId);
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private String conditionLabel(String condition) {
        if ("phone".equals(condition)) return "手机号相同";
        if ("name".equals(condition)) return "姓名相同";
        if ("company".equals(condition)) return "公司相同";
        return "手动合并";
    }
}
