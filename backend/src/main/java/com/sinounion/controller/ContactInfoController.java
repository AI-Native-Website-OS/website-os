package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.entity.ContactInfo;
import com.sinounion.mapper.ContactInfoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/contacts")
@RequiredArgsConstructor
public class ContactInfoController {

    private final ContactInfoMapper contactInfoMapper;

    @GetMapping
    public Result<List<ContactInfo>> list() {
        return Result.success(contactInfoMapper.findAllOrdered());
    }
}
