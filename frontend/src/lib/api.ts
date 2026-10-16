import axios from 'axios';
import config from '@/config';
import { refreshAuthToken, clearAuthStorage } from './tokenRefresh';
import { getLocale } from './localeStore';
import { t } from '@/i18n/translate';

const api = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeout,
});

api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 所有接口注入当前语言，后端按 locale 返回译文（管理后台同样按当前语言预览译文；
    // 写请求由后端在保存时把未修改的译文还原为中文原文，避免覆盖中文源内容）。
    config.params = { ...(config.params || {}) };
    if (config.params.locale === undefined) {
      config.params.locale = getLocale();
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    // access token 过期：用 refresh token 静默续期后重试原请求（仅重试一次）
    if (status === 401 && original && !(original as any)._retry) {
      (original as any)._retry = true;
      try {
        const newToken = await refreshAuthToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (e) {
        clearAuthStorage();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error.response?.data || error);
      }
    }
    if (status === 403) {
      return Promise.reject({ message: t('libUi.api.forbidden'), code: 403 });
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;

export async function uploadFile(file: File, type: string, subPath?: string, validate?: 'cover' | 'image' | 'document'): Promise<{ url: string; name: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  if (subPath) form.append('subPath', subPath);
  if (validate) form.append('validate', validate);
  const res: any = await api.post('/upload', form);
  if (res.code !== 200) {
    throw new Error(res.message || t('libUi.api.uploadFailed'));
  }
  const url = res.data?.url || res.url;
  const name = res.data?.name || res.name || file.name;
  if (!url) {
    throw new Error(t('libUi.api.uploadInvalid'));
  }
  return { url, name };
}
