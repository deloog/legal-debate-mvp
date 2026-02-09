/**
 * 法条详情页测试
 * 测试法条详情页的各项功能，包括基本信息展示、关系图谱、推荐法条等
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { prisma } from '@/lib/db';
import { RelationType, VerificationStatus } from '@prisma/client';

// Mock Next.js相关模块
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
  })),
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

// Mock fetch
global.fetch = jest.fn();

describe('法条详情页', () => {
  let testArticleId: string;
  let relatedArticleId: string;

  beforeAll(async () => {
    // 创建测试法条
    const article = await prisma.lawArticle.create({
      data: {
        lawName: '民法典',
        articleNumber: '1',
        fullText:
          '为了保护民事主体的合法权益，调整民事关系，维护社会和经济秩序，适应中国特色社会主义发展要求，弘扬社会主义核心价值观，根据宪法，制定本法。',
        lawType: 'LAW',
        category: 'CIVIL',
        keywords: ['民事主体', '合法权益', '民事关系'],
        tags: ['总则', '基本原则'],
        effectiveDate: new Date('2021-01-01'),
        issuingAuthority: '全国人民代表大会',
        searchableText: '为了保护民事主体的合法权益',
      },
    });
    testArticleId = article.id;

    // 创建相关法条
    const relatedArticle = await prisma.lawArticle.create({
      data: {
        lawName: '民法典',
        articleNumber: '2',
        fullText:
          '民法调整平等主体的自然人、法人和非法人组织之间的人身关系和财产关系。',
        lawType: 'LAW',
        category: 'CIVIL',
        keywords: ['平等主体', '自然人', '法人'],
        tags: ['总则', '调整范围'],
        effectiveDate: new Date('2021-01-01'),
        issuingAuthority: '全国人民代表大会',
        searchableText: '民法调整平等主体',
      },
    });
    relatedArticleId = relatedArticle.id;

    // 创建关系
    await prisma.lawArticleRelation.create({
      data: {
        sourceId: testArticleId,
        targetId: relatedArticleId,
        relationType: RelationType.RELATED,
        strength: 0.9,
        confidence: 0.95,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [{ sourceId: testArticleId }, { targetId: testArticleId }],
      },
    });
    await prisma.lawArticle.deleteMany({
      where: {
        id: { in: [testArticleId, relatedArticleId] },
      },
    });
  });

  beforeEach(() => {
    // 重置mock
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('基本信息展示', () => {
    it('应该正确显示法条基本信息', async () => {
      const { useParams } = require('next/navigation');
      useParams.mockReturnValue({ id: testArticleId });

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
              articleId: testArticleId,
              totalRelations: 0,
              relationsByType: {},
              recommendationScore: 0,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: testArticleId,
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
      useParams.mockReturnValue({ id: testArticleId });

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
              articleId: testArticleId,
              totalRelations: 0,
              relationsByType: {},
              recommendationScore: 0,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: testArticleId,
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
      useParams.mockReturnValue({ id: testArticleId });

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
              articleId: testArticleId,
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
            id: testArticleId,
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
      useParams.mockReturnValue({ id: testArticleId });

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
              articleId: testArticleId,
              totalRelations: 1,
              relationsByType: { RELATED: 1 },
              recommendationScore: 0.85,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: testArticleId,
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
      useParams.mockReturnValue({ id: testArticleId });

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/recommendations')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                article: {
                  id: relatedArticleId,
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
              articleId: testArticleId,
              totalRelations: 1,
              relationsByType: { RELATED: 1 },
              recommendationScore: 0.85,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: testArticleId,
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
      useParams.mockReturnValue({ id: testArticleId });

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/recommendations')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                article: {
                  id: relatedArticleId,
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
              articleId: testArticleId,
              totalRelations: 1,
              relationsByType: {},
              recommendationScore: 0.85,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: testArticleId,
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
      useParams.mockReturnValue({ id: testArticleId });

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
      useParams.mockReturnValue({ id: testArticleId });

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
