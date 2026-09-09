'use client';

import { useState, useRef, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import type { SyncProgress } from '@/types';

export function useSyncProgress() {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [syncing, setSyncing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSync = useCallback(async (type: string) => {
    setSyncing(true);
    try {
      const res = await adminApi.knowledge.startSyncByType(type);
      const taskId = res?.data?.taskId;
      if (!taskId) { setSyncing(false); return; }

      setProgress({ taskId, type, status: 'running', total: 0, current: 0, success: 0, fail: 0, currentItem: '', errorMessage: '', percent: 0 });

      intervalRef.current = setInterval(async () => {
        try {
          const pr = await adminApi.knowledge.getSyncProgress(taskId);
          const p = pr?.data;
          if (!p) return;
          setProgress({ ...p });

          if (p.status === 'completed' || p.status === 'error') {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setSyncing(false);
          }
        } catch {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setSyncing(false);
        }
      }, 600);
    } catch {
      setSyncing(false);
    }
  }, []);

  const stopSync = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSyncing(false);
    setProgress(null);
  }, []);

  return { progress, syncing, startSync, stopSync };
}