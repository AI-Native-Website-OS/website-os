package com.sinounion.controller.admin;

import com.sinounion.common.Result;
import com.sinounion.entity.ContactInfo;
import com.sinounion.mapper.ContactInfoMapper;
import com.sinounion.service.KnowledgeSyncDispatcher;
import com.sinounion.translation.TranslationEnqueueService;
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
    private final KnowledgeSyncDispatcher knowledgeSyncDispatcher;
    private final TranslationEnqueueService translationEnqueueService;

    private void syncContacts() {
        knowledgeSyncDispatcher.syncContactInfo(contactInfoMapper.findAllOrdered());
    }

    @GetMapping
    @PreAuthorize("hasAuthority('page:config:view')")
    public Result<List<ContactInfo>> list() {
        return Result.success(contactInfoMapper.findAllOrdered());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<ContactInfo> create(@Valid @RequestBody ContactInfo contact) {
        contactInfoMapper.insert(contact);
        syncContacts();
        translationEnqueueService.enqueueEntity("contact_info", contact);
        return Result.success(contact);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<ContactInfo> update(@PathVariable Long id, @Valid @RequestBody ContactInfo contact) {
        contact.setId(id);
        contactInfoMapper.updateById(contact);
        syncContacts();
        translationEnqueueService.enqueueEntity("contact_info", contact);
        return Result.success(contact);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('page:config:edit')")
    public Result<Void> delete(@PathVariable Long id) {
        contactInfoMapper.deleteById(id);
        syncContacts();
        translationEnqueueService.removeResource("contact_info", id);
        return Result.success(null);
    }
}
