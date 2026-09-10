import axios from 'axios';
import config from '@/config';

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
  (error) => {
    return Promise.reject(error.response?.data || error);
  }
);

export default aiApi;
