import axios from 'axios';
import config from '@/config';
import { refreshAuthToken, clearAuthStorage } from './tokenRefresh';

const aiApi = axios.create({
  baseURL: config.ai.baseUrl,
  timeout: config.api.timeout,
});

aiApi.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

aiApi.interceptors.response.use(
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
        return aiApi(original);
      } catch (e) {
        clearAuthStorage();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error.response?.data || error);
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default aiApi;
