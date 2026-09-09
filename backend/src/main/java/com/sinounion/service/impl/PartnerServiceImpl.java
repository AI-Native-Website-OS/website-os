package com.sinounion.service.impl;

import com.sinounion.entity.Partner;
import com.sinounion.mapper.PartnerMapper;
import com.sinounion.service.PartnerService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PartnerServiceImpl implements PartnerService {

    private final PartnerMapper partnerMapper;

    @Override
    public Partner createPartner(Partner partner) {
        partnerMapper.insert(partner);
        return partner;
    }

    @Override
    public Partner updatePartner(Long id, Partner partner) {
        partner.setId(id);
        partnerMapper.updateById(partner);
        return partner;
    }

    @Override
    public void deletePartner(Long id) {
        partnerMapper.deleteById(id);
    }

    @Override
    public Partner getPartnerById(Long id) {
        return partnerMapper.selectById(id);
    }

    @Override
    public List<Partner> getAllActivePartners() {
        return partnerMapper.findAllActive();
    }
}
