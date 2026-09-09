import axios from 'axios';
import config from '@/config';

const aiApi = axios.create({
  baseURL: config.ai.baseUrl,
  timeout: config.api.timeout,
});

aiApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    return Promise.reject(error.response?.data || error);
  }
);

export default aiApi;
