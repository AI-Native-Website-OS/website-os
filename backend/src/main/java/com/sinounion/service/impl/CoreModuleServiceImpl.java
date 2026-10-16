package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.common.BusinessException;
import com.sinounion.entity.ContentCategory;
import com.sinounion.entity.ContentItem;
import com.sinounion.entity.CoreModule;
import com.sinounion.mapper.ContentCategoryMapper;
import com.sinounion.mapper.ContentItemMapper;
import com.sinounion.mapper.CoreModuleMapper;
import com.sinounion.service.CoreModuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class CoreModuleServiceImpl implements CoreModuleService {

    private final CoreModuleMapper coreModuleMapper;
    private final ContentCategoryMapper contentCategoryMapper;
    private final ContentItemMapper contentItemMapper;

    @Override
    public Page<CoreModule> getModules(int page, int size, String keyword) {
        LambdaQueryWrapper<CoreModule> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(CoreModule::getModuleName, keyword)
                    .or().like(CoreModule::getModuleTitle, keyword)
                    .or().like(CoreModule::getModuleKey, keyword));
        }
        wrapper.orderByAsc(CoreModule::getSortOrder).orderByAsc(CoreModule::getId);
        return coreModuleMapper.selectPage(new Page<>(page, size), wrapper);
    }

    @Override
    public List<CoreModule> getAll() {
        LambdaQueryWrapper<CoreModule> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(CoreModule::getSortOrder).orderByAsc(CoreModule::getId);
        return coreModuleMapper.selectList(wrapper);
    }

    @Override
    public List<CoreModule> getActive() {
        LambdaQueryWrapper<CoreModule> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CoreModule::getStatus, 1)
                .orderByAsc(CoreModule::getSortOrder)
                .orderByAsc(CoreModule::getId);
        return coreModuleMapper.selectList(wrapper);
    }

    @Override
    public CoreModule getById(Long id) {
        return coreModuleMapper.selectById(id);
    }

    @Override
    public CoreModule getByKey(String moduleKey) {
        if (moduleKey == null || moduleKey.isEmpty()) return null;
        return coreModuleMapper.selectOne(new LambdaQueryWrapper<CoreModule>()
                .eq(CoreModule::getModuleKey, moduleKey)
                .orderByAsc(CoreModule::getId)
                .last("LIMIT 1"));
    }

    @Override
    public CoreModule create(CoreModule module) {
        if (module.getModuleKey() == null || module.getModuleKey().trim().isEmpty()) {
            module.setModuleKey(generateModuleKey(module.getModuleName()));
        }
        if (module.getPath() == null || module.getPath().trim().isEmpty()) {
            module.setPath("/" + module.getModuleKey());
        }
        if (module.getStatus() == null) module.setStatus(1);
        if (module.getModuleColumns() == null) module.setModuleColumns(4);
        if (module.getSortOrder() == null) {
            List<CoreModule> top = coreModuleMapper.selectList(new LambdaQueryWrapper<CoreModule>()
                    .select(CoreModule::getSortOrder)
                    .orderByDesc(CoreModule::getSortOrder)
                    .last("LIMIT 1"));
            int maxSort = top.isEmpty() || top.get(0).getSortOrder() == null ? 0 : top.get(0).getSortOrder();
            module.setSortOrder(maxSort + 1);
        }
        coreModuleMapper.purgeDeletedByKey(module.getModuleKey());
        LambdaQueryWrapper<CoreModule> keyCheck = new LambdaQueryWrapper<>();
        keyCheck.eq(CoreModule::getModuleKey, module.getModuleKey());
        if (coreModuleMapper.selectCount(keyCheck) > 0) {
            throw new BusinessException("模块标识已存在：" + module.getModuleKey());
        }
        coreModuleMapper.insert(module);
        return module;
    }

    private String generateModuleKey(String moduleName) {
        String base = (moduleName == null ? "" : moduleName.toLowerCase().trim())
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "")
                .replaceAll("-{2,}", "-");
        if (base.isEmpty()) base = "module";
        String candidate = base;
        if (coreModuleMapper.selectCount(new LambdaQueryWrapper<CoreModule>()
                .eq(CoreModule::getModuleKey, candidate)) > 0) {
            candidate = base + "-" + (System.currentTimeMillis() % 100000);
        }
        return candidate;
    }

    @Override
    public CoreModule update(Long id, CoreModule module) {
        CoreModule existing = coreModuleMapper.selectById(id);
        if (existing == null) {
            throw new BusinessException("模块不存在");
        }
        if (module.getModuleKey() != null && !module.getModuleKey().trim().isEmpty()) {
            coreModuleMapper.purgeDeletedByKey(module.getModuleKey());
            LambdaQueryWrapper<CoreModule> keyCheck = new LambdaQueryWrapper<>();
            keyCheck.eq(CoreModule::getModuleKey, module.getModuleKey()).ne(CoreModule::getId, id);
            if (coreModuleMapper.selectCount(keyCheck) > 0) {
                throw new BusinessException("模块标识已存在：" + module.getModuleKey());
            }
        }
        module.setId(id);
        coreModuleMapper.updateById(module);
        return module;
    }

    @Override
    public void delete(Long id) {
        CoreModule existing = coreModuleMapper.selectById(id);
        if (existing == null) return;
        if (existing.getIsSystem() != null && existing.getIsSystem() == 1) {
            throw new BusinessException("系统模块不可删除");
        }
        String moduleKey = existing.getModuleKey();
        Long categoryCount = contentCategoryMapper.selectCount(new LambdaQueryWrapper<ContentCategory>()
                .eq(ContentCategory::getModuleKey, moduleKey));
        Long itemCount = contentItemMapper.selectCount(new LambdaQueryWrapper<ContentItem>()
                .eq(ContentItem::getModuleKey, moduleKey));
        if ((categoryCount != null && categoryCount > 0) || (itemCount != null && itemCount > 0)) {
            throw new BusinessException("模块下存在分类或内容，无法删除");
        }
        coreModuleMapper.deleteById(id);
    }

    @Override
    public void reorder(List<Long> ids) {
        IntStream.range(0, ids.size()).forEach(i -> {
            CoreModule m = new CoreModule();
            m.setId(ids.get(i));
            m.setSortOrder(i);
            coreModuleMapper.updateById(m);
        });
    }

    @Override
    public void batchUpdateStatus(List<Long> ids, int status) {
        for (Long id : ids) {
            CoreModule m = new CoreModule();
            m.setId(id);
            m.setStatus(status);
            coreModuleMapper.updateById(m);
        }
    }
}
