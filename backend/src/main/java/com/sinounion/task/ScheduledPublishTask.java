package com.sinounion.task;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.sinounion.entity.ContentItem;
import com.sinounion.mapper.ContentItemMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.DependsOn;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@DependsOn("databaseInitializer")
@org.springframework.context.annotation.Profile("!test")
public class ScheduledPublishTask {

    private final ContentItemMapper contentItemMapper;

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void publishScheduledItems() {
        LocalDateTime now = LocalDateTime.now();
        List<ContentItem> items = contentItemMapper.selectList(
            new LambdaQueryWrapper<ContentItem>()
                .eq(ContentItem::getStatus, 0)
                .isNotNull(ContentItem::getScheduledAt)
                .le(ContentItem::getScheduledAt, now)
        );
        int total = 0;
        for (ContentItem item : items) {
            ContentItem update = new ContentItem();
            update.setId(item.getId());
            update.setStatus(1);
            update.setPublishedAt(now);
            contentItemMapper.updateById(update);
            total++;
        }
        if (total > 0) {
            log.info("Scheduled publish: {} items published at {}", total, now);
        }
    }
}
