import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,

  // 配置图片优化
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Configure webpack for better performance
  webpack: (config, { dev, isServer }) => {
    // Enable fast refresh in development
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    // 生产环境优化
    if (!dev) {
      // 启用生产环境压缩
      config.optimization = {
        ...config.optimization,
        minimize: true,
      };
    }

    return config;
  },

  // Configure development server indicators
  devIndicators: {
    position: 'bottom-right',
  },

  // Enable source maps for debugging (生产环境关闭以减少包体积)
  productionBrowserSourceMaps: false,

  // 配置压缩优化
  compress: true,

  // 配置静态资源缓存策略
  generateEtags: true,

  // 配置输出优化
  output: 'standalone',

  // 配置头部信息（包括缓存策略）
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
