/**
 * 关系审核API权限测试
 * 测试权限控制和审核日志记录功能
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/law-article-relations/[id]/verify/route';
import { prisma } from '@/lib/db';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
  LawType,
  LawCategory,
  LawStatus,
  UserRole,
} from '@prisma/client';
import type { LawArticle, LawArticleRelation, User } from '@prisma/client';

describe('关系审核API权限测试', () => {
  let testArticle1: LawArticle;
  let testArticle2: LawArticle;
  let testRelation: LawArticleRelation;
  let adminUser: User;
  let normalUser: User;

  beforeAll(async () => {
    // 创建测试用户
    adminUser = await prisma.user.create({
      data: {
        email: 'admin-verify-test@test.com',
        role: UserRole.ADMIN,
        password: 'hashed-password',
      },
    });

    normalUser = await prisma.user.create({
      data: {
        email: 'user-verify-test@test.com',
        role: UserRole.USER,
        password: 'hashed-password',
      },
    });

    // 创建测试法条
    testArticle1 = await prisma.lawArticle.create({
      data: {
        lawName: 'API权限测试法A',
        articleNumber: '1',
        fullText: '这是API权限测试法条A的内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        tags: [],
        keywords: [],
        effectiveDate: new Date('2020-01-01'),
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        relatedArticles: [],
        searchableText: '这是API权限测试法条A的内容',
      },
    });

    testArticle2 = await prisma.lawArticle.create({
      data: {
        lawName: 'API权限测试法B',
        articleNumber: '2',
        fullText: '这是API权限测试法条B的内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        tags: [],
        keywords: [],
        effectiveDate: new Date('2020-01-01'),
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        relatedArticles: [],
        searchableText: '这是API权限测试法条B的内容',
      },
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.actionLog.deleteMany({
      where: {
        userId: { in: [adminUser.id, normalUser.id] },
      },
    });

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

    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUser.id, normalUser.id] },
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

    // 清理审核日志
    await prisma.actionLog.deleteMany({
      where: {
        userId: { in: [adminUser.id, normalUser.id] },
      },
    });
  });

  describe('权限检查', () => {
    it('应该允许管理员审核关系', async () => {
      const requestBody = {
        approved: true,
        verifiedBy: adminUser.id,
        note: '关系准确',
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.verificationStatus).toBe(VerificationStatus.VERIFIED);
    });

    it('应该拒绝普通用户审核关系', async () => {
      const requestBody = {
        approved: true,
        verifiedBy: normalUser.id,
        note: '尝试审核',
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('权限');
    });

    it('应该拒绝不存在的用户审核', async () => {
      const requestBody = {
        approved: true,
        verifiedBy: 'non-existent-user-id',
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe('审核日志记录', () => {
    it('应该记录审核通过的操作日志', async () => {
      const requestBody = {
        approved: true,
        verifiedBy: adminUser.id,
        note: '关系准确无误',
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.100',
            'user-agent': 'Mozilla/5.0 Test Browser',
          },
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      expect(response.status).toBe(200);

      // 验证日志是否被创建
      const logs = await prisma.actionLog.findMany({
        where: {
          userId: adminUser.id,
          resourceId: testRelation.id,
        },
      });

      expect(logs.length).toBeGreaterThan(0);
      const log = logs[0];
      expect(log.description).toContain('通过');
      expect(log.ipAddress).toBe('192.168.1.100');
      expect(log.userAgent).toBe('Mozilla/5.0 Test Browser');

      const metadata = log.metadata as Record<string, unknown>;
      expect(metadata.approved).toBe(true);
      expect(metadata.note).toBe('关系准确无误');
    });

    it('应该记录审核拒绝的操作日志', async () => {
      const requestBody = {
        approved: false,
        verifiedBy: adminUser.id,
        note: '关系不准确',
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      expect(response.status).toBe(200);

      // 验证日志
      const logs = await prisma.actionLog.findMany({
        where: {
          userId: adminUser.id,
          resourceId: testRelation.id,
        },
      });

      expect(logs.length).toBeGreaterThan(0);
      const log = logs[0];
      expect(log.description).toContain('拒绝');

      const metadata = log.metadata as Record<string, unknown>;
      expect(metadata.approved).toBe(false);
      expect(metadata.note).toBe('关系不准确');
    });

    it('即使日志记录失败也应该完成审核', async () => {
      // 这个测试验证日志记录失败不会影响主流程
      const requestBody = {
        approved: true,
        verifiedBy: adminUser.id,
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      const data = await response.json();

      // 审核应该成功
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.verificationStatus).toBe(VerificationStatus.VERIFIED);
    });
  });

  describe('参数验证', () => {
    it('应该验证approved参数类型', async () => {
      const requestBody = {
        approved: 'true', // 错误的类型
        verifiedBy: adminUser.id,
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('approved');
    });

    it('应该验证verifiedBy参数', async () => {
      const requestBody = {
        approved: true,
        verifiedBy: '', // 空字符串
      };

      const request = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request, { params: { id: testRelation.id } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('verifiedBy');
    });

    it('应该处理不存在的关系ID', async () => {
      const requestBody = {
        approved: true,
        verifiedBy: adminUser.id,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/non-existent-id/verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request, {
        params: { id: 'non-existent-id' },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('不存在');
    });

    it('应该拒绝重复审核', async () => {
      // 先审核一次
      const firstRequest = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({
            approved: true,
            verifiedBy: adminUser.id,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      await POST(firstRequest, { params: { id: testRelation.id } });

      // 尝试再次审核
      const secondRequest = new NextRequest(
        `http://localhost:3000/api/v1/law-article-relations/${testRelation.id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({
            approved: false,
            verifiedBy: adminUser.id,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(secondRequest, {
        params: { id: testRelation.id },
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('已经被审核');
    });
  });
});
