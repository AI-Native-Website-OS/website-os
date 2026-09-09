package com.sinounion.service.impl;

import com.sinounion.entity.Banner;
import com.sinounion.mapper.BannerMapper;
import com.sinounion.service.BannerService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BannerServiceImpl implements BannerService {

    private final BannerMapper bannerMapper;

    @Override
    public Banner createBanner(Banner banner) {
        bannerMapper.insert(banner);
        return banner;
    }

    @Override
    public Banner updateBanner(Long id, Banner banner) {
        banner.setId(id);
        bannerMapper.updateById(banner);
        return banner;
    }

    @Override
    public void deleteBanner(Long id) {
        bannerMapper.deleteById(id);
    }

    @Override
    public Banner getBannerById(Long id) {
        return bannerMapper.selectById(id);
    }

    @Override
    public List<Banner> getAllActiveBanners() {
        return bannerMapper.findAllActive();
    }
}
