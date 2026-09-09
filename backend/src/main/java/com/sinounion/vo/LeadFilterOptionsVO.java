package com.sinounion.vo;

import lombok.Data;

import java.util.List;

@Data
public class LeadFilterOptionsVO {
    private List<String> names;
    private List<String> companies;
    private List<String> phones;
    private List<String> sourcePages;
    private List<String> ips;
    private List<String> locations;
}