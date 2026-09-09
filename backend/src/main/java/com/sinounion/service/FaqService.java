package com.sinounion.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.entity.Faq;

import java.util.List;

public interface FaqService {
    Faq createFaq(Faq faq);
    Faq updateFaq(Long id, Faq faq);
    void deleteFaq(Long id);
    Faq getFaqById(Long id);
    Page<Faq> getFaqs(int page, int size, String category, String keyword);
    List<Faq> getFaqsByCategory(String category);
    List<Faq> getFaqsByProductId(Long productId);
}
