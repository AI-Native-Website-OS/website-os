import api from './api';
import config from '@/config';

/**
 * 前台行为埋点（下载/AI 对话等），复用与 useTracking 相同的 visitorId。
 * 与页面浏览统计后端一致，写入 user_behaviors，供后台「今日下载」等指标统计。
 */
export function trackBehavior(behaviorType: string, targetType?: string, targetId?: number, metadata?: string) {
  if (typeof window === 'undefined') return;
  try {
    const visitorId = localStorage.getItem('visitorId') || '';
    if (!visitorId) return;
    api.post('/stats/behavior', null, {
      params: { visitorId, behaviorType, targetType, targetId, metadata },
    }).catch(() => { /* silently fail */ });
  } catch {
    /* silently fail */
  }
}

/**
 * 上报页面停留时长（秒）。用 sendBeacon 在页面隐藏/离开时发送，避免阻塞卸载。
 */
export function trackPageDuration(visitorId: string, pageUrl: string, seconds: number) {
  if (typeof window === 'undefined' || !visitorId || seconds <= 0) return;
  const url = `${config.api.baseUrl}/stats/page-leave?visitorId=${encodeURIComponent(visitorId)}&pageUrl=${encodeURIComponent(pageUrl)}&duration=${Math.round(seconds)}`;
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
    } else {
      fetch(url, { method: 'POST', keepalive: true }).catch(() => { /* ignore */ });
    }
  } catch {
    /* ignore */
  }
}
