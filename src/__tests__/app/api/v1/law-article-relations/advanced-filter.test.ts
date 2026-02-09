/**
 * 高级过滤API测试
 * 测试法条关系的高级过滤功能
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/law-article-relations/advanced-filter/route';
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

describe('高级过滤API测试', () => {
  const testArticles: LawArticle[] = [];

  beforeAll(async () => {
    // 创建测试法条
    for (let i = 1; i <= 5; i++) {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: `高级过滤测试法${i}`,
          articleNumber: `${i}`,
          fullText: `这是高级过滤测试法条${i}的内容`,
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: [],
          keywords: [],
          effectiveDate: new Date('2020-01-01'),
          status: LawStatus.VALID,
          issuingAuthority: '全国人大',
          relatedArticles: [],
          searchableText: `这是高级过滤测试法条${i}的内容`,
        },
      });
      testArticles.push(article);
    }

    // 创建不同类型的关系用于测试
    await prisma.lawArticleRelation.createMany({
      data: [
        // 引用关系，高置信度，已验证
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
        // 补全关系，中等置信度，待审核
        {
          sourceId: testArticles[1].id,
          targetId: testArticles[2].id,
          relationType: RelationType.COMPLETES,
          strength: 0.75,
          confidence: 0.8,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
          verificationStatus: VerificationStatus.PENDING,
        },
        // 冲突关系，低置信度，已拒绝
        {
          sourceId: testArticles[2].id,
          targetId: testArticles[3].id,
          relationType: RelationType.CONFLICTS,
          strength: 0.6,
          confidence: 0.65,
          discoveryMethod: DiscoveryMethod.CASE_DERIVED,
          verificationStatus: VerificationStatus.REJECTED,
          verifiedBy: 'admin-user',
          verifiedAt: new Date('2024-01-20'),
        },
        // 一般关联，高置信度，已验证
        {
          sourceId: testArticles[3].id,
          targetId: testArticles[4].id,
          relationType: RelationType.RELATED,
          strength: 0.85,
          confidence: 0.9,
          discoveryMethod: DiscoveryMethod.MANUAL,
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedBy: 'admin-user',
          verifiedAt: new Date('2024-02-01'),
        },
        // 替代关系，中等置信度，待审核
        {
          sourceId: testArticles[4].id,
          targetId: testArticles[0].id,
          relationType: RelationType.SUPERSEDES,
          strength: 0.7,
          confidence: 0.75,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
          verificationStatus: VerificationStatus.PENDING,
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

  describe('按关系类型过滤', () => {
    it('应该按单个关系类型过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?relationType=CITES',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations.length).toBeGreaterThan(0);
      data.data.relations.forEach((relation: { relationType: string }) => {
        expect(relation.relationType).toBe('CITES');
      });
    });

    it('应该按多个关系类型过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?relationType=CITES,COMPLETES',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { relationType: string }) => {
        expect(['CITES', 'COMPLETES']).toContain(relation.relationType);
      });
    });
  });

  describe('按发现方式过滤', () => {
    it('应该按发现方式过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?discoveryMethod=AI_DETECTED',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { discoveryMethod: string }) => {
        expect(relation.discoveryMethod).toBe('AI_DETECTED');
      });
    });
  });

  describe('按置信度范围过滤', () => {
    it('应该按最小置信度过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minConfidence=0.85',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { confidence: number }) => {
        expect(relation.confidence).toBeGreaterThanOrEqual(0.85);
      });
    });

    it('应该按最大置信度过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?maxConfidence=0.80',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { confidence: number }) => {
        expect(relation.confidence).toBeLessThanOrEqual(0.8);
      });
    });

    it('应该按置信度范围过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minConfidence=0.70&maxConfidence=0.90',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { confidence: number }) => {
        expect(relation.confidence).toBeGreaterThanOrEqual(0.7);
        expect(relation.confidence).toBeLessThanOrEqual(0.9);
      });
    });
  });

  describe('按强度范围过滤', () => {
    it('应该按最小强度过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minStrength=0.80',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { strength: number }) => {
        expect(relation.strength).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('应该按强度范围过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minStrength=0.60&maxStrength=0.85',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach((relation: { strength: number }) => {
        expect(relation.strength).toBeGreaterThanOrEqual(0.6);
        expect(relation.strength).toBeLessThanOrEqual(0.85);
      });
    });
  });

  describe('按审核状态过滤', () => {
    it('应该按审核状态过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?verificationStatus=VERIFIED',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach(
        (relation: { verificationStatus: string }) => {
          expect(relation.verificationStatus).toBe('VERIFIED');
        }
      );
    });
  });

  describe('按法条名称搜索', () => {
    it('应该按源法条名称搜索', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/advanced-filter?sourceLawName=${encodeURIComponent('高级过滤测试法1')}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations.length).toBeGreaterThan(0);
    });

    it('应该按目标法条名称搜索', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/advanced-filter?targetLawName=${encodeURIComponent('高级过滤测试法2')}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations.length).toBeGreaterThan(0);
    });
  });

  describe('按时间范围过滤', () => {
    it('应该按创建时间范围过滤', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/advanced-filter?startDate=${startDate}&endDate=${endDate}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('组合过滤', () => {
    it('应该支持多个条件组合过滤', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?relationType=CITES,RELATED&minConfidence=0.85&verificationStatus=VERIFIED',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.relations.forEach(
        (relation: {
          relationType: string;
          confidence: number;
          verificationStatus: string;
        }) => {
          expect(['CITES', 'RELATED']).toContain(relation.relationType);
          expect(relation.confidence).toBeGreaterThanOrEqual(0.85);
          expect(relation.verificationStatus).toBe('VERIFIED');
        }
      );
    });
  });

  describe('分页和排序', () => {
    it('应该支持分页', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?page=1&pageSize=2',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations.length).toBeLessThanOrEqual(2);
      expect(data.data.pagination).toBeDefined();
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.pageSize).toBe(2);
    });

    it('应该支持按置信度排序', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?sortBy=confidence&sortOrder=desc',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证排序
      const confidences = data.data.relations.map(
        (r: { confidence: number }) => r.confidence
      );
      for (let i = 1; i < confidences.length; i++) {
        expect(confidences[i - 1]).toBeGreaterThanOrEqual(confidences[i]);
      }
    });

    it('应该支持按创建时间排序', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?sortBy=createdAt&sortOrder=asc',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('参数验证', () => {
    it('应该验证置信度范围', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minConfidence=1.5',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('置信度');
    });

    it('应该验证强度范围', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?minStrength=-0.1',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('强度');
    });

    it('应该验证分页参数', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?page=0',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('页码');
    });

    it('应该限制每页最大数量', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?pageSize=200',
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('每页');
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成复杂查询', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/advanced-filter?relationType=CITES,COMPLETES,RELATED&minConfidence=0.60&maxConfidence=1.0&minStrength=0.50&maxStrength=1.0&verificationStatus=VERIFIED,PENDING&sortBy=confidence&sortOrder=desc&page=1&pageSize=20',
        { method: 'GET' }
      );

      const startTime = Date.now();
      const response = await GET(request);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // 复杂查询应该在2秒内完成
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });
});
