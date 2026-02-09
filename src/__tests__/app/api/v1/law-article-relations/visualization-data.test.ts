/**
 * 知识图谱可视化数据API测试
 * 测试提供图表数据的API端点
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/law-article-relations/visualization-data/route';
import { prisma } from '@/lib/db';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
  LawType,
  LawCategory,
  LawStatus,
} from '@prisma/client';
import type { LawArticle } from '@prisma/client';

describe('知识图谱可视化数据API测试', () => {
  const testArticles: LawArticle[] = [];

  beforeAll(async () => {
    // 创建测试法条
    for (let i = 1; i <= 5; i++) {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: `可视化测试法${i}`,
          articleNumber: `${i}`,
          fullText: `这是可视化测试法条${i}的内容`,
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: [],
          keywords: [],
          effectiveDate: new Date('2020-01-01'),
          status: LawStatus.VALID,
          issuingAuthority: '全国人大',
          relatedArticles: [],
          searchableText: `这是可视化测试法条${i}的内容`,
        },
      });
      testArticles.push(article);
    }

    // 创建不同类型的关系用于测试
    await prisma.lawArticleRelation.createMany({
      data: [
        // 引用关系 - 3个
        {
          sourceId: testArticles[0].id,
          targetId: testArticles[1].id,
          relationType: RelationType.CITES,
          strength: 0.95,
          confidence: 0.98,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedBy: 'admin-user',
          verifiedAt: new Date('2024-01-15'),
        },
        {
          sourceId: testArticles[1].id,
          targetId: testArticles[2].id,
          relationType: RelationType.CITES,
          strength: 0.9,
          confidence: 0.95,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedBy: 'admin-user',
          verifiedAt: new Date('2024-01-16'),
        },
        {
          sourceId: testArticles[2].id,
          targetId: testArticles[3].id,
          relationType: RelationType.CITES,
          strength: 0.85,
          confidence: 0.9,
          discoveryMethod: DiscoveryMethod.MANUAL,
          verificationStatus: VerificationStatus.PENDING,
        },
        // 补全关系 - 2个
        {
          sourceId: testArticles[1].id,
          targetId: testArticles[3].id,
          relationType: RelationType.COMPLETES,
          strength: 0.75,
          confidence: 0.8,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedBy: 'admin-user',
          verifiedAt: new Date('2024-01-20'),
        },
        {
          sourceId: testArticles[3].id,
          targetId: testArticles[4].id,
          relationType: RelationType.COMPLETES,
          strength: 0.7,
          confidence: 0.75,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
          verificationStatus: VerificationStatus.PENDING,
        },
        // 冲突关系 - 1个
        {
          sourceId: testArticles[2].id,
          targetId: testArticles[4].id,
          relationType: RelationType.CONFLICTS,
          strength: 0.6,
          confidence: 0.65,
          discoveryMethod: DiscoveryMethod.CASE_DERIVED,
          verificationStatus: VerificationStatus.REJECTED,
          verifiedBy: 'admin-user',
          verifiedAt: new Date('2024-01-25'),
        },
        // 一般关联 - 1个
        {
          sourceId: testArticles[0].id,
          targetId: testArticles[4].id,
          relationType: RelationType.RELATED,
          strength: 0.8,
          confidence: 0.85,
          discoveryMethod: DiscoveryMethod.MANUAL,
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedBy: 'admin-user',
          verifiedAt: new Date('2024-02-01'),
        },
      ],
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: { in: testArticles.map(a => a.id) } },
          { targetId: { in: testArticles.map(a => a.id) } },
        ],
      },
    });

    await prisma.lawArticle.deleteMany({
      where: {
        id: { in: testArticles.map(a => a.id) },
      },
    });
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

      // 查询实际总数
      const actualTotal = await prisma.lawArticleRelation.count({
        where: {
          OR: [
            { sourceId: { in: testArticles.map(a => a.id) } },
            { targetId: { in: testArticles.map(a => a.id) } },
          ],
        },
      });

      expect(totalFromChart).toBe(actualTotal);
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
