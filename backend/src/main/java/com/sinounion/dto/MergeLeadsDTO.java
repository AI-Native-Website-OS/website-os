package com.sinounion.dto;

import lombok.Data;

import java.util.List;

@Data
public class MergeLeadsDTO {
    private Long primaryId;
    private List<Long> mergedIds;
    private String condition;
}
