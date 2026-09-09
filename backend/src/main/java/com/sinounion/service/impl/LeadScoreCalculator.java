package com.sinounion.service.impl;

import com.sinounion.entity.Lead;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

public class LeadScoreCalculator {

    private static final int BASE_SCORE = 10;
    private static final int HAS_COMPANY_SCORE = 15;
    private static final int HAS_EMAIL_SCORE = 10;
    private static final int HAS_REQUIREMENT_SCORE = 20;
    private static final int HAS_INTEREST_AREA_SCORE = 10;
    private static final int HAS_ENTERPRISE_TYPE_SCORE = 10;
    private static final int HAS_PROJECT_TIMELINE_SCORE = 15;
    private static final int SOURCE_HIGH_INTENT_SCORE = 15;
    private static final int DECAY_DAYS = 14;
    private static final int DECAY_MAX_PENALTY = 30;
    private static final int MAX_SCORE = 100;

    public static int calculateScore(Lead lead) {
        int score = BASE_SCORE;

        if (lead.getCompany() != null && !lead.getCompany().isEmpty()) {
            score += HAS_COMPANY_SCORE;
        }
        if (lead.getEmail() != null && !lead.getEmail().isEmpty()) {
            score += HAS_EMAIL_SCORE;
        }
        if (lead.getRequirement() != null && !lead.getRequirement().isEmpty()) {
            score += HAS_REQUIREMENT_SCORE;
        }
        if (lead.getInterestArea() != null && !lead.getInterestArea().isEmpty()) {
            score += HAS_INTEREST_AREA_SCORE;
        }
        if (lead.getEnterpriseType() != null && !lead.getEnterpriseType().isEmpty()) {
            score += HAS_ENTERPRISE_TYPE_SCORE;
        }
        if (lead.getProjectTimeline() != null && !lead.getProjectTimeline().isEmpty()) {
            score += HAS_PROJECT_TIMELINE_SCORE;
        }

        String source = lead.getSource();
        if ("demo-booking".equals(source) || "product-cta".equals(source) || "solution-cta".equals(source)) {
            score += SOURCE_HIGH_INTENT_SCORE;
        }

        if (lead.getCreatedAt() != null && lead.getStatus() != null && !"closed".equals(lead.getStatus()) && !"invalid".equals(lead.getStatus())) {
            long daysSinceCreation = ChronoUnit.DAYS.between(lead.getCreatedAt(), LocalDateTime.now());
            if (daysSinceCreation > DECAY_DAYS) {
                long excessDays = daysSinceCreation - DECAY_DAYS;
                int decay = (int) Math.min(excessDays, DECAY_MAX_PENALTY);
                score -= decay;
            }
        }

        return Math.min(Math.max(score, 0), MAX_SCORE);
    }
}