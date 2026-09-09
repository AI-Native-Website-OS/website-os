package com.sinounion.service;

import com.sinounion.entity.Partner;

import java.util.List;

public interface PartnerService {
    Partner createPartner(Partner partner);
    Partner updatePartner(Long id, Partner partner);
    void deletePartner(Long id);
    Partner getPartnerById(Long id);
    List<Partner> getAllActivePartners();
}
