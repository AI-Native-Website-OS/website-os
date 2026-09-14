// AI 服务地址：固定走相对路径 /ai（本地经 dev 代理 / nginx 反代转发到 AI 服务）。
const aiBaseUrl = '/ai';

// 后端基础地址：固定相对路径 /api（与后端 context-path 一致，本地经 dev 代理 / nginx 反代转发）。
const apiBaseUrl = '/api';

// 后端 context-path 固定为 /api；保留 normalizeApiBase 处理外部完整地址时的拼接。
function normalizeApiBase(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  if (trimmed === '/api' || trimmed.endsWith('/api')) return trimmed;
  return `${trimmed}/api`;
}

const config = {
  api: {
    baseUrl: normalizeApiBase(apiBaseUrl),
    timeout: 30000,
  },

  ai: {
    baseUrl: aiBaseUrl,
    sessionTimeout: 30 * 60 * 1000,
  },

  upload: {
    baseUrl: normalizeApiBase(apiBaseUrl),
  },

  app: {
    name: '官网',
  },
};

export default config;