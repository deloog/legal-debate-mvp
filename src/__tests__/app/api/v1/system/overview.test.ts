/**
 * 系统概览API测试
 *
 * 测试覆盖：
 * - 正常返回系统概览数据
 * - 空数据处理
 * - 错误处理
 */

import { GET } from '@/app/api/v1/system/overview/route';
import { prisma } from '@/lib/db';
import { VerificationStatus } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    lawArticleRelation: {
      count: jest.fn(),
    },
  },
}));

describe('GET /api/v1/system/overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常情况', () => {
    it('应该返回系统概览数据', async () => {
      // Mock数据 - 注意顺序很重要
      (prisma.lawArticle.count as jest.Mock)
        .mockResolvedValueOnce(1000) // 总法条数
        .mockResolvedValueOnce(800); // 有关系的法条数
      (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(500);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        totalLawArticles: 1000,
        totalRelations: 500,
        relationCoverage: 0.8,
        lastSyncTime: '2024-01-01T00:00:00.000Z',
      });
    });

    it('应该正确计算关系覆盖率', async () => {
      (prisma.lawArticle.count as jest.Mock)
        .mockResolvedValueOnce(100) // 总法条数
        .mockResolvedValueOnce(50); // 有关系的法条数
      (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(30);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(),
      });

      const response = await GET();
      const data = await response.json();

      expect(data.relationCoverage).toBe(0.5);
    });

    it('当没有法条时关系覆盖率应该为0', async () => {
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(0);
      (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(0);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(data.relationCoverage).toBe(0);
    });

    it('应该只统计已验证的关系', async () => {
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(100);
      (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(80);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValueOnce(60);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(),
      });

      const response = await GET();
      const data = await response.json();

      expect(prisma.lawArticleRelation.count).toHaveBeenCalledWith({
        where: {
          verificationStatus: VerificationStatus.VERIFIED,
        },
      });
      expect(data.totalRelations).toBe(80);
    });

    it('当没有最新法条时应该使用当前时间', async () => {
      const now = new Date();
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(100);
      (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(50);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValueOnce(80);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(data.lastSyncTime).toBeTruthy();
      const syncTime = new Date(data.lastSyncTime);
      const timeDiff = Math.abs(syncTime.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(1000); // 1秒内
    });
  });

  describe('错误处理', () => {
    it('数据库错误时应该返回500', async () => {
      (prisma.lawArticle.count as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: '服务器错误',
      });
    });

    it('统计关系数时出错应该返回500', async () => {
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(100);
      (prisma.lawArticleRelation.count as jest.Mock).mockRejectedValue(
        new Error('查询失败')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器错误');
    });

    it('查询最新法条时出错应该返回500', async () => {
      (prisma.lawArticle.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);
      (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(50);
      (prisma.lawArticle.findFirst as jest.Mock).mockRejectedValue(
        new Error('查询失败')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器错误');
    });
  });

  describe('边界情况', () => {
    it('应该处理大规模数据', async () => {
      (prisma.lawArticle.count as jest.Mock)
        .mockResolvedValueOnce(1000000) // 总法条数
        .mockResolvedValueOnce(800000); // 有关系的法条数
      (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(500000);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalLawArticles).toBe(1000000);
      expect(data.totalRelations).toBe(500000);
      expect(data.relationCoverage).toBe(0.8);
    });

    it('应该处理关系覆盖率为100%的情况', async () => {
      (prisma.lawArticle.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100);
      (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(200);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(),
      });

      const response = await GET();
      const data = await response.json();

      expect(data.relationCoverage).toBe(1);
    });

    it('应该处理关系覆盖率为0%的情况', async () => {
      (prisma.lawArticle.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(0);
      (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(0);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(),
      });

      const response = await GET();
      const data = await response.json();

      expect(data.relationCoverage).toBe(0);
    });
  });
});
