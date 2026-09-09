package com.sinounion.service;

import com.sinounion.entity.IndustryChain;

import java.util.List;

public interface IndustryChainService {
    IndustryChain createChain(IndustryChain chain);
    IndustryChain updateChain(Long id, IndustryChain chain);
    void deleteChain(Long id);
    IndustryChain getChainById(Long id);
    List<IndustryChain> getRootChains();
    List<IndustryChain> getChildrenByParentId(Long parentId);
    List<IndustryChain> getIndustryChainTree();
}
