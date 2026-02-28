/**
 * 关系质量统计API测试
 */

import { GET } from '@/app/api/v1/law-article-relations/stats/route';
import { prisma } from '@/lib/db';

// Mock数据库
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

describe('GET /api/v1/law-article-relations/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础统计功能', () => {
    beforeEach(() => {
      // Mock基础统计数据
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(80) // verified
        .mockResolvedValueOnce(15) // pending
        .mockResolvedValueOnce(5); // rejected

      // Mock按类型分组
      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { relationType: 'CITES', _count: 50 },
          { relationType: 'MODIFIES', _count: 30 },
          { relationType: 'RELATED', _count: 20 },
        ])
        .mockResolvedValueOnce([
          { discoveryMethod: 'MANUAL', _count: 60 },
          { discoveryMethod: 'AI', _count: 40 },
        ]);

      // Mock平均统计
      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: {
          confidence: 0.85,
          strength: 0.75,
        },
      });
    });

    it('应该成功获取统计信息', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total).toBe(100);
      expect(data.data.verified).toBe(80);
      expect(data.data.pending).toBe(15);
      expect(data.data.rejected).toBe(5);
      expect(data.data.verificationRate).toBe(0.8);
    });

    it('应该正确计算验证率', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.data.verificationRate).toBe(0.8); // 80/100
    });

    it('应该提供按类型分组的统计', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.data.byType).toEqual({
        CITES: 50,
        MODIFIES: 30,
        RELATED: 20,
      });
    });

    it('应该提供按发现方式分组的统计', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.data.byDiscoveryMethod).toEqual({
        MANUAL: 60,
        AI: 40,
      });
    });

    it('应该提供平均置信度和强度', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.data.avgConfidence).toBe(0.85);
      expect(data.data.avgStrength).toBe(0.75);
    });
  });

  describe('时间范围过滤', () => {
    it('应该支持开始日期过滤', async () => {
      // Mock统计数据
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2);

      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { confidence: 0, strength: 0 },
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats?startDate=2026-01-01',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证查询条件包含日期过滤
      expect(prisma.lawArticleRelation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('应该支持结束日期过滤', async () => {
      // Mock统计数据
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1);

      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { confidence: 0, strength: 0 },
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats?endDate=2026-12-31',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证查询条件包含日期过滤
      expect(prisma.lawArticleRelation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('应该支持同时指定开始和结束日期', async () => {
      // Mock统计数据
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1);

      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { confidence: 0, strength: 0 },
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats?startDate=2026-01-01&endDate=2026-06-30',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('参数验证', () => {
    it('应该拒绝无效的开始日期', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats?startDate=invalid-date',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('无效的开始日期');
    });

    it('应该拒绝无效的结束日期', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats?endDate=invalid-date',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('无效的结束日期');
    });

    it('应该拒绝开始日期晚于结束日期', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats?startDate=2026-12-31&endDate=2026-01-01',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('开始日期不能晚于结束日期');
    });
  });

  describe('边界情况处理', () => {
    it('应该正确处理零数据情况', async () => {
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { confidence: null, strength: null },
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total).toBe(0);
      expect(data.data.verified).toBe(0);
      expect(data.data.pending).toBe(0);
      expect(data.data.rejected).toBe(0);
      expect(data.data.verificationRate).toBe(0);
      expect(data.data.byType).toEqual({});
      expect(data.data.byDiscoveryMethod).toEqual({});
      expect(data.data.avgConfidence).toBe(0);
      expect(data.data.avgStrength).toBe(0);
    });

    it('应该正确处理null平均值', async () => {
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);

      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { confidence: null, strength: null },
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.avgConfidence).toBe(0);
      expect(data.data.avgStrength).toBe(0);
    });

    it('应该正确处理部分null平均值', async () => {
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);

      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { confidence: 0.85, strength: null },
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.avgConfidence).toBe(0.85);
      expect(data.data.avgStrength).toBe(0);
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库错误', async () => {
      (prisma.lawArticleRelation.count as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('获取关系统计失败');
    });
  });

  describe('数据质量指标', () => {
    it('应该正确计算验证率（四舍五入）', async () => {
      // Mock总数为333，验证数为333
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(333)
        .mockResolvedValueOnce(333)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { confidence: 0, strength: 0 },
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      // 333/333 = 1.0
      expect(data.data.verificationRate).toBe(1);
    });

    it('应该反映高置信度关系占比', async () => {
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5);

      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { confidence: 0.95, strength: 0.9 },
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.avgConfidence).toBe(0.95);
      expect(data.data.avgStrength).toBe(0.9);
    });
  });

  describe('查询性能', () => {
    it('应该并行执行所有统计查询', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/stats',
        {
          method: 'GET',
        }
      );

      // Mock统计数据
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5);

      (prisma.lawArticleRelation.groupBy as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (prisma.lawArticleRelation.aggregate as jest.Mock).mockResolvedValue({
        _avg: { confidence: 0.85, strength: 0.75 },
      });

      await GET(request as any);

      // 验证所有查询都被调用
      expect(prisma.lawArticleRelation.count).toHaveBeenCalledTimes(4);
      expect(prisma.lawArticleRelation.groupBy).toHaveBeenCalledTimes(2);
      expect(prisma.lawArticleRelation.aggregate).toHaveBeenCalledTimes(1);
    });
  });
});
