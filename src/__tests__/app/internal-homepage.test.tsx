/**
 * 内部系统首页测试
 * 测试重新设计的内部系统导向首页
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { _prisma } from '@/lib/db';

// Mock Next.js相关模块
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock AuthProvider
jest.mock('@/app/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'test-user', role: 'ADMIN' },
    loading: false,
  })),
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('内部系统首页', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('系统概览', () => {
    it('应该显示法条总数统计', async () => {
      // Mock API响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/1000/)).toBeInTheDocument();
        expect(screen.getByText(/法条/)).toBeInTheDocument();
      });
    });

    it('应该显示关系总数统计', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/500/)).toBeInTheDocument();
        expect(screen.getByText(/关系/)).toBeInTheDocument();
      });
    });

    it('应该显示关系覆盖率', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/85%/)).toBeInTheDocument();
        expect(screen.getByText(/覆盖率/)).toBeInTheDocument();
      });
    });

    it('应该显示最后同步时间', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/最后同步/)).toBeInTheDocument();
      });
    });
  });

  describe('快速操作', () => {
    it('应该显示法条搜索入口', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/搜索法条/)).toBeInTheDocument();
      });
    });

    it('应该显示知识图谱浏览入口', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/知识图谱/)).toBeInTheDocument();
      });
    });

    it('应该显示创建辩论入口', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/创建辩论/)).toBeInTheDocument();
      });
    });

    it('应该显示合同审查入口', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/合同审查/)).toBeInTheDocument();
      });
    });
  });

  describe('知识图谱统计', () => {
    it('应该显示各类型关系统计', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/overview')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              totalLawArticles: 1000,
              totalRelations: 500,
              relationCoverage: 0.85,
              lastSyncTime: '2026-02-02T10:00:00Z',
            }),
          });
        }
        if (url.includes('/graph-stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              relationsByType: {
                CITES: 100,
                RELATED: 200,
                COMPLETES: 150,
              },
              topArticles: [],
              recommendationAccuracy: 0.92,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/关系类型/)).toBeInTheDocument();
      });
    });

    it('应该显示推荐准确率', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/overview')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              totalLawArticles: 1000,
              totalRelations: 500,
              relationCoverage: 0.85,
              lastSyncTime: '2026-02-02T10:00:00Z',
            }),
          });
        }
        if (url.includes('/graph-stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              relationsByType: {},
              topArticles: [],
              recommendationAccuracy: 0.92,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/92%/)).toBeInTheDocument();
        expect(screen.getByText(/推荐准确率/)).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理API加载失败', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.getByText(/加载失败/)).toBeInTheDocument();
      });
    });

    it('应该显示加载状态', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      expect(screen.getByText(/加载中/)).toBeInTheDocument();
    });
  });

  describe('不应该包含营销内容', () => {
    it('不应该显示律师智能匹配功能', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.queryByText(/律师智能匹配/)).not.toBeInTheDocument();
      });
    });

    it('不应该显示虚假的用户评价', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalLawArticles: 1000,
          totalRelations: 500,
          relationCoverage: 0.85,
          lastSyncTime: '2026-02-02T10:00:00Z',
        }),
      });

      const InternalHomepage = (await import('@/app/internal-homepage'))
        .default;

      render(<InternalHomepage />);

      await waitFor(() => {
        expect(screen.queryByText(/testimonial/)).not.toBeInTheDocument();
        expect(screen.queryByText(/用户评价/)).not.toBeInTheDocument();
      });
    });
  });
});
