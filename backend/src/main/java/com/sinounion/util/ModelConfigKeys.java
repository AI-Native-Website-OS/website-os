package com.sinounion.util;

import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * LLM / Embedding / VL / Rerank 模型配置项的统一清单。
 * 这些配置由管理后台「模型参数配置」页维护，存储于 system_configs 表（config_type=model），
 * AI 服务（Python）读取该表实现动态更新，不再写入 .env 文件。
 */
public final class ModelConfigKeys {

    private ModelConfigKeys() {}

    public static final Set<String> DB_BACKED_KEYS = new HashSet<>(Arrays.asList(
        // ── LLM ──
        "LLM_PROVIDER", "LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL",
        "LLM_TEMPERATURE", "LLM_MAX_TOKENS", "LLM_TOP_P",
        "LLM_FREQUENCY_PENALTY", "LLM_PRESENCE_PENALTY",
        "LLM_SEED", "LLM_STOP",
        "LLM_THINKING_KEYWORD", "LLM_THINKING_AUTO_COLLAPSE",
        "LLM_THINKING_ENABLED",
        // ── Embedding ──
        "EMBEDDING_PROVIDER", "EMBEDDING_BASE_URL", "EMBEDDING_API_KEY",
        "EMBEDDING_MODEL", "EMBEDDING_DIMENSION",
        // ── VL ──
        "VL_PROVIDER", "VL_BASE_URL", "VL_API_KEY",
        "VL_MODEL", "VL_TEMPERATURE", "VL_MAX_TOKENS",
        "VL_IMAGE_SIZE", "VL_IMAGE_QUALITY",
        // ── Rerank ──
        "RERANK_PROVIDER", "RERANK_BASE_URL", "RERANK_API_KEY",
        "RERANK_MODEL", "RERANK_ENABLED", "RERANK_TOP_K"
    ));

    public static final Map<String, String> DESCRIPTIONS = new LinkedHashMap<>();
    static {
        DESCRIPTIONS.put("LLM_PROVIDER", "LLM 模型提供商");
        DESCRIPTIONS.put("LLM_BASE_URL", "LLM API 地址");
        DESCRIPTIONS.put("LLM_API_KEY", "LLM API Key");
        DESCRIPTIONS.put("LLM_MODEL", "LLM 模型名称");
        DESCRIPTIONS.put("LLM_TEMPERATURE", "LLM 温度参数");
        DESCRIPTIONS.put("LLM_MAX_TOKENS", "LLM 最大 Token 数");
        DESCRIPTIONS.put("LLM_TOP_P", "LLM Top P");
        DESCRIPTIONS.put("LLM_FREQUENCY_PENALTY", "LLM 频率惩罚");
        DESCRIPTIONS.put("LLM_PRESENCE_PENALTY", "LLM 存在惩罚");
        DESCRIPTIONS.put("LLM_SEED", "LLM 随机种子");
        DESCRIPTIONS.put("LLM_STOP", "LLM 停止序列");
        DESCRIPTIONS.put("LLM_THINKING_KEYWORD", "LLM 思考触发词");
        DESCRIPTIONS.put("LLM_THINKING_AUTO_COLLAPSE", "LLM 自动折叠思考");
        DESCRIPTIONS.put("LLM_THINKING_ENABLED", "LLM 思考过程开关");
        DESCRIPTIONS.put("EMBEDDING_PROVIDER", "Embedding 模型提供商");
        DESCRIPTIONS.put("EMBEDDING_BASE_URL", "Embedding API 地址");
        DESCRIPTIONS.put("EMBEDDING_API_KEY", "Embedding API Key");
        DESCRIPTIONS.put("EMBEDDING_MODEL", "Embedding 模型名称");
        DESCRIPTIONS.put("EMBEDDING_DIMENSION", "Embedding 向量维度");
        DESCRIPTIONS.put("VL_PROVIDER", "VL 模型提供商");
        DESCRIPTIONS.put("VL_BASE_URL", "VL API 地址");
        DESCRIPTIONS.put("VL_API_KEY", "VL API Key");
        DESCRIPTIONS.put("VL_MODEL", "VL 模型名称");
        DESCRIPTIONS.put("VL_TEMPERATURE", "VL 温度参数");
        DESCRIPTIONS.put("VL_MAX_TOKENS", "VL 最大 Token 数");
        DESCRIPTIONS.put("VL_IMAGE_SIZE", "VL 图片尺寸");
        DESCRIPTIONS.put("VL_IMAGE_QUALITY", "VL 图片质量");
        DESCRIPTIONS.put("RERANK_PROVIDER", "Rerank 模型提供商");
        DESCRIPTIONS.put("RERANK_BASE_URL", "Rerank API 地址");
        DESCRIPTIONS.put("RERANK_API_KEY", "Rerank API Key");
        DESCRIPTIONS.put("RERANK_MODEL", "Rerank 模型名称");
        DESCRIPTIONS.put("RERANK_ENABLED", "Rerank 是否启用");
        DESCRIPTIONS.put("RERANK_TOP_K", "Rerank Top K");
    }
}
