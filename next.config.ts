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
    // 启用图片懒加载
    loader: 'default',
    // 优化图片加载策略
    unoptimized: false,
    // 图片域名白名单
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
      },
    ],
  },

  // Configure webpack for better performance
  webpack: async (config, { dev, isServer }) => {
    // Enable fast refresh in development
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    // 生产环境优化
    if (!dev) {
      // 启用生产环境压缩和优化
      config.optimization = {
        ...config.optimization,
        minimize: true,
        // 启用代码分割
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // 第三方库单独打包
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              name: 'vendors',
            },
            // React相关库单独打包
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom|react-dom-client)[\\/]/,
              priority: 20,
              name: 'react',
            },
            // 公共代码提取
            common: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
              name: 'common',
            },
          },
        },
        // 启用作用域提升
        usedExports: true,
        // Tree Shaking优化
        sideEffects: true,
      };

      // 配置外部依赖（减少打包体积）
      if (!isServer) {
        config.externals = {
          ...config.externals,
          'react-native': 'react-native',
        };
      }
    }

    // 添加打包分析插件（仅在分析时启用）
    if (process.env.ANALYZE === 'true') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import for bundle analyzer
      const { BundleAnalyzerPlugin } = await import('@next/bundle-analyzer');
      config.plugins.push(
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - BundleAnalyzerPlugin type
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        })
      );
    }

    // 抑制服务端专用模块（payment-config / flk-crawler）因动态路径产生的
    // Critical dependency 警告——这些模块仅在 Node.js 运行时使用，路径在运行时确定
    if (isServer) {
      config.ignoreWarnings = [
        ...(config.ignoreWarnings ?? []),
        {
          module: /payment[-_]config/,
          message: /Critical dependency|overly broad/,
        },
        {
          module: /flk[-_]crawler/,
          message: /Critical dependency|overly broad/,
        },
      ];
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

  // 配置实验性功能
  experimental: {
    // 启用优化包导入
    optimizePackageImports: ['lucide-react', 'axios'],
  },

  // 排除大型动态目录，避免 output file tracing 追踪过多文件产生警告
  // - data/crawled/**   爬虫输出目录（28578+ 文件）
  // - 证书/私钥文件由运行时环境变量指定，不需纳入 standalone 追踪
  // （Next.js 13+ 此项已升至顶层，不属于 experimental）
  outputFileTracingExcludes: {
    '*': [
      'data/**',
      'public/uploads/**',
      '**/*.pem',
      '**/*.key',
      '**/*.p12',
      '**/*.pfx',
    ],
  },

  // 配置 Turbopack（Next.js 16 默认使用）
  turbopack: {},

  // 配置动态导入优化
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  // 配置头部信息（包括缓存策略和安全头）
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 基础安全头
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
          // HSTS - 强制HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Referrer Policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions Policy
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // DNS Prefetch Control
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
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
      // 预加载关键资源
      {
        source: '/_next/static/chunks/pages/_app.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // 配置重定向优化
  async redirects() {
    return [];
  },
};

export default nextConfig;
