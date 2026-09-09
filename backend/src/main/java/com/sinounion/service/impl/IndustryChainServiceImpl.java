package com.sinounion.service.impl;

import com.sinounion.entity.IndustryChain;
import com.sinounion.mapper.IndustryChainMapper;
import com.sinounion.service.IndustryChainService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IndustryChainServiceImpl implements IndustryChainService {

    private final IndustryChainMapper chainMapper;

    @Override
    public IndustryChain createChain(IndustryChain chain) {
        chainMapper.insert(chain);
        return chain;
    }

    @Override
    public IndustryChain updateChain(Long id, IndustryChain chain) {
        chain.setId(id);
        chainMapper.updateById(chain);
        return chain;
    }

    @Override
    public void deleteChain(Long id) {
        chainMapper.deleteById(id);
    }

    @Override
    public IndustryChain getChainById(Long id) {
        return chainMapper.selectById(id);
    }

    @Override
    public List<IndustryChain> getRootChains() {
        return chainMapper.findRootChains();
    }

    @Override
    public List<IndustryChain> getChildrenByParentId(Long parentId) {
        return chainMapper.findByParentId(parentId);
    }

    @Override
    public List<IndustryChain> getIndustryChainTree() {
        List<IndustryChain> allChains = chainMapper.selectList(null);
        Map<Long, List<IndustryChain>> grouped = allChains.stream()
            .collect(Collectors.groupingBy(IndustryChain::getParentId));
        
        List<IndustryChain> rootChains = grouped.getOrDefault(0L, new ArrayList<>());
        for (IndustryChain root : rootChains) {
            root.setChildren(grouped.getOrDefault(root.getId(), new ArrayList<>()));
        }
        return rootChains;
    }
}
