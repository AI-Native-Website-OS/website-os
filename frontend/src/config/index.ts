let aiBaseUrl = '/ai';
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  aiBaseUrl = 'http://localhost:8000/ai';
}

// 客户端直连后端（绕过 nginx 反代）时可在此指定后端可访问地址，例如 http://<host>:8081。
// 注意：`NEXT_PUBLIC_` 前缀的变量会在 next build 时内联进客户端包；不带前缀的仅构建期可用。
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '/api';

// 与 lib/static-build.ts 约定一致：外部传入的是后端主机地址（如 http://host:8081），
// 后端 context-path 为 /api，需补上 /api 前缀；默认相对路径 /api 保持不变。
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
    baseUrl: normalizeApiBase(process.env.UPLOAD_BASE_URL || apiBaseUrl),
  },

  app: {
    name: '圣诺联合科技有限公司',
  },
};

export default config;