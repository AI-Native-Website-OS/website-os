package com.sinounion.service;

import com.sinounion.entity.Banner;

import java.util.List;

public interface BannerService {
    Banner createBanner(Banner banner);
    Banner updateBanner(Long id, Banner banner);
    void deleteBanner(Long id);
    Banner getBannerById(Long id);
    List<Banner> getAllActiveBanners();
}
