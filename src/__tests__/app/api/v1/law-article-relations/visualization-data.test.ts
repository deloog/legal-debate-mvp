/**
 * 知识图谱可视化数据API测试
 * 测试提供图表数据的API端点
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/law-article-relations/visualization-data/route';

// Override global prisma mock with specific implementations needed by the route
jest.mock('@/lib/db/prisma', () => {
  const mockLawArticleRelation = {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  const mockLawArticle = {
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  };
  const mock = {
    lawArticleRelation: mockLawArticleRelation,
    lawArticle: mockLawArticle,
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return { default: mock, prisma: mock };
});

const getPrisma = () => {
  const { prisma } = require('@/lib/db/prisma');
  return prisma;
};

// Total relations in our mock dataset: 7
// CITES: 3, COMPLETES: 2, CONFLICTS: 1, RELATED: 1
const TOTAL_RELATIONS = 7;

describe('知识图谱可视化数据API测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default groupBy mock for relationType
    getPrisma().lawArticleRelation.groupBy.mockImplementation(
      (args: { by: string[] }) => {
        if (args.by.includes('relationType')) {
          return Promise.resolve([
            { relationType: 'CITES', _count: { id: 3 } },
            { relationType: 'COMPLETES', _count: { id: 2 } },
            { relationType: 'CONFLICTS', _count: { id: 1 } },
            { relationType: 'RELATED', _count: { id: 1 } },
          ]);
        }
        if (args.by.includes('discoveryMethod')) {
          return Promise.resolve([
            { discoveryMethod: 'RULE_BASED', _count: { id: 3 } },
            { discoveryMethod: 'AI_DETECTED', _count: { id: 2 } },
            { discoveryMethod: 'MANUAL', _count: { id: 1 } },
            { discoveryMethod: 'CASE_DERIVED', _count: { id: 1 } },
          ]);
        }
        if (args.by.includes('sourceId')) {
          return Promise.resolve([
            { sourceId: 'art-1', _count: { id: 2 } },
            { sourceId: 'art-2', _count: { id: 2 } },
            { sourceId: 'art-3', _count: { id: 2 } },
            { sourceId: 'art-4', _count: { id: 1 } },
          ]);
        }
        if (args.by.includes('targetId')) {
          return Promise.resolve([
            { targetId: 'art-2', _count: { id: 1 } },
            { targetId: 'art-3', _count: { id: 1 } },
            { targetId: 'art-4', _count: { id: 2 } },
            { targetId: 'art-5', _count: { id: 2 } },
          ]);
        }
        return Promise.resolve([]);
      }
    );

    // Default findMany mock for confidence/strength distribution and trend
    getPrisma().lawArticleRelation.findMany.mockResolvedValue([
      {
        confidence: 0.98,
        strength: 0.95,
        createdAt: new Date(),
        verificationStatus: 'VERIFIED',
      },
      {
        confidence: 0.95,
        strength: 0.9,
        createdAt: new Date(),
        verificationStatus: 'VERIFIED',
      },
      {
        confidence: 0.9,
        strength: 0.85,
        createdAt: new Date(),
        verificationStatus: 'PENDING',
      },
      {
        confidence: 0.8,
        strength: 0.75,
        createdAt: new Date(),
        verificationStatus: 'VERIFIED',
      },
      {
        confidence: 0.75,
        strength: 0.7,
        createdAt: new Date(),
        verificationStatus: 'PENDING',
      },
      {
        confidence: 0.65,
        strength: 0.6,
        createdAt: new Date(),
        verificationStatus: 'REJECTED',
      },
      {
        confidence: 0.85,
        strength: 0.8,
        createdAt: new Date(),
        verificationStatus: 'VERIFIED',
      },
    ]);

    // Default count
    getPrisma().lawArticleRelation.count.mockResolvedValue(TOTAL_RELATIONS);

    // Default lawArticle findMany for topArticles
    getPrisma().lawArticle.findMany.mockResolvedValue([
      { id: 'art-1', lawName: '可视化测试法1', articleNumber: '1' },
      { id: 'art-2', lawName: '可视化测试法2', articleNumber: '2' },
      { id: 'art-3', lawName: '可视化测试法3', articleNumber: '3' },
      { id: 'art-4', lawName: '可视化测试法4', articleNumber: '4' },
      { id: 'art-5', lawName: '可视化测试法5', articleNumber: '5' },
    ]);
  });

  describe('关系类型分布数据', () => {
    it('应该返回关系类型分布统计', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=relationType',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.chartType).toBe('pie');
      expect(data.data.data).toBeDefined();
      expect(Array.isArray(data.data.data)).toBe(true);

      // 验证数据结构
      data.data.data.forEach(
        (item: { name: string; value: number; percentage: number }) => {
          expect(item.name).toBeDefined();
          expect(typeof item.value).toBe('number');
          expect(typeof item.percentage).toBe('number');
          expect(item.value).toBeGreaterThan(0);
        }
      );

      // 验证包含预期的关系类型
      const names = data.data.data.map((item: { name: string }) => item.name);
      expect(names).toContain('引用关系');
      expect(names).toContain('补全关系');
    });
  });

  describe('发现方式分布数据', () => {
    it('应该返回发现方式分布统计', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=discoveryMethod',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.chartType).toBe('pie');
      expect(Array.isArray(data.data.data)).toBe(true);

      // 验证包含预期的发现方式
      const names = data.data.data.map((item: { name: string }) => item.name);
      expect(names).toContain('规则匹配');
      expect(names).toContain('AI检测');
    });
  });

  describe('验证率趋势数据', () => {
    it('应该返回验证率趋势数据', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=verificationTrend&days=30',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.chartType).toBe('line');
      expect(Array.isArray(data.data.data)).toBe(true);

      // 验证数据结构
      data.data.data.forEach(
        (item: {
          date: string;
          verified: number;
          pending: number;
          rejected: number;
        }) => {
          expect(item.date).toBeDefined();
          expect(typeof item.verified).toBe('number');
          expect(typeof item.pending).toBe('number');
          expect(typeof item.rejected).toBe('number');
        }
      );
    });

    it('应该支持自定义天数范围', async () => {
      // For 7 days, return only items within that range
      getPrisma().lawArticleRelation.findMany.mockResolvedValue([
        {
          confidence: 0.9,
          strength: 0.85,
          createdAt: new Date(),
          verificationStatus: 'VERIFIED',
        },
        {
          confidence: 0.8,
          strength: 0.75,
          createdAt: new Date(),
          verificationStatus: 'PENDING',
        },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=verificationTrend&days=7',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data.length).toBeLessThanOrEqual(7);
    });
  });

  describe('置信度分布数据', () => {
    it('应该返回置信度分布统计', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=confidenceDistribution',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.chartType).toBe('bar');
      expect(Array.isArray(data.data.data)).toBe(true);

      // 验证数据结构
      data.data.data.forEach((item: { range: string; count: number }) => {
        expect(item.range).toBeDefined();
        expect(typeof item.count).toBe('number');
        expect(item.count).toBeGreaterThanOrEqual(0);
      });

      // 验证包含预期的置信度范围
      const ranges = data.data.data.map(
        (item: { range: string }) => item.range
      );
      expect(ranges.length).toBeGreaterThan(0);
    });
  });

  describe('强度分布数据', () => {
    it('应该返回强度分布统计', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=strengthDistribution',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.chartType).toBe('bar');
      expect(Array.isArray(data.data.data)).toBe(true);
    });
  });

  describe('热门法条数据', () => {
    it('应该返回热门法条统计', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=topArticles&limit=5',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.chartType).toBe('bar');
      expect(Array.isArray(data.data.data)).toBe(true);
      expect(data.data.data.length).toBeLessThanOrEqual(5);

      // 验证数据结构
      data.data.data.forEach(
        (item: {
          lawName: string;
          articleNumber: string;
          relationCount: number;
        }) => {
          expect(item.lawName).toBeDefined();
          expect(item.articleNumber).toBeDefined();
          expect(typeof item.relationCount).toBe('number');
          expect(item.relationCount).toBeGreaterThan(0);
        }
      );
    });

    it('应该支持自定义返回数量', async () => {
      // Limit groupBy results to 3 each
      getPrisma().lawArticleRelation.groupBy.mockImplementation(
        (args: { by: string[] }) => {
          if (args.by.includes('sourceId')) {
            return Promise.resolve([
              { sourceId: 'art-1', _count: { id: 2 } },
              { sourceId: 'art-2', _count: { id: 2 } },
              { sourceId: 'art-3', _count: { id: 1 } },
            ]);
          }
          if (args.by.includes('targetId')) {
            return Promise.resolve([
              { targetId: 'art-4', _count: { id: 2 } },
              { targetId: 'art-5', _count: { id: 1 } },
            ]);
          }
          return Promise.resolve([]);
        }
      );
      getPrisma().lawArticle.findMany.mockResolvedValue([
        { id: 'art-1', lawName: '可视化测试法1', articleNumber: '1' },
        { id: 'art-2', lawName: '可视化测试法2', articleNumber: '2' },
        { id: 'art-4', lawName: '可视化测试法4', articleNumber: '4' },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=topArticles&limit=3',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.data.length).toBeLessThanOrEqual(3);
    });
  });

  describe('参数验证', () => {
    it('应该验证type参数', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('type');
    });

    it('应该验证无效的type值', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=invalid',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('type');
    });

    it('应该验证days参数范围', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=verificationTrend&days=400',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('天数');
    });

    it('应该验证limit参数范围', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=topArticles&limit=0',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('数量');
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内返回可视化数据', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=relationType',
        { method: 'GET' }
      );

      const startTime = Date.now();
      const response = await GET(request);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // 应该在1秒内完成
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('数据一致性', () => {
    it('关系类型分布的总数应该等于总关系数', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=relationType',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      // 计算总数
      const totalFromChart = data.data.data.reduce(
        (sum: number, item: { value: number }) => sum + item.value,
        0
      );

      // The chart total should equal sum of all grouped counts (3+2+1+1=7)
      expect(totalFromChart).toBe(TOTAL_RELATIONS);
    });

    it('百分比总和应该等于100%', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/visualization-data?type=relationType',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      const totalPercentage = data.data.data.reduce(
        (sum: number, item: { percentage: number }) => sum + item.percentage,
        0
      );

      // 允许浮点数误差
      expect(Math.abs(totalPercentage - 100)).toBeLessThan(0.01);
    });
  });
});
