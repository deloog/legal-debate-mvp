/**
 * 前端性能优化测试套件
 *
 * 测试目标：
 * 1. 验证Next.js配置优化
 * 2. 验证布局文件优化
 * 3. 验证代码分割和懒加载配置
 * 4. 验证打包优化配置
 * 5. 确保测试覆盖率≥90%
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('前端性能优化配置', () => {
  let configContent: string;
  let layoutContent: string;

  beforeAll(() => {
    const configPath = path.join(process.cwd(), 'config/next.config.ts');
    const layoutPath = path.join(process.cwd(), 'src/app/layout.tsx');

    configContent = fs.readFileSync(configPath, 'utf-8');
    layoutContent = fs.readFileSync(layoutPath, 'utf-8');
  });

  describe('1. Next.js配置测试', () => {
    it('应该验证配置文件存在', () => {
      const configPath = path.join(process.cwd(), 'config/next.config.ts');

      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('应该包含代码分割配置', () => {
      expect(configContent).toContain('splitChunks');
      expect(configContent).toContain('vendor');
      expect(configContent).toContain('react');
    });

    it('应该包含Tree Shaking配置', () => {
      expect(configContent).toContain('usedExports');
      expect(configContent).toContain('sideEffects');
    });

    it('应该包含图片优化配置', () => {
      expect(configContent).toContain('formats');
      expect(configContent).toContain('image/avif');
      expect(configContent).toContain('image/webp');
    });

    it('应该包含模块化导入优化', () => {
      expect(configContent).toContain('modularizeImports');
      expect(configContent).toContain('lucide-react');
    });

    it('应该包含缓存策略配置', () => {
      expect(configContent).toContain('Cache-Control');
      expect(configContent).toContain('max-age=31536000');
    });
  });

  describe('2. 布局文件优化测试', () => {
    it('应该导出metadata', () => {
      expect(layoutContent).toContain('export const metadata');
    });

    it('应该包含viewport配置', () => {
      expect(layoutContent).toContain('export const viewport');
    });

    it('应该使用Suspense实现代码分割', () => {
      expect(layoutContent).toContain('Suspense');
      expect(layoutContent).toContain('fallback');
    });

    it('应该使用字体display swap策略', () => {
      expect(layoutContent).toContain("display: 'swap'");
    });

    it('应该包含SEO优化的metadata', () => {
      expect(layoutContent).toContain('description');
      expect(layoutContent).toContain('keywords');
      expect(layoutContent).toContain('openGraph');
    });
  });

  describe('3. 布局文件结构测试', () => {
    it('应该包含html标签', () => {
      expect(layoutContent).toContain('<html');
    });

    it('应该设置正确的lang属性', () => {
      expect(layoutContent).toContain("lang='zh-CN'");
    });

    it('应该设置字体变量', () => {
      expect(layoutContent).toContain('--font-geist-sans');
      expect(layoutContent).toContain('--font-geist-mono');
    });

    it('应该使用Suspense包裹children', () => {
      expect(layoutContent).toContain('<Suspense');
    });
  });

  describe('4. 性能优化指标测试', () => {
    it('应该禁用source maps在生产环境', () => {
      expect(configContent).toContain('productionBrowserSourceMaps: false');
    });

    it('应该启用压缩', () => {
      expect(configContent).toContain('compress: true');
    });

    it('应该启用ETag', () => {
      expect(configContent).toContain('generateEtags: true');
    });

    it('应该使用standalone输出模式', () => {
      expect(configContent).toContain("output: 'standalone'");
    });
  });

  describe('5. 安全性优化测试', () => {
    it('应该设置安全响应头', () => {
      expect(configContent).toContain('X-Content-Type-Options');
      expect(configContent).toContain('nosniff');
      expect(configContent).toContain('X-Frame-Options');
      expect(configContent).toContain('DENY');
      expect(configContent).toContain('X-XSS-Protection');
      expect(configContent).toContain('mode=block');
    });

    it('应该设置CSP', () => {
      expect(configContent).toContain('contentSecurityPolicy');
    });
  });

  describe('6. 第三方库优化测试', () => {
    it('应该配置optimizePackageImports', () => {
      expect(configContent).toContain('optimizePackageImports');
    });

    it('应该配置modularizeImports', () => {
      expect(configContent).toContain('modularizeImports');
    });
  });

  describe('7. 打包分析工具测试', () => {
    it('应该包含打包分析插件配置', () => {
      expect(configContent).toContain('ANALYZE');
      expect(configContent).toContain('BundleAnalyzerPlugin');
    });

    it('应该使用条件加载分析插件', () => {
      expect(configContent).toContain("process.env.ANALYZE === 'true'");
    });
  });

  describe('8. 字体优化测试', () => {
    it('应该使用display swap策略', () => {
      expect(layoutContent).toContain("display: 'swap'");
    });

    it('应该预加载主字体', () => {
      const geistSansMatch = layoutContent.match(
        /geistSans[\s\S]*preload:\s*true/
      );
      expect(geistSansMatch).toBeTruthy();
    });

    it('应该不预加载等宽字体', () => {
      const geistMonoMatch = layoutContent.match(
        /geistMono[\s\S]*preload:\s*false/
      );
      expect(geistMonoMatch).toBeTruthy();
    });
  });

  describe('9. metadata优化测试', () => {
    it('应该包含title模板', () => {
      expect(layoutContent).toContain('template');
      expect(layoutContent).toContain('%s | AI法律辩论系统');
    });

    it('应该包含描述信息', () => {
      expect(layoutContent).toContain('AI驱动的法律辩论系统');
    });

    it('应该包含关键词', () => {
      expect(layoutContent).toContain('keywords');
    });

    it('应该包含作者信息', () => {
      expect(layoutContent).toContain('authors');
      expect(layoutContent).toContain('creator');
      expect(layoutContent).toContain('publisher');
    });

    it('应该包含metadataBase', () => {
      expect(layoutContent).toContain('metadataBase');
    });

    it('应该包含OpenGraph配置', () => {
      expect(layoutContent).toContain('openGraph');
      expect(layoutContent).toContain('type');
      expect(layoutContent).toContain('locale');
      expect(layoutContent).toContain('siteName');
    });

    it('应该包含robots配置', () => {
      expect(layoutContent).toContain('robots');
      expect(layoutContent).toContain('index');
      expect(layoutContent).toContain('follow');
    });
  });

  describe('10. viewport优化测试', () => {
    it('应该设置viewport宽度', () => {
      expect(layoutContent).toContain('device-width');
    });

    it('应该设置初始缩放', () => {
      expect(layoutContent).toContain('initialScale');
    });

    it('应该设置最大缩放', () => {
      expect(layoutContent).toContain('maximumScale');
    });

    it('应该设置主题色', () => {
      expect(layoutContent).toContain('themeColor');
    });
  });

  describe('11. 图片优化配置测试', () => {
    it('应该配置多种图片格式', () => {
      expect(configContent).toContain('image/avif');
      expect(configContent).toContain('image/webp');
    });

    it('应该配置图片尺寸', () => {
      expect(configContent).toContain('deviceSizes');
      expect(configContent).toContain('imageSizes');
    });

    it('应该设置图片缓存TTL', () => {
      expect(configContent).toContain('minimumCacheTTL');
    });

    it('应该配置图片安全策略', () => {
      expect(configContent).toContain('contentSecurityPolicy');
      expect(configContent).toContain('dangerouslyAllowSVG');
    });
  });

  describe('12. 代码分割策略测试', () => {
    it('应该配置vendor代码分割', () => {
      expect(configContent).toContain('vendor');
      expect(configContent).toContain('node_modules');
    });

    it('应该配置React代码分割', () => {
      expect(configContent).toMatch(/react[\s\S]*priority: 20/);
    });

    it('应该配置common代码分割', () => {
      expect(configContent).toContain('common');
      expect(configContent).toContain('minChunks');
    });
  });

  describe('13. 优化功能测试', () => {
    it('应该启用实验性优化', () => {
      expect(configContent).toContain('experimental');
      expect(configContent).toContain('optimizePackageImports');
    });

    it('应该配置外部依赖', () => {
      expect(configContent).toContain('externals');
    });

    it('应该配置重定向优化', () => {
      expect(configContent).toContain('redirects');
    });
  });

  describe('14. 加载状态组件测试', () => {
    it('应该包含LoadingFallback组件', () => {
      expect(layoutContent).toContain('LoadingFallback');
    });

    it('应该包含加载动画', () => {
      expect(layoutContent).toContain('animate-spin');
    });

    it('应该包含加载提示文本', () => {
      expect(layoutContent).toContain('加载中');
    });
  });

  describe('15. 性能指标验证', () => {
    it('应该启用压缩优化', () => {
      expect(configContent).toContain('compress: true');
    });

    it('应该启用minimize', () => {
      expect(configContent).toContain('minimize: true');
    });

    it('应该使用standalone输出', () => {
      expect(configContent).toContain("output: 'standalone'");
    });

    it('应该生成ETag', () => {
      expect(configContent).toContain('generateEtags: true');
    });
  });
});
