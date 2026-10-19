package com.sinounion.controller;

import com.sinounion.common.Result;
import com.sinounion.entity.User;
import com.sinounion.mapper.UserMapper;
import com.sinounion.mapper.UserNoticeDismissalMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 站点通知公告的“按用户关闭”记录。
 * <p>关闭记录按 user_id 隔离，只影响本人且跨设备生效，不影响其他用户。</p>
 */
@Tag(name = "站点通知", description = "用户关闭站点通知公告")
@RestController
@RequestMapping("/notices")
@RequiredArgsConstructor
public class NoticeController {

    /** 单次合并的关闭记录上限，防止异常请求写入过多数据。 */
    private static final int MAX_MERGE_IDS = 200;

    /** 通知标识最大长度，与 user_notice_dismissals.notice_id 列宽一致。 */
    private static final int MAX_NOTICE_ID_LENGTH = 100;

    private final UserMapper userMapper;
    private final UserNoticeDismissalMapper userNoticeDismissalMapper;

    @Operation(summary = "关闭通知（仅本人）")
    @PostMapping("/{id}/dismiss")
    public Result<Void> dismiss(@PathVariable String id, Authentication authentication) {
        Long userId = currentUserId(authentication);
        if (userId == null) {
            return Result.error(401, "未登录");
        }
        if (isValidNoticeId(id)) {
            userNoticeDismissalMapper.insertIfAbsent(userId, id);
        }
        return Result.success(null);
    }

    @Operation(summary = "合并本地关闭记录（登录后同步，仅本人）")
    @PostMapping("/dismissals/merge")
    public Result<Void> merge(@RequestBody(required = false) List<String> ids, Authentication authentication) {
        Long userId = currentUserId(authentication);
        if (userId == null) {
            return Result.error(401, "未登录");
        }
        if (ids == null || ids.isEmpty()) {
            return Result.success(null);
        }
        int merged = 0;
        for (String id : ids) {
            if (merged >= MAX_MERGE_IDS) {
                break;
            }
            if (!isValidNoticeId(id)) {
                continue;
            }
            userNoticeDismissalMapper.insertIfAbsent(userId, id);
            merged++;
        }
        return Result.success(null);
    }

    private Long currentUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        String username = authentication.getName();
        if (!StringUtils.hasText(username) || "anonymousUser".equals(username)) {
            return null;
        }
        User user = userMapper.findByUsername(username);
        return user != null ? user.getId() : null;
    }

    private boolean isValidNoticeId(String id) {
        return StringUtils.hasText(id) && id.length() <= MAX_NOTICE_ID_LENGTH;
    }
}
