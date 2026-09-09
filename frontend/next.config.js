/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

if (process.env.NODE_ENV === 'development') {
  nextConfig.output = undefined;
  nextConfig.trailingSlash = undefined;
  nextConfig.distDir = '.next';
  nextConfig.rewrites = async () => [
    { source: '/api/:path*', destination: 'http://localhost:8080/api/:path*' },
    { source: '/ai/:path*', destination: 'http://localhost:8000/ai/:path*' },
  ];
}

module.exports = nextConfig;
