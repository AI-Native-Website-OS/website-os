/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

// 出站连接目标地址：0.0.0.0 / :: 表示“监听所有网卡”，作为连接地址时需归一化为本机回环地址
// （Windows 上把 0.0.0.0 / ::0 当作目标地址连接会直接失败）。
function connectHost(host) {
  const h = String(host || '').trim();
  if (!h || h === '0.0.0.0' || h === '::' || h === '[::]') return '127.0.0.1';
  return h;
}

// 服务地址由根 .env 的 HOST/PORT 派生；可用 *_SERVER_URL / *_SERVICE_URL 整体覆盖（与后端/Python 端一致）。
function serviceUrl(overrideKey, hostKey, portKey, defaultPort) {
  const override = process.env[overrideKey];
  if (override) return override.replace(/\/+$/, '');
  const host = connectHost(process.env[hostKey]);
  const port = process.env[portKey] || defaultPort;
  return `http://${host}:${port}`;
}

if (process.env.NODE_ENV === 'development') {
  nextConfig.output = undefined;
  nextConfig.trailingSlash = undefined;
  nextConfig.distDir = '.next';
  const backendUrl = serviceUrl('BACKEND_SERVER_URL', 'BACKEND_HOST', 'BACKEND_PORT', '8080');
  const pythonUrl = serviceUrl('PYTHON_SERVICE_URL', 'PYTHON_HOST', 'PYTHON_PORT', '8000');
  nextConfig.rewrites = async () => [
    { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
    { source: '/ai/:path*', destination: `${pythonUrl}/ai/:path*` },
  ];
}

module.exports = nextConfig;
