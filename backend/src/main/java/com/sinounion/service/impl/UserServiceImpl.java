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
    @Value("${AI_SERVICE_URL}")
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

        String token = jwtUtils.generateToken(user.getId(), user.getUsername(), user.getRole(), user.getTokenVersion());

        List<Permission> permissions = permissionMapper.findByRole(user.getRole());
        List<String> permissionCodes = permissions.stream()
                .map(Permission::getCode)
                .collect(Collectors.toList());

        LoginVO loginVO = new LoginVO();
        loginVO.setToken(token);
        loginVO.setUser(toUserVO(user, permissionCodes));
        loginVO.setPermissions(permissionCodes);
        return loginVO;
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

            initMemory(user.getUsername(), "NORMAL_USER");
        } else if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BusinessException("账号已被禁用");
        }

        userMapper.updateLastLoginTime(user.getId());
        String token = jwtUtils.generateToken(user.getId(), user.getUsername(), user.getRole(), user.getTokenVersion());

        List<Permission> permissions = permissionMapper.findByRole(user.getRole());
        List<String> permissionCodes = permissions.stream()
                .map(Permission::getCode)
                .collect(Collectors.toList());

        LoginVO loginVO = new LoginVO();
        loginVO.setToken(token);
        loginVO.setUser(toUserVO(user, permissionCodes));
        loginVO.setPermissions(permissionCodes);
        return loginVO;
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

            initMemory(user.getUsername(), "NORMAL_USER");

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
            initMemory(user.getUsername(), role);

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

        // 2. Fallback: create directory and all 6 memory files directly on filesystem
        try {
            String safeUsername = username.replaceAll("[\\\\/:*?\"<>|]", "_");
            String safeRole = (role == null || role.isEmpty()) ? "_" : role.replaceAll("[\\\\/:*?\"<>|]", "_");
            // Prefer /app/memories if it exists, otherwise use configured memoriesDir
            Path appMemories = Paths.get("/app/memories");
            log.info("[DEBUG] initMemory: checking /app/memories, exists={}, isDirectory={}, memoriesDir='{}'",
                    Files.exists(appMemories), Files.isDirectory(appMemories), memoriesDir);
            Path baseDir;
            if (Files.isDirectory(appMemories)) {
                baseDir = appMemories;
                log.info("[DEBUG] initMemory: using /app/memories as baseDir");
            } else if (memoriesDir != null && !memoriesDir.isEmpty()) {
                baseDir = Paths.get(memoriesDir);
                log.info("[DEBUG] initMemory: using configured memoriesDir '{}' as baseDir, resolved={}",
                        memoriesDir, baseDir.toAbsolutePath());
            } else {
                log.warn("ai.service.memories-dir not configured, cannot create memory files locally");
                return;
            }
            Path userPath = baseDir.resolve(safeRole).resolve(safeUsername);
            log.info("[DEBUG] initMemory: creating directories at {}", userPath.toAbsolutePath());
            Files.createDirectories(userPath);

            Map<String, String> templates = new java.util.LinkedHashMap<>();
            templates.put("profile.md", "# " + safeUsername + " 的用户画像\n> 角色: " + safeRole + "\n> 姓名、职业、年龄、身份等长期不变的信息\n\n");
            templates.put("preferences.md", "# " + safeUsername + " 的用户偏好\n> 角色: " + safeRole + "\n> 回答风格、语言、开发偏好、习惯等\n\n");
            templates.put("knowledge.md", "# " + safeUsername + " 的长期事实\n> 角色: " + safeRole + "\n> AI已确认的事实（如「用户使用Laravel」「服务器在东京」）\n\n");
            templates.put("conversation.md", "# " + safeUsername + " 的对话摘要\n> 角色: " + safeRole + "\n> 历史聊天摘要（不保存全文）\n\n");
            templates.put("decisions.md", "# " + safeUsername + " 的决策历史\n> 角色: " + safeRole + "\n> 重要决策及原因，方便后续保持一致\n\n");
            templates.put("timeline.md", "# " + safeUsername + " 的时间线\n> 角色: " + safeRole + "\n> 事件发生时间记录\n\n");

            for (Map.Entry<String, String> entry : templates.entrySet()) {
                Path f = userPath.resolve(entry.getKey());
                if (!Files.exists(f)) {
                    Files.write(f, entry.getValue().getBytes(StandardCharsets.UTF_8));
                }
            }
            // Legacy MEMORY.md for backward compatibility
            Path legacy = userPath.resolve("MEMORY.md");
            if (!Files.exists(legacy)) {
                Files.write(legacy, ("# " + safeUsername + " 的记忆\n> 角色: " + safeRole + "\n> 自动生成的长期记忆文件\n\n").getBytes(StandardCharsets.UTF_8));
            }
            log.info("Memory initialized locally at {} for {}/{}", userPath, role, username);
        } catch (IOException e) {
            log.error("Memory init local failed for {}/{}: {}", role, username, e.getMessage());
        }
    }
}
