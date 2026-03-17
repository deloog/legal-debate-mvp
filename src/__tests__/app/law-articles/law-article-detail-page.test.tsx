/**
 * 法条详情页测试
 * 测试法条详情页的各项功能，包括基本信息展示、关系图谱、推荐法条等
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock Next.js相关模块
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
  })),
}));

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

// Mock 可视化组件（避免d3模块问题）
jest.mock('@/components/law-article/LawArticleGraphVisualization', () => ({
  LawArticleGraphVisualization: ({
    centerArticleId,
  }: {
    centerArticleId: string;
  }) => (
    <div data-testid='graph-visualization'>关系图谱 - {centerArticleId}</div>
  ),
}));

// Mock 反馈按钮组件（避免复杂依赖）
jest.mock('@/components/feedback/RecommendationFeedbackButton', () => ({
  RecommendationFeedbackButton: () => <div data-testid='feedback-button' />,
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// 静态测试数据（不需要真实DB）
const TEST_ARTICLE_ID = 'test-article-id-001';
const RELATED_ARTICLE_ID = 'test-related-article-id-002';

describe('法条详情页', () => {
  beforeEach(() => {
    // 重置mock
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('基本信息展示', () => {
    it('应该正确显示法条基本信息', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: TEST_ARTICLE_ID });

      // Mock所有API调用
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/recommendations')) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              articleId: TEST_ARTICLE_ID,
              totalRelations: 0,
              relationsByType: {},
              recommendationScore: 0,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: TEST_ARTICLE_ID,
            lawName: '民法典',
            articleNumber: '1',
            fullText: '为了保护民事主体的合法权益',
            category: 'CIVIL',
            effectiveDate: '2021-01-01',
            issuingAuthority: '全国人民代表大会',
          }),
        });
      });

      // 动态导入页面组件
      const LawArticleDetailPage = (
        await import('@/app/law-articles/[id]/page')
      ).default;

      render(<LawArticleDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('民法典')).toBeInTheDocument();
        expect(screen.getByText(/第1条/)).toBeInTheDocument();
      });
    });

    it('应该显示法条分类和生效日期', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: TEST_ARTICLE_ID });

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/recommendations')) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              articleId: TEST_ARTICLE_ID,
              totalRelations: 0,
              relationsByType: {},
              recommendationScore: 0,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: TEST_ARTICLE_ID,
            lawName: '民法典',
            articleNumber: '1',
            category: 'CIVIL',
            effectiveDate: '2021-01-01',
            fullText: '为了保护民事主体的合法权益',
          }),
        });
      });

      const LawArticleDetailPage = (
        await import('@/app/law-articles/[id]/page')
      ).default;

      render(<LawArticleDetailPage />);

      await waitFor(() => {
        expect(screen.getAllByText(/民事/)[0]).toBeInTheDocument();
        expect(screen.getAllByText(/2021/)[0]).toBeInTheDocument();
      });
    });
  });

  describe('关系图谱展示', () => {
    it('应该加载并显示关系图谱', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: TEST_ARTICLE_ID });

      // Mock所有API调用
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/recommendations')) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              articleId: TEST_ARTICLE_ID,
              totalRelations: 1,
              relationsByType: { RELATED: 1 },
              recommendationScore: 0.85,
            }),
          });
        }
        // 法条详情API
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: TEST_ARTICLE_ID,
            lawName: '民法典',
            articleNumber: '1',
            fullText: '为了保护民事主体的合法权益',
            category: 'CIVIL',
            effectiveDate: '2021-01-01',
            issuingAuthority: '全国人民代表大会',
          }),
        });
      });

      const LawArticleDetailPage = (
        await import('@/app/law-articles/[id]/page')
      ).default;

      render(<LawArticleDetailPage />);

      await waitFor(
        () => {
          expect(screen.getByTestId('graph-visualization')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('应该显示关系统计信息', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: TEST_ARTICLE_ID });

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/recommendations')) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              articleId: TEST_ARTICLE_ID,
              totalRelations: 1,
              relationsByType: { RELATED: 1 },
              recommendationScore: 0.85,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: TEST_ARTICLE_ID,
            lawName: '民法典',
            articleNumber: '1',
            fullText: '为了保护民事主体的合法权益',
            category: 'CIVIL',
            effectiveDate: '2021-01-01',
          }),
        });
      });

      const LawArticleDetailPage = (
        await import('@/app/law-articles/[id]/page')
      ).default;

      render(<LawArticleDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/关系统计/)).toBeInTheDocument();
        expect(screen.getByText(/总关系数/)).toBeInTheDocument();
        expect(screen.getByText(/85%/)).toBeInTheDocument();
      });
    });
  });

  describe('推荐法条展示', () => {
    it('应该显示推荐的相关法条', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: TEST_ARTICLE_ID });

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/recommendations')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                article: {
                  id: RELATED_ARTICLE_ID,
                  lawName: '民法典',
                  articleNumber: '2',
                  fullText: '民法调整平等主体',
                },
                score: 0.9,
                reason: '该法条与此法条相关',
                relationType: 'RELATED',
              },
            ],
          });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              articleId: TEST_ARTICLE_ID,
              totalRelations: 1,
              relationsByType: { RELATED: 1 },
              recommendationScore: 0.85,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: TEST_ARTICLE_ID,
            lawName: '民法典',
            articleNumber: '1',
            fullText: '为了保护民事主体的合法权益',
            category: 'CIVIL',
            effectiveDate: '2021-01-01',
          }),
        });
      });

      const LawArticleDetailPage = (
        await import('@/app/law-articles/[id]/page')
      ).default;

      render(<LawArticleDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/推荐法条/)).toBeInTheDocument();
        expect(screen.getByText(/第2条/)).toBeInTheDocument();
      });
    });

    it('应该显示推荐原因和相关性分数', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: TEST_ARTICLE_ID });

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/recommendations')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                article: {
                  id: RELATED_ARTICLE_ID,
                  lawName: '民法典',
                  articleNumber: '2',
                  fullText: '民法调整平等主体',
                },
                score: 0.9,
                reason: '该法条与此法条相关',
              },
            ],
          });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              articleId: TEST_ARTICLE_ID,
              totalRelations: 1,
              relationsByType: {},
              recommendationScore: 0.85,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: TEST_ARTICLE_ID,
            lawName: '民法典',
            articleNumber: '1',
            fullText: '为了保护民事主体的合法权益',
            category: 'CIVIL',
          }),
        });
      });

      const LawArticleDetailPage = (
        await import('@/app/law-articles/[id]/page')
      ).default;

      render(<LawArticleDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/相关性/)).toBeInTheDocument();
        expect(screen.getByText(/90%/)).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理法条不存在的情况', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: 'non-existent-id' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: '法条不存在' }),
      });

      const LawArticleDetailPage = (
        await import('@/app/law-articles/[id]/page')
      ).default;

      render(<LawArticleDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/法条不存在/)).toBeInTheDocument();
      });
    });

    it('应该处理网络错误', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: TEST_ARTICLE_ID });

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const LawArticleDetailPage = (
        await import('@/app/law-articles/[id]/page')
      ).default;

      render(<LawArticleDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/加载失败/)).toBeInTheDocument();
      });
    });

    it('应该显示加载状态', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: TEST_ARTICLE_ID });

      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const LawArticleDetailPage = (
        await import('@/app/law-articles/[id]/page')
      ).default;

      render(<LawArticleDetailPage />);

      expect(screen.getByText(/加载中/)).toBeInTheDocument();
    });
  });
});
