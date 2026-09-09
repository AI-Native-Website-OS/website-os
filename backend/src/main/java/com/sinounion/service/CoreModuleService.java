package com.sinounion.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.entity.CoreModule;

import java.util.List;

public interface CoreModuleService {
    Page<CoreModule> getModules(int page, int size, String keyword);
    List<CoreModule> getAll();
    List<CoreModule> getActive();
    CoreModule getById(Long id);
    CoreModule create(CoreModule module);
    CoreModule update(Long id, CoreModule module);
    void delete(Long id);
    void reorder(List<Long> ids);
    void batchUpdateStatus(List<Long> ids, int status);
}
