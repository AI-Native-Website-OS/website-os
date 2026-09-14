import axios from 'axios';
import config from '@/config';

// 专用于刷新令牌的客户端：不带 401 拦截器，避免刷新自身失败时陷入循环
const refreshClient = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 10000,
});

// 并发 401 时只发一个刷新请求（single-flight）
let refreshPromise: Promise<string> | null = null;
// token 刷新成功后通知 React 状态层（useAuth）同步
let tokenUpdater: ((token: string, refreshToken: string) => void) | null = null;

export function registerTokenUpdater(cb: (token: string, refreshToken: string) => void) {
  tokenUpdater = cb;
}

function getRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
}

function persist(token: string, refreshToken: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  tokenUpdater?.(token, refreshToken);
}

/** 用 refresh token 换取新的 access/refresh 令牌，返回新的 access token。 */
export async function refreshAuthToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) throw new Error('no refresh token');
    const res: any = await refreshClient.post('/auth/refresh', { refreshToken: rt });
    const body = res?.data;
    if (!body || body.code !== 200 || !body.data?.token) {
      throw new Error(body?.message || '刷新令牌失败');
    }
    const token = body.data.token as string;
    const refreshToken = (body.data.refreshToken as string) || rt;
    persist(token, refreshToken);
    return token;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/** 清空本地认证信息（token / refreshToken / user / permissions / cookie）。 */
export function clearAuthStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('permissions');
  document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
}
