package com.sinounion.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.sinounion.entity.User;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;
import java.util.Map;

@Mapper
public interface UserMapper extends BaseMapper<User> {

    @Select("SELECT * FROM users WHERE username = #{username} AND deleted = 0")
    User findByUsername(String username);

    @Select("SELECT * FROM users WHERE username = #{username}")
    User findByUsernameIncludeDeleted(String username);

    @Delete("DELETE FROM users WHERE id = #{id}")
    void hardDeleteById(Long id);

    @Select("SELECT * FROM users WHERE email = #{email} AND deleted = 0")
    User findByEmail(String email);

    @Select("SELECT * FROM users WHERE phone = #{phone} AND deleted = 0")
    User findByPhone(String phone);

    @Select("SELECT * FROM users WHERE role = #{role} AND deleted = 0")
    List<User> findByRole(String role);

    @Select("SELECT * FROM users WHERE user_type = #{userType} AND deleted = 0")
    List<User> findByUserType(String userType);

    @Update("UPDATE users SET last_login_time = NOW() WHERE id = #{id}")
    int updateLastLoginTime(@Param("id") Long id);

    @Update("UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = #{id}")
    int incrementTokenVersion(@Param("id") Long id);

    @Select("SELECT COALESCE(token_version, 0) FROM users WHERE id = #{id}")
    Integer getTokenVersion(@Param("id") Long id);

    @Select("SELECT id, username, real_name, role, last_login_time FROM users WHERE deleted = 0 AND status = 1 ORDER BY last_login_time DESC NULLS LAST")
    List<Map<String, Object>> findActiveUsers();
}
