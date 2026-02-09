/**
 * 关系验证API测试
 * 测试关系验证和删除的API端点
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST, DELETE } from '@/app/api/v1/law-article-relations/[id]/route';
import { prisma } from '@/lib/db/prisma';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
  LawType,
  LawCategory,
  LawStatus,
} from '@prisma/client';
import type { LawArticle, LawArticleRelation } from '@prisma/client';

describe('关系验证API', () => {
  let testArticle1: LawArticle;
  let testArticle2: LawArticle;
  let testRelation: LawArticleRelation;

  beforeAll(async () => {
    // 创建测试法条
    testArticle1 = await prisma.lawArticle.create({
      data: {
        lawName: 'API验证测试法A',
        articleNumber: '1',
        fullText: '这是API验证测试法条A的内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        tags: [],
        keywords: [],
        effectiveDate: new Date('2020-01-01'),
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        relatedArticles: [],
        searchableText: '这是API验证测试法条A的内容',
      },
    });

    testArticle2 = await prisma.lawArticle.create({
      data: {
        lawName: 'API验证测试法B',
        articleNumber: '2',
        fullText: '这是API验证测试法条B的内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        tags: [],
        keywords: [],
        effectiveDate: new Date('2020-01-01'),
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        relatedArticles: [],
        searchableText: '这是API验证测试法条B的内容',
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

  beforeEach(async () => {
    // 创建测试关系
    testRelation = await prisma.lawArticleRelation.create({
      data: {
        sourceId: testArticle1.id,
        targetId: testArticle2.id,
        relationType: RelationType.CITES,
        strength: 0.9,
        confidence: 0.95,
        discoveryMethod: DiscoveryMethod.RULE_BASED,
        verificationStatus: VerificationStatus.PENDING,
      },
    });
  });

  afterEach(async () => {
    // 清理测试关系
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: { in: [testArticle1.id, testArticle2.id] } },
          { targetId: { in: [testArticle1.id, testArticle2.id] } },
        ],
      },
    });
  });

  describe('POST /api/v1/law-article-relations/[id]', () => {
    it('应该成功验证通过关系', async () => {
      const requestBody = {
        verifiedBy: 'admin-user-id',
        isApproved: true,
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verificationStatus).toBe(VerificationStatus.VERIFIED);
      expect(data.verifiedBy).toBe('admin-user-id');
      expect(data.verifiedAt).toBeDefined();
    });

    it('应该成功拒绝关系', async () => {
      const requestBody = {
        verifiedBy: 'admin-user-id',
        isApproved: false,
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verificationStatus).toBe(VerificationStatus.REJECTED);
      expect(data.verifiedBy).toBe('admin-user-id');
    });

    it('应该处理缺少必需字段的请求', async () => {
      const requestBody = {
        // 缺少 verifiedBy 和 isApproved
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });

      expect(response.status).toBe(400);
    });

    it('应该处理不存在的关系ID', async () => {
      const requestBody = {
        verifiedBy: 'admin-user-id',
        isApproved: true,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/non-existent-id',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request, {
        params: { id: 'non-existent-id' },
      });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/law-article-relations/[id]', () => {
    it('应该成功删除关系', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: { id: testRelation.id },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('成功删除');

      // 验证关系已被删除
      const deletedRelation = await prisma.lawArticleRelation.findUnique({
        where: { id: testRelation.id },
      });
      expect(deletedRelation).toBeNull();
    });

    it('应该处理不存在的关系ID', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/non-existent-id',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: { id: 'non-existent-id' },
      });

      expect(response.status).toBe(400);
    });
  });
});
