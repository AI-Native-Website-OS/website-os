package com.sinounion.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.sinounion.dto.CreateUserDTO;
import com.sinounion.dto.LoginDTO;
import com.sinounion.dto.RegisterDTO;
import com.sinounion.dto.SmsLoginDTO;
import com.sinounion.dto.UpdateUserDTO;
import com.sinounion.entity.User;
import com.sinounion.vo.LoginVO;
import com.sinounion.vo.UserVO;

public interface UserService {
    LoginVO login(LoginDTO dto);
    LoginVO loginByCode(SmsLoginDTO dto);
    UserVO register(RegisterDTO dto);
    UserVO getUserById(Long id);
    User getUserByUsername(String username);
    UserVO updateUser(Long id, UpdateUserDTO dto);
    void deleteUser(Long id);
    UserVO toggleStatus(Long id);
    Page<UserVO> getUsers(int page, int size, String role, String userType, String keyword);
    UserVO createUser(CreateUserDTO dto);
    void resetPassword(Long id, String newPassword);
}
