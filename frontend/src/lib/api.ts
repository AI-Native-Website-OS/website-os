import axios from 'axios';
import config from '@/config';

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
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    if (error.response?.status === 403) {
      return Promise.reject({ message: '无权限执行此操作', code: 403 });
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
    throw new Error(res.message || '上传失败');
  }
  const url = res.data?.url || res.url;
  const name = res.data?.name || res.name || file.name;
  if (!url) {
    throw new Error('上传返回数据异常，缺少文件地址');
  }
  return { url, name };
}
