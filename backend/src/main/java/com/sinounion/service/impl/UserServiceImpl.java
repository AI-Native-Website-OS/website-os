package com.sinounion.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.common.BusinessException;
import com.sinounion.dto.CreateUserDTO;
import com.sinounion.dto.LoginDTO;
import com.sinounion.dto.RegisterDTO;
import com.sinounion.dto.SmsLoginDTO;
import com.sinounion.dto.UpdateUserDTO;
import com.sinounion.entity.Lead;
import com.sinounion.entity.Permission;
import com.sinounion.entity.User;
import com.sinounion.mapper.LeadMapper;
import com.sinounion.mapper.PermissionMapper;
import com.sinounion.mapper.UserMapper;
import com.sinounion.service.AiRequestSigner;
import com.sinounion.service.SmsService;
import com.sinounion.service.UserService;
import com.sinounion.utils.JwtUtils;
import com.sinounion.vo.LoginVO;
import com.sinounion.vo.UserVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import cn.hutool.http.HttpRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.annotation.Transactional;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final PermissionMapper permissionMapper;
    @Value("${ai.service.url}")
    private String aiServiceUrl;

    @javax.annotation.PostConstruct
    public void init() {
        if (aiServiceUrl != null) {
            aiServiceUrl = aiServiceUrl.trim();
        }
    }

    @Value("${AI_SERVICE_MEMORIES_DIR}")
    private String memoriesDir;
    private final LeadMapper leadMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final SmsService smsService;
    private final AiRequestSigner aiRequestSigner;

    @Override
    public LoginVO login(LoginDTO dto) {
        User user = userMapper.findByUsername(dto.getUsername());
        if (user == null || !passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BusinessException("用户名或密码错误");
        }
        if (user.getStatus() == 0) {
            throw new BusinessException("账号已被禁用");
        }

        userMapper.updateLastLoginTime(user.getId());

        List<Permission> permissions = permissionMapper.findByRole(user.getRole());
        List<String> permissionCodes = permissions.stream()
                .map(Permission::getCode)
                .collect(Collectors.toList());

        return buildLoginVO(user, permissionCodes);
    }

    /** 构造登录返回（含 access + refresh 双令牌），供 login / loginByCode / refresh 复用。 */
    private LoginVO buildLoginVO(User user, List<String> permissionCodes) {
        String token = jwtUtils.generateToken(user.getId(), user.getUsername(), user.getRole(), user.getTokenVersion());
        String refreshToken = jwtUtils.generateRefreshToken(user.getId(), user.getUsername(), user.getRole(), user.getTokenVersion());
        LoginVO loginVO = new LoginVO();
        loginVO.setToken(token);
        loginVO.setRefreshToken(refreshToken);
        loginVO.setUser(toUserVO(user, permissionCodes));
        loginVO.setPermissions(permissionCodes);
        return loginVO;
    }

    @Override
    public LoginVO refresh(String refreshToken) {
        User user = userMapper.findByUsername(jwtUtils.getUsername(refreshToken));
        if (user == null) {
            throw new BusinessException("用户不存在或已被删除");
        }
        List<Permission> permissions = permissionMapper.findByRole(user.getRole());
        List<String> permissionCodes = permissions.stream()
                .map(Permission::getCode)
                .collect(Collectors.toList());
        return buildLoginVO(user, permissionCodes);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public LoginVO loginByCode(SmsLoginDTO dto) {
        if (!smsService.verifyCode(dto.getPhone(), dto.getCode())) {
            throw new BusinessException("验证码错误或已过期");
        }

        User user = userMapper.findByPhone(dto.getPhone());
        if (user == null) {
            // 未注册：自动注册（手机号即用户名）
            user = new User();
            user.setUsername(dto.getPhone());
            user.setPassword(passwordEncoder.encode(RandomString()));
            user.setPhone(dto.getPhone());
            user.setRealName(dto.getPhone());
            user.setStatus(1);
            user.setRole("NORMAL_USER");
            user.setUserType("EXTERNAL");
            user.setDeleted(0);
            userMapper.insert(user);

            initMemory(memoryOwner(user), "NORMAL_USER");
        } else if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BusinessException("账号已被禁用");
        }

        userMapper.updateLastLoginTime(user.getId());

        List<Permission> permissions = permissionMapper.findByRole(user.getRole());
        List<String> permissionCodes = permissions.stream()
                .map(Permission::getCode)
                .collect(Collectors.toList());

        return buildLoginVO(user, permissionCodes);
    }

    private String RandomString() {
        return java.util.UUID.randomUUID().toString().replace("-", "");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserVO register(RegisterDTO dto) {
        try {
            User existing = userMapper.findByUsernameIncludeDeleted(dto.getUsername());
            if (existing != null) {
                if (existing.getDeleted() != null && existing.getDeleted() == 1) {
                    userMapper.hardDeleteById(existing.getId());
                } else {
                    throw new BusinessException("用户名已存在");
                }
            }
            if (dto.getEmail() != null && userMapper.findByEmail(dto.getEmail()) != null) {
                throw new BusinessException("邮箱已被使用");
            }
            if (dto.getPhone() != null && userMapper.findByPhone(dto.getPhone()) != null) {
                throw new BusinessException("手机号已被使用");
            }
            if (dto.getPhone() != null && !smsService.verifyCode(dto.getPhone(), dto.getCode())) {
                throw new BusinessException("验证码错误或已过期");
            }

            User user = new User();
            user.setUsername(dto.getUsername());
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
            user.setEmail(dto.getEmail());
            user.setPhone(dto.getPhone());
            user.setRealName(dto.getRealName());
            user.setCompanyName(dto.getCompanyName());
            user.setStatus(1);
            user.setRole("NORMAL_USER");
            user.setUserType("EXTERNAL");
            user.setDeleted(0);
            userMapper.insert(user);

            if (dto.getPhone() != null) {
                Lead lead = new Lead();
                lead.setName(dto.getRealName() != null ? dto.getRealName() : dto.getUsername());
                lead.setCompany(dto.getCompanyName());
                lead.setPhone(dto.getPhone());
                lead.setEmail(dto.getEmail());
                lead.setSource("registration");
                lead.setStatus("new");
                lead.setInterestArea("网站注册");
                leadMapper.insert(lead);
            }

            initMemory(memoryOwner(user), "NORMAL_USER");

            List<Permission> permissions = permissionMapper.findByRole("NORMAL_USER");
            List<String> permissionCodes = permissions.stream()
                    .map(Permission::getCode)
                    .collect(Collectors.toList());
            return toUserVO(user, permissionCodes);
        } catch (DuplicateKeyException e) {
            throw new BusinessException("用户名已存在");
        }
    }

    @Override
    public UserVO getUserById(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        List<Permission> permissions = permissionMapper.findByRole(user.getRole());
        List<String> permissionCodes = permissions.stream()
                .map(Permission::getCode)
                .collect(Collectors.toList());
        return toUserVO(user, permissionCodes);
    }

    @Override
    public User getUserByUsername(String username) {
        return userMapper.findByUsername(username);
    }

    @Override
    public UserVO updateUser(Long id, UpdateUserDTO dto) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        if ("SUPER_ADMIN".equals(user.getRole())) {
            String operator = getCurrentUsername();
            boolean isSelf = operator != null && operator.equals(user.getUsername());
            if (!isSelf) {
                throw new BusinessException("无权限修改其他超级管理员账号");
            }
            if (dto.getRole() != null) {
                throw new BusinessException("超级管理员不能修改自身角色");
            }
        }
        if (dto.getEmail() != null) user.setEmail(dto.getEmail());
        if (dto.getPhone() != null) user.setPhone(dto.getPhone());
        if (dto.getRealName() != null) user.setRealName(dto.getRealName());
        if (dto.getAvatar() != null) user.setAvatar(dto.getAvatar());
        if (dto.getRole() != null) user.setRole(dto.getRole());
        if (dto.getDepartment() != null) user.setDepartment(dto.getDepartment());
        userMapper.updateById(user);
        return getUserById(id);
    }

    @Override
    public UserVO toggleStatus(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        if ("SUPER_ADMIN".equals(user.getRole())) {
            throw new BusinessException("超级管理员不允许切换状态");
        }
        user.setStatus(user.getStatus() == 1 ? 0 : 1);
        userMapper.updateById(user);
        return getUserById(id);
    }

    @Override
    public void deleteUser(Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        if ("SUPER_ADMIN".equals(user.getRole())) {
            throw new BusinessException("超级管理员不允许删除");
        }
        userMapper.deleteById(id);
    }

    @Override
    public Page<UserVO> getUsers(int page, int size, String role, String userType, String keyword) {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(role)) {
            wrapper.eq(User::getRole, role);
        }
        if (StringUtils.hasText(userType)) {
            wrapper.eq(User::getUserType, userType);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(User::getUsername, keyword)
                    .or().like(User::getRealName, keyword)
                    .or().like(User::getEmail, keyword)
                    .or().like(User::getPhone, keyword));
        }
        wrapper.orderByDesc(User::getCreatedAt);
        Page<User> userPage = userMapper.selectPage(new Page<>(page, size), wrapper);

        Page<UserVO> voPage = new Page<>();
        voPage.setTotal(userPage.getTotal());
        voPage.setPages(userPage.getPages());
        voPage.setCurrent(userPage.getCurrent());
        voPage.setSize(userPage.getSize());
        voPage.setRecords(userPage.getRecords().stream()
                .map(u -> toUserVO(u, permissionMapper.findByRole(u.getRole()).stream()
                        .map(Permission::getCode).collect(Collectors.toList())))
                .collect(Collectors.toList()));
        return voPage;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserVO createUser(CreateUserDTO dto) {
        try {
            User existing = userMapper.findByUsernameIncludeDeleted(dto.getUsername());
            if (existing != null) {
                if (existing.getDeleted() != null && existing.getDeleted() == 1) {
                    userMapper.hardDeleteById(existing.getId());
                } else {
                    throw new BusinessException("用户名已存在");
                }
            }
            if (dto.getEmail() != null && userMapper.findByEmail(dto.getEmail()) != null) {
                throw new BusinessException("邮箱已被使用");
            }

            User user = new User();
            user.setUsername(dto.getUsername());
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
            user.setEmail(dto.getEmail());
            user.setPhone(dto.getPhone());
            user.setRealName(dto.getRealName());
            user.setRole(dto.getRole() != null ? dto.getRole() : "NORMAL_USER");
            user.setUserType("INTERNAL");
            user.setDepartment(dto.getDepartment());
            user.setStatus(1);
            user.setDeleted(0);
            userMapper.insert(user);

            String role = dto.getRole() != null ? dto.getRole() : "NORMAL_USER";
            initMemory(memoryOwner(user), role);

            return getUserById(user.getId());
        } catch (DuplicateKeyException e) {
            throw new BusinessException("用户名已存在");
        }
    }

    @Override
    public void resetPassword(Long id, String newPassword) {
        User user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        if ("SUPER_ADMIN".equals(user.getRole())) {
            String operator = getCurrentUsername();
            boolean isSelf = operator != null && operator.equals(user.getUsername());
            if (!isSelf) {
                throw new BusinessException("无权限重置其他超级管理员的密码");
            }
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userMapper.updateById(user);
        userMapper.incrementTokenVersion(id);
    }

    private UserVO toUserVO(User user, List<String> permissions) {
        UserVO vo = new UserVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setEmail(user.getEmail());
        vo.setPhone(user.getPhone());
        vo.setRealName(user.getRealName());
        vo.setCompanyName(user.getCompanyName());
        vo.setAvatar(user.getAvatar());
        vo.setStatus(user.getStatus());
        vo.setRole(user.getRole());
        vo.setUserType(user.getUserType());
        vo.setDepartment(user.getDepartment());
        vo.setLastLoginTime(user.getLastLoginTime());
        vo.setCreatedAt(user.getCreatedAt());
        vo.setPermissions(permissions);
        return vo;
    }

    private String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        return authentication.getName();
    }

    /** 记忆归属键：与前端聊天一致，优先真实姓名，其次登录名。 */
    private String memoryOwner(User user) {
        String realName = user.getRealName();
        if (realName != null && !realName.trim().isEmpty()) {
            return realName.trim();
        }
        return user.getUsername();
    }

    private void initMemory(String username, String role) {
        // 1. Try HTTP call to Python AI service
        if (aiServiceUrl != null && !aiServiceUrl.isEmpty()) {
            try {
                String url = aiServiceUrl + "/ai/memory/init?username=" + java.net.URLEncoder.encode(username, "UTF-8") + "&role=" + java.net.URLEncoder.encode(role, "UTF-8");
                log.info("Initializing memory: POST {}", url);
                HttpRequest request = HttpRequest.post(url).timeout(5000);
                aiRequestSigner.sign(request);
                int status = request.execute().getStatus();
                if (status == 200) {
                    log.info("Memory initialized via HTTP for {}/{}", role, username);
                    return;
                }
                log.warn("Memory init HTTP returned {} for {}/{}", status, role, username);
            } catch (Exception e) {
                log.warn("Memory init HTTP failed for {}/{}: {}", role, username, e.getMessage());
            }
        }

        // 2. Fallback: create the single MEMORY.md directly on filesystem
        try {
            String safeUsername = username.replaceAll("[\\\\/:*?\"<>|]", "_");
            String safeRole = (role == null || role.isEmpty()) ? "_" : role.replaceAll("[\\\\/:*?\"<>|]", "_");
            // Prefer /app/memories if it exists, otherwise use configured memoriesDir
            Path appMemories = Paths.get("/app/memories");
            Path baseDir;
            if (Files.isDirectory(appMemories)) {
                baseDir = appMemories;
            } else if (memoriesDir != null && !memoriesDir.isEmpty()) {
                baseDir = Paths.get(memoriesDir);
            } else {
                log.warn("ai.service.memories-dir not configured, cannot create memory files locally");
                return;
            }
            Path userPath = baseDir.resolve(safeRole).resolve(safeUsername);
            Files.createDirectories(userPath);

            Path memory = userPath.resolve("MEMORY.md");
            if (!Files.exists(memory)) {
                String updated = java.time.LocalDateTime.now()
                        .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
                String template = "# Memory\n\n> updated: " + updated
                        + "\n\n## Profile\n\n## Preferences\n\n## Facts\n\n## Decisions\n\n## Timeline\n";
                Files.write(memory, template.getBytes(StandardCharsets.UTF_8));
            }
            log.info("Memory initialized locally at {} for {}/{}", userPath, role, username);
        } catch (IOException e) {
            log.error("Memory init local failed for {}/{}: {}", role, username, e.getMessage());
        }
    }
}
