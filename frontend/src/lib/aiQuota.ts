export const DEFAULT_USER_RATE_LIMIT = 30;
export const DEFAULT_GUEST_DAILY_LIMIT = 5;

const VISITOR_KEY = 'sn_visitor_id';
const GUEST_QUOTA_KEY = 'sn_guest_quota';

const USER_WINDOW_MS = 60 * 1000;

export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let vid = localStorage.getItem(VISITOR_KEY);
  if (!vid) {
    vid =
      'v_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10);
    localStorage.setItem(VISITOR_KEY, vid);
  }
  return vid;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function getGuestQuota(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(GUEST_QUOTA_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.date === todayKey()) return data.count || 0;
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export function setGuestQuota(count: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_QUOTA_KEY, JSON.stringify({ date: todayKey(), count }));
  } catch {
    /* ignore */
  }
}

export function recordGuestUse() {
  setGuestQuota(getGuestQuota() + 1);
}

const userRequestTimes: number[] = [];

export function checkUserRateLimit(
  limit: number,
  windowMs: number = USER_WINDOW_MS
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  while (userRequestTimes.length && userRequestTimes[0] <= now - windowMs) {
    userRequestTimes.shift();
  }
  if (userRequestTimes.length >= limit) {
    return { allowed: false, remaining: 0 };
  }
  userRequestTimes.push(now);
  return { allowed: true, remaining: limit - userRequestTimes.length };
}
