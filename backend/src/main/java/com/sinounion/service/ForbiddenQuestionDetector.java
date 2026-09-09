package com.sinounion.service;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class ForbiddenQuestionDetector {

    @Value("${AI_SERVICE_URL}")
    private String aiServiceUrl;

    @javax.annotation.PostConstruct
    public void init() {
        if (aiServiceUrl != null) {
            aiServiceUrl = aiServiceUrl.trim();
        }
    }

    /**
     * 检测用户输入是否命中禁答主题
     *
     * @param userInput 用户问题
     * @return 检测结果: {blocked: boolean, matchedTopic: String, similarity: double, answer: String}
     */
    public Map<String, Object> detect(String userInput) {
        Map<String, Object> result = new HashMap<>();
        result.put("blocked", false);
        result.put("matchedTopic", null);
        result.put("similarity", 0.0);
        result.put("answer", "");

        if (userInput == null || userInput.trim().isEmpty()) {
            return result;
        }

        try {
            String url = aiServiceUrl + "/ai/forbidden/detect";
            Map<String, String> body = new HashMap<>();
            body.put("user_input", userInput);

            HttpResponse response = HttpRequest.post(url)
                    .body(JSONUtil.toJsonStr(body), "application/json")
                    .timeout(10000)
                    .execute();

            if (response.getStatus() == 200) {
                JSONObject json = JSONUtil.parseObj(response.body());
                result.put("blocked", json.getBool("blocked", false));
                result.put("matchedTopic", json.getStr("matched_topic"));
                result.put("similarity", json.getDouble("similarity", 0.0));
                result.put("answer", json.getStr("answer", ""));
            } else {
                log.warn("Forbidden detect HTTP {}: {}", response.getStatus(), response.body());
            }
        } catch (Exception e) {
            log.warn("Forbidden detect call failed: {}", e.getMessage());
        }

        return result;
    }

    /**
     * 计算并存储指定禁答示例的 embedding 向量
     *
     * @param exampleId 示例 ID
     * @return 是否成功
     */
    public boolean computeExampleEmbedding(Long exampleId) {
        try {
            String url = aiServiceUrl + "/ai/forbidden/examples/" + exampleId + "/embed";
            HttpResponse response = HttpRequest.post(url)
                    .timeout(15000)
                    .execute();
            if (response.getStatus() == 200) {
                JSONObject json = JSONUtil.parseObj(response.body());
                boolean ok = "ok".equals(json.getStr("status"));
                if (ok) {
                    log.info("Embedding computed for forbidden example {}", exampleId);
                } else {
                    log.warn("Failed to compute embedding for example {}: {}", exampleId, json.getStr("message"));
                }
                return ok;
            } else {
                log.warn("Compute embedding HTTP {} for example {}", response.getStatus(), exampleId);
                return false;
            }
        } catch (Exception e) {
            log.warn("Compute embedding call failed for example {}: {}", exampleId, e.getMessage());
            return false;
        }
    }

    /**
     * 刷新所有缺少 embedding 的禁答示例
     */
    public void refreshAllEmbeddings() {
        try {
            String url = aiServiceUrl + "/ai/forbidden/refresh-embeddings";
            HttpResponse response = HttpRequest.post(url)
                    .timeout(60000)
                    .execute();
            if (response.getStatus() == 200) {
                log.info("Forbidden example embeddings refreshed");
            } else {
                log.warn("Refresh embeddings HTTP {}: {}", response.getStatus(), response.body());
            }
        } catch (Exception e) {
            log.warn("Refresh embeddings call failed: {}", e.getMessage());
        }
    }
}
