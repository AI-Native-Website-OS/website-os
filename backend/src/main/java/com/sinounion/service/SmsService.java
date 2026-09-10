package com.sinounion.service;

import com.aliyun.dysmsapi20170525.Client;
import com.aliyun.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.dysmsapi20170525.models.SendSmsResponse;
import com.aliyun.dysmsapi20170525.models.SendSmsResponseBody;
import com.aliyun.tea.TeaException;
import com.aliyun.teaopenapi.models.Config;
import com.aliyun.teautil.models.RuntimeOptions;
import com.sinounion.common.BusinessException;
import com.sinounion.config.SecretCryptoService;
import com.sinounion.entity.SystemConfig;
import com.sinounion.mapper.SystemConfigMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.util.concurrent.TimeUnit;

/**
 * 短信验证码服务（T05 手机号短信验证码登录）
 *
 * 短信配置（阿里云 Dysmsapi）通过 system_configs 存储，由超级管理员在后台配置：
 *   sms_access_key_id      阿里云 AccessKey ID
 *   sms_access_key_secret  阿里云 AccessKey Secret
 *   sms_sign_name          短信签名
 *   sms_template_code      短信模板 Code
 *
 * 未配置短信（Key 为空）时进入开发兜底模式：验证码直接返回给调用方并打印日志，
 * 便于本地联调；配置后走阿里云官方 SDK（dysmsapi20170525）发送真实短信，
 * 发送失败时抛出携带阿里云错误信息的 BusinessException，不再伪装成开发模式。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SmsService {

    private static final String CODE_PREFIX = "sms:code:";
    private static final long CODE_EXPIRE_MINUTES = 5;
    private static final String SEND_COOLDOWN_PREFIX = "sms:cooldown:";
    private static final long COOLDOWN_SECONDS = 60;

    private static final String KEY_ACCESS_KEY_ID = "sms_access_key_id";
    private static final String KEY_ACCESS_KEY_SECRET = "sms_access_key_secret";
    private static final String KEY_SIGN_NAME = "sms_sign_name";
    private static final String KEY_TEMPLATE_CODE = "sms_template_code";

    private static final String ENDPOINT = "dysmsapi.aliyuncs.com";

    private final RedisTemplate<String, Object> redisTemplate;
    private final SystemConfigMapper systemConfigMapper;
    private final SecretCryptoService secretCryptoService;
    private final SecureRandom secureRandom = new SecureRandom();

    /** 发送验证码到指定手机号；返回验证码（开发兜底模式返回，生产模式返回 null 表示已发送）。 */
    public String sendCode(String phone) {
        if (!isValidPhone(phone)) {
            throw new BusinessException("手机号格式不正确");
        }

        String cooldownKey = SEND_COOLDOWN_PREFIX + phone;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw new BusinessException("发送过于频繁，请 60 秒后重试");
        }

        String code = String.format("%06d", secureRandom.nextInt(1000000));

        String key = CODE_PREFIX + phone;
        redisTemplate.opsForValue().set(key, code, CODE_EXPIRE_MINUTES, TimeUnit.MINUTES);
        redisTemplate.opsForValue().set(cooldownKey, "1", COOLDOWN_SECONDS, TimeUnit.SECONDS);

        boolean sent = sendSms(phone, code);

        // 开发兜底：未配置短信服务时，验证码直接返回并在日志打印
        if (!sent) {
            log.info("[SMS-DEV] 验证码 for {}: {}", phone, code);
            return code;
        }
        return null;
    }

    public boolean verifyCode(String phone, String code) {
        if (!StringUtils.hasText(phone) || !StringUtils.hasText(code)) {
            return false;
        }
        Object stored = redisTemplate.opsForValue().get(CODE_PREFIX + phone);
        if (stored == null) {
            return false;
        }
        if (stored.toString().equals(code.trim())) {
            redisTemplate.delete(CODE_PREFIX + phone);
            return true;
        }
        return false;
    }

    /**
     * 发送短信。返回 false 表示未配置短信服务（进入开发兜底模式）；
     * 已配置但阿里云调用失败时抛出 BusinessException（携带阿里云错误信息），不会伪装成开发模式。
     */
    private boolean sendSms(String phone, String code) {
        String accessKeyId = getConfig(KEY_ACCESS_KEY_ID);
        String accessKeySecret = getConfig(KEY_ACCESS_KEY_SECRET);
        String signName = getConfig(KEY_SIGN_NAME);
        String templateCode = getConfig(KEY_TEMPLATE_CODE);

        // 未配置 → 开发兜底
        if (!StringUtils.hasText(accessKeyId)
                || !StringUtils.hasText(accessKeySecret)
                || !StringUtils.hasText(signName)
                || !StringUtils.hasText(templateCode)) {
            return false;
        }

        SendSmsRequest request = new SendSmsRequest()
                .setPhoneNumbers(phone)
                .setSignName(signName)
                .setTemplateCode(templateCode)
                .setTemplateParam("{\"code\":\"" + code + "\"}");

        try {
            SendSmsResponse resp = createClient(accessKeyId, accessKeySecret)
                    .sendSmsWithOptions(request, new RuntimeOptions());
            SendSmsResponseBody body = resp.getBody();
            log.info("[SMS] 阿里云返回 Code={}, Message={}, BizId={}", body.getCode(), body.getMessage(), body.getBizId());
            if (!"OK".equals(body.getCode())) {
                throw new BusinessException("短信发送失败：" + body.getMessage() + "（" + body.getCode() + "）");
            }
            return true;
        } catch (TeaException e) {
            log.error("短信发送失败：code={}, message={}", e.getCode(), e.getMessage(), e);
            throw new BusinessException("短信发送失败：" + e.getMessage());
        } catch (BusinessException be) {
            throw be;
        } catch (Exception e) {
            log.error("短信发送失败：{}", e.getMessage(), e);
            throw new BusinessException("短信发送失败，请稍后重试");
        }
    }

    /** 创建阿里云短信客户端（测试可覆写注入 mock）。 */
    protected Client createClient(String accessKeyId, String accessKeySecret) {
        Config config = new Config()
                .setAccessKeyId(accessKeyId)
                .setAccessKeySecret(accessKeySecret)
                .setEndpoint(ENDPOINT);
        try {
            return new Client(config);
        } catch (Exception e) {
            throw new BusinessException("短信客户端初始化失败：" + e.getMessage());
        }
    }

    private String getConfig(String key) {
        SystemConfig cfg = systemConfigMapper.findByKey(key);
        if (cfg == null || cfg.getConfigValue() == null) {
            return null;
        }
        // 敏感项在 system_configs 中为 AES 密文，使用前解密；历史明文（无 enc: 前缀）原样返回
        return secretCryptoService.decryptAtRest(cfg.getConfigValue());
    }

    private boolean isValidPhone(String phone) {
        return phone != null && phone.matches("^1[3-9]\\d{9}$");
    }
}