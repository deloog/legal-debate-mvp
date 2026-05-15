/**
 * 关系质量统计API测试
 * 测试覆盖率目标：90%+
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/law-article-relations/stats/route';
import { prisma } from '@/lib/db';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
} from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(() =>
    Promise.resolve({
      userId: 'admin-user-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    })
  ),
}));

jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(() =>
    Promise.resolve({ hasPermission: true })
  ),
  KnowledgeGraphAction: {
    VIEW_STATS: 'view_stats',
  },
  KnowledgeGraphResource: {
    STATS: 'knowledge_graph_stats',
  },
}));

describe('GET /api/v1/law-article-relations/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('成功场景', () => {
    it('应该返回完整的关系质量统计', async () => {
      // Mock 总数
      jest
        .mocked(prisma.lawArticleRelation.count)
        .mockResolvedValueOnce(100) // 总数
        .mockResolvedValueOnce(80) // 已验证
        .mockResolvedValueOnce(15) // 待审核
        .mockResolvedValueOnce(5); // 已拒绝

      // Mock 按类型分组
      // @ts-expect-error - Prisma groupBy 类型循环引用问题
      jest.mocked(prisma.lawArticleRelation.groupBy).mockResolvedValueOnce([
        { relationType: RelationType.CITES, _count: 40 },
        { relationType: RelationType.COMPLETES, _count: 30 },
        { relationType: RelationType.RELATED, _count: 30 },
      ] as never);

      // Mock 按发现方式分组
      jest.mocked(prisma.lawArticleRelation.groupBy).mockResolvedValueOnce([
        { discoveryMethod: DiscoveryMethod.AI_DETECTED, _count: 50 },
        { discoveryMethod: DiscoveryMethod.RULE_BASED, _count: 30 },
        { discoveryMethod: DiscoveryMethod.MANUAL, _count: 20 },
      ] as never);

      // Mock 平均置信度和强度
      jest.mocked(prisma.lawArticleRelation.aggregate).mockResolvedValue({
        _avg: {
          confidence: 0.85,
          strength: 0.9,
        },
      } as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        total: 100,
        verified: 80,
        pending: 15,
        rejected: 5,
        verificationRate: 0.8,
        byType: {
          CITES: 40,
          COMPLETES: 30,
          RELATED: 30,
        },
        byDiscoveryMethod: {
          AI_DETECTED: 50,
          RULE_BASED: 30,
          MANUAL: 20,
        },
        avgConfidence: 0.85,
        avgStrength: 0.9,
      });
    });

    it('应该处理没有关系的情况', async () => {
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);
      jest.mocked(prisma.lawArticleRelation.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.aggregate).mockResolvedValue({
        _avg: {
          confidence: null,
          strength: null,
        },
      } as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total).toBe(0);
      expect(data.data.verificationRate).toBe(0);
      expect(data.data.avgConfidence).toBe(0);
      expect(data.data.avgStrength).toBe(0);
    });

    it('应该正确计算验证率', async () => {
      jest
        .mocked(prisma.lawArticleRelation.count)
        .mockResolvedValueOnce(50) // 总数
        .mockResolvedValueOnce(40) // 已验证
        .mockResolvedValueOnce(5) // 待审核
        .mockResolvedValueOnce(5); // 已拒绝

      jest.mocked(prisma.lawArticleRelation.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.aggregate).mockResolvedValue({
        _avg: { confidence: 0.8, strength: 0.85 },
      } as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.verificationRate).toBe(0.8); // 40/50
    });

    it('应该支持按时间范围过滤', async () => {
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(10);
      jest.mocked(prisma.lawArticleRelation.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.aggregate).mockResolvedValue({
        _avg: { confidence: 0.9, strength: 0.95 },
      } as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats?startDate=2026-01-01&endDate=2026-01-31'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.lawArticleRelation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });
  });

  describe('参数验证', () => {
    it('应该拒绝无效的开始日期', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats?startDate=invalid'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('无效的开始日期');
    });

    it('应该拒绝无效的结束日期', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats?endDate=invalid'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('无效的结束日期');
    });

    it('应该拒绝开始日期晚于结束日期', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats?startDate=2026-02-01&endDate=2026-01-01'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('开始日期不能晚于结束日期');
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库查询错误', async () => {
      jest
        .mocked(prisma.lawArticleRelation.count)
        .mockRejectedValue(new Error('数据库连接失败'));

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('获取关系统计失败');
    });

    it('应该处理分组查询错误', async () => {
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(100);
      jest
        .mocked(prisma.lawArticleRelation.groupBy)
        .mockRejectedValue(new Error('分组查询失败'));

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('应该处理聚合查询错误', async () => {
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(100);
      jest.mocked(prisma.lawArticleRelation.groupBy).mockResolvedValue([]);
      jest
        .mocked(prisma.lawArticleRelation.aggregate)
        .mockRejectedValue(new Error('聚合查询失败'));

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理所有关系都未验证的情况', async () => {
      jest
        .mocked(prisma.lawArticleRelation.count)
        .mockResolvedValueOnce(100) // 总数
        .mockResolvedValueOnce(0) // 已验证
        .mockResolvedValueOnce(100) // 待审核
        .mockResolvedValueOnce(0); // 已拒绝

      jest.mocked(prisma.lawArticleRelation.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.aggregate).mockResolvedValue({
        _avg: { confidence: 0.7, strength: 0.75 },
      } as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.verificationRate).toBe(0);
      expect(data.data.verified).toBe(0);
      expect(data.data.pending).toBe(100);
    });

    it('应该处理所有关系都已验证的情况', async () => {
      jest
        .mocked(prisma.lawArticleRelation.count)
        .mockResolvedValueOnce(100) // 总数
        .mockResolvedValueOnce(100) // 已验证
        .mockResolvedValueOnce(0) // 待审核
        .mockResolvedValueOnce(0); // 已拒绝

      jest.mocked(prisma.lawArticleRelation.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.aggregate).mockResolvedValue({
        _avg: { confidence: 0.95, strength: 0.98 },
      } as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.verificationRate).toBe(1);
      expect(data.data.verified).toBe(100);
      expect(data.data.pending).toBe(0);
    });

    it('应该处理平均值为null的情况', async () => {
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(10);
      jest.mocked(prisma.lawArticleRelation.groupBy).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.aggregate).mockResolvedValue({
        _avg: {
          confidence: null,
          strength: null,
        },
      } as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.avgConfidence).toBe(0);
      expect(data.data.avgStrength).toBe(0);
    });
  });
});
