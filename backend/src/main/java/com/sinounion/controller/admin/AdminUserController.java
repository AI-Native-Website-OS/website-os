package com.sinounion.controller.admin;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.common.PageResult;
import com.sinounion.common.Result;
import com.sinounion.dto.CreateUserDTO;
import com.sinounion.dto.UpdateUserDTO;
import com.sinounion.service.UserService;
import com.sinounion.vo.UserVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.Map;

@Tag(name = "管理后台-用户管理", description = "用户CRUD接口")
@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final UserService userService;

    @Operation(summary = "获取用户列表")
    @GetMapping
    @PreAuthorize("hasAuthority('user:view')")
    public Result<PageResult<UserVO>> getUsers(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String userType,
            @RequestParam(required = false) String keyword) {
        return Result.success(PageResult.of(userService.getUsers(page, size, role, userType, keyword)));
    }

    @Operation(summary = "获取用户详情")
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('user:view')")
    public Result<UserVO> getUser(@PathVariable Long id) {
        return Result.success(userService.getUserById(id));
    }

    @Operation(summary = "创建用户")
    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<UserVO> create(@Valid @RequestBody CreateUserDTO dto) {
        return Result.success(userService.createUser(dto));
    }

    @Operation(summary = "更新用户")
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<UserVO> update(@PathVariable Long id, @Valid @RequestBody UpdateUserDTO dto) {
        return Result.success(userService.updateUser(id, dto));
    }

    @Operation(summary = "切换用户状态")
    @PutMapping("/{id}/toggle-status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<UserVO> toggleStatus(@PathVariable Long id) {
        return Result.success(userService.toggleStatus(id));
    }

    @Operation(summary = "删除用户")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Void> delete(@PathVariable Long id) {
        userService.deleteUser(id);
        return Result.success(null);
    }

    @Operation(summary = "重置密码")
    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Result<Void> resetPassword(@PathVariable Long id, @RequestBody Map<String, String> body) {
        userService.resetPassword(id, body.get("password"));
        return Result.success(null);
    }
}
