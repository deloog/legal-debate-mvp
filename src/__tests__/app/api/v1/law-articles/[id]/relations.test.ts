/**
 * 关系管理API测试
 * 测试法条关系的API端点
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/v1/law-articles/[id]/relations/route';
import { prisma } from '@/lib/db/prisma';
import {
  RelationType,
  DiscoveryMethod,
  LawType,
  LawCategory,
  LawStatus,
} from '@prisma/client';
import type { LawArticle } from '@prisma/client';

describe('关系管理API', () => {
  let testArticle1: LawArticle;
  let testArticle2: LawArticle;

  beforeAll(async () => {
    // 创建测试法条
    testArticle1 = await prisma.lawArticle.create({
      data: {
        lawName: 'API测试法A',
        articleNumber: '1',
        fullText: '这是API测试法条A的内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        tags: [],
        keywords: [],
        effectiveDate: new Date('2020-01-01'),
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        relatedArticles: [],
        searchableText: '这是API测试法条A的内容',
      },
    });

    testArticle2 = await prisma.lawArticle.create({
      data: {
        lawName: 'API测试法B',
        articleNumber: '2',
        fullText: '这是API测试法条B的内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        tags: [],
        keywords: [],
        effectiveDate: new Date('2020-01-01'),
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        relatedArticles: [],
        searchableText: '这是API测试法条B的内容',
      },
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: { in: [testArticle1.id, testArticle2.id] } },
          { targetId: { in: [testArticle1.id, testArticle2.id] } },
        ],
      },
    });
    await prisma.lawArticle.deleteMany({
      where: {
        id: { in: [testArticle1.id, testArticle2.id] },
      },
    });
  });

  afterEach(async () => {
    // 每个测试后清理关系
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: { in: [testArticle1.id, testArticle2.id] } },
          { targetId: { in: [testArticle1.id, testArticle2.id] } },
        ],
      },
    });
  });

  describe('GET /api/v1/law-articles/[id]/relations', () => {
    beforeEach(async () => {
      // 创建测试关系
      await prisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: testArticle1.id,
            targetId: testArticle2.id,
            relationType: RelationType.CITES,
            strength: 0.9,
            confidence: 0.95,
            discoveryMethod: DiscoveryMethod.RULE_BASED,
          },
          {
            sourceId: testArticle2.id,
            targetId: testArticle1.id,
            relationType: RelationType.RELATED,
            strength: 0.7,
            confidence: 0.8,
            discoveryMethod: DiscoveryMethod.MANUAL,
          },
        ],
      });
    });

    it('应该成功获取法条的所有关系', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-articles/${testArticle1.id}/relations`
      );

      const response = await GET(request, { params: { id: testArticle1.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.articleId).toBe(testArticle1.id);
      expect(data.totalRelations).toBe(2);
      expect(data.outgoingRelations).toHaveLength(1);
      expect(data.incomingRelations).toHaveLength(1);
    });

    it('应该支持按关系类型过滤', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-articles/${testArticle1.id}/relations?relationType=CITES`
      );

      const response = await GET(request, { params: { id: testArticle1.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outgoingRelations).toHaveLength(1);
      expect(data.outgoingRelations[0].relationType).toBe(RelationType.CITES);
    });

    it('应该支持按方向过滤', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-articles/${testArticle1.id}/relations?direction=outgoing`
      );

      const response = await GET(request, { params: { id: testArticle1.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outgoingRelations).toHaveLength(1);
      expect(data.incomingRelations).toHaveLength(0);
    });

    it('应该支持按最小强度过滤', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-articles/${testArticle1.id}/relations?minStrength=0.8`
      );

      const response = await GET(request, { params: { id: testArticle1.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outgoingRelations).toHaveLength(1);
      expect(data.outgoingRelations[0].strength).toBeGreaterThanOrEqual(0.8);
    });

    it('应该处理不存在的法条ID', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/non-existent-id/relations'
      );

      const response = await GET(request, {
        params: { id: 'non-existent-id' },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalRelations).toBe(0);
    });
  });

  describe('POST /api/v1/law-articles/[id]/relations', () => {
    it('应该成功创建关系', async () => {
      const requestBody = {
        targetId: testArticle2.id,
        relationType: RelationType.CITES,
        confidence: 0.95,
        strength: 0.9,
        description: 'API测试创建的关系',
        discoveryMethod: DiscoveryMethod.MANUAL,
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-articles/${testArticle1.id}/relations`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request, { params: { id: testArticle1.id } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.sourceId).toBe(testArticle1.id);
      expect(data.targetId).toBe(testArticle2.id);
      expect(data.relationType).toBe(RelationType.CITES);
      expect(data.confidence).toBe(0.95);
    });

    it('应该拒绝自引用关系', async () => {
      const requestBody = {
        targetId: testArticle1.id,
        relationType: RelationType.CITES,
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-articles/${testArticle1.id}/relations`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request, { params: { id: testArticle1.id } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('禁止自引用');
    });

    it('应该拒绝不存在的目标法条', async () => {
      const requestBody = {
        targetId: 'non-existent-id',
        relationType: RelationType.CITES,
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-articles/${testArticle1.id}/relations`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request, { params: { id: testArticle1.id } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('目标法条不存在');
    });

    it('应该处理缺少必需字段的请求', async () => {
      const requestBody = {
        targetId: testArticle2.id,
        // 缺少 relationType
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-articles/${testArticle1.id}/relations`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request, { params: { id: testArticle1.id } });

      expect(response.status).toBe(400);
    });

    it('应该支持创建带证据的关系', async () => {
      const requestBody = {
        targetId: testArticle2.id,
        relationType: RelationType.CITES,
        evidence: {
          text: '根据《API测试法B》第2条',
          position: 10,
        },
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-articles/${testArticle1.id}/relations`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request, { params: { id: testArticle1.id } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.evidence).toEqual(requestBody.evidence);
    });
  });
});
