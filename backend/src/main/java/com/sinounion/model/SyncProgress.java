package com.sinounion.model;

import java.util.concurrent.atomic.AtomicInteger;

public class SyncProgress {

    private String taskId;
    private String type;
    private volatile String status = "pending"; // pending / running / completed / error
    private AtomicInteger total = new AtomicInteger(0);
    private AtomicInteger current = new AtomicInteger(0);
    private AtomicInteger success = new AtomicInteger(0);
    private AtomicInteger fail = new AtomicInteger(0);
    private volatile String currentItem = "";
    private volatile String errorMessage = "";

    public SyncProgress(String taskId, String type) {
        this.taskId = taskId;
        this.type = type;
    }

    public void start(int total) {
        this.status = "running";
        this.total.set(total);
    }

    public void advance(String itemName) {
        this.currentItem = itemName;
        this.current.incrementAndGet();
    }

    public void addSuccess() {
        this.success.incrementAndGet();
    }

    public void addFail() {
        this.fail.incrementAndGet();
    }

    public void complete() {
        this.status = "completed";
    }

    public void error(String msg) {
        this.status = "error";
        this.errorMessage = msg;
    }

    public String getTaskId() { return taskId; }
    public String getType() { return type; }
    public String getStatus() { return status; }
    public int getTotal() { return total.get(); }
    public int getCurrent() { return current.get(); }
    public int getSuccess() { return success.get(); }
    public int getFail() { return fail.get(); }
    public String getCurrentItem() { return currentItem; }
    public String getErrorMessage() { return errorMessage; }
    public int getPercent() {
        int t = total.get();
        return t > 0 ? Math.min(current.get() * 100 / t, 100) : 0;
    }
}