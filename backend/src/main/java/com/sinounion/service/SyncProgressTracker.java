package com.sinounion.service;

import com.sinounion.model.SyncProgress;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SyncProgressTracker {

    private final Map<String, SyncProgress> store = new ConcurrentHashMap<>();

    public SyncProgress create(String type) {
        String taskId = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        SyncProgress sp = new SyncProgress(taskId, type);
        store.put(taskId, sp);
        return sp;
    }

    public SyncProgress get(String taskId) {
        return store.get(taskId);
    }

    public void remove(String taskId) {
        store.remove(taskId);
    }

    public void cleanup() {
        long now = System.currentTimeMillis();
        store.values().removeIf(p ->
            ("completed".equals(p.getStatus()) || "error".equals(p.getStatus()))
        );
    }
}