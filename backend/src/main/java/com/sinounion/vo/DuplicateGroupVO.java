package com.sinounion.vo;

import com.sinounion.entity.Lead;
import lombok.Data;

import java.util.List;

@Data
public class DuplicateGroupVO {
    private String key;
    private List<Lead> leads;
}
