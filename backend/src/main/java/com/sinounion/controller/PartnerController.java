package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.entity.Partner;
import com.sinounion.service.PartnerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "合作伙伴管理", description = "合作伙伴相关接口")
@RestController
@RequestMapping("/partners")
@RequiredArgsConstructor
public class PartnerController {

    private final PartnerService partnerService;

    @Operation(summary = "获取所有启用的合作伙伴")
    @GetMapping
    public Result<List<Partner>> getActivePartners() {
        return Result.success(partnerService.getAllActivePartners());
    }

    @Operation(summary = "获取合作伙伴详情")
    @GetMapping("/{id}")
    public Result<Partner> getPartner(@PathVariable Long id) {
        return Result.success(partnerService.getPartnerById(id));
    }
}
