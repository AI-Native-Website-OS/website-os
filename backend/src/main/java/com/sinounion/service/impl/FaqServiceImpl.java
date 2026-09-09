package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.entity.Faq;
import com.sinounion.mapper.FaqMapper;
import com.sinounion.service.FaqService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FaqServiceImpl implements FaqService {

    private final FaqMapper faqMapper;

    @Override
    public Faq createFaq(Faq faq) {
        faqMapper.insert(faq);
        return faq;
    }

    @Override
    public Faq updateFaq(Long id, Faq faq) {
        faq.setId(id);
        faqMapper.updateById(faq);
        return faq;
    }

    @Override
    public void deleteFaq(Long id) {
        faqMapper.deleteById(id);
    }

    @Override
    public Faq getFaqById(Long id) {
        return faqMapper.selectById(id);
    }

    @Override
    public Page<Faq> getFaqs(int page, int size, String category, String keyword) {
        LambdaQueryWrapper<Faq> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Faq::getStatus, 1);
        if (category != null && !category.isEmpty()) {
            wrapper.eq(Faq::getCategory, category);
        }
        if (keyword != null && !keyword.trim().isEmpty()) {
            String kw = keyword.trim();
            wrapper.and(w -> w.like(Faq::getQuestion, kw).or().like(Faq::getAnswer, kw));
        }
        wrapper.orderByAsc(Faq::getSortOrder);
        return faqMapper.selectPage(new Page<>(page, size), wrapper);
    }

    @Override
    public List<Faq> getFaqsByCategory(String category) {
        return faqMapper.findByCategory(category);
    }

    @Override
    public List<Faq> getFaqsByProductId(Long productId) {
        return faqMapper.findByProductId(productId);
    }
}
