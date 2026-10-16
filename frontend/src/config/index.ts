// AI 服务地址：固定走相对路径 /ai（本地经 dev 代理 / nginx 反代转发到 AI 服务）。
const aiBaseUrl = '/ai';

// 后端基础地址：默认相对路径 /api（与后端 context-path 一致，经 dev 代理 / nginx 反代转发）。
// 本地调试时，Next dev 的 rewrite 是服务端代理且不转发客户端 IP（后端只会记录 127.0.0.1）。
// 如需在 dev 下记录真实访问者 IP，可设置 NEXT_PUBLIC_API_BASE 为后端可达地址（如 http://192.168.0.68:8080），
// 让浏览器直连后端。仅开发环境生效，生产构建忽略，仍走相对 /api（由 nginx 转发真实 IP）。
// 注意：IP 网段随部署环境不同，请勿写死；此项仅本地调试用、留空即走默认。
const devApiOverride = process.env.NEXT_PUBLIC_API_BASE;
const apiBaseUrl =
  process.env.NODE_ENV !== 'production' && devApiOverride && devApiOverride.trim()
    ? devApiOverride.trim()
    : '/api';

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