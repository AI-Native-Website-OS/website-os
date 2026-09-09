package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.entity.ContactInfo;
import com.sinounion.mapper.ContactInfoMapper;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/admin/contacts")
@RequiredArgsConstructor
public class AdminContactInfoController {

    private final ContactInfoMapper contactInfoMapper;

    @GetMapping
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<List<ContactInfo>> list() {
        return Result.success(contactInfoMapper.findAllOrdered());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<ContactInfo> create(@Valid @RequestBody ContactInfo contact) {
        contactInfoMapper.insert(contact);
        return Result.success(contact);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<ContactInfo> update(@PathVariable Long id, @Valid @RequestBody ContactInfo contact) {
        contact.setId(id);
        contactInfoMapper.updateById(contact);
        return Result.success(contact);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<Void> delete(@PathVariable Long id) {
        contactInfoMapper.deleteById(id);
        return Result.success(null);
    }
}
