/**
 * 批量审核API测试
 * 测试批量审核法条关系的功能
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/law-article-relations/batch-verify/route';
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
import type { LawArticle, User } from '@prisma/client';

describe('批量审核API测试', () => {
  const testArticles: LawArticle[] = [];
  let adminUser: User;
  let normalUser: User;

  beforeAll(async () => {
    // 创建测试用户
    adminUser = await prisma.user.create({
      data: {
        email: 'admin-batch-test@test.com',
        role: UserRole.ADMIN,
        password: 'hashed-password',
      },
    });

    normalUser = await prisma.user.create({
      data: {
        email: 'user-batch-test@test.com',
        role: UserRole.USER,
        password: 'hashed-password',
      },
    });

    // 创建测试法条
    for (let i = 1; i <= 5; i++) {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: `批量测试法${i}`,
          articleNumber: `${i}`,
          fullText: `这是批量测试法条${i}的内容`,
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: [],
          keywords: [],
          effectiveDate: new Date('2020-01-01'),
          status: LawStatus.VALID,
          issuingAuthority: '全国人大',
          relatedArticles: [],
          searchableText: `这是批量测试法条${i}的内容`,
        },
      });
      testArticles.push(article);
    }
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

    await prisma.user.deleteMany({
      where: {
        id: { in: [adminUser.id, normalUser.id] },
      },
    });
  });

  beforeEach(async () => {
    // 清理之前的关系
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: { in: testArticles.map(a => a.id) } },
          { targetId: { in: testArticles.map(a => a.id) } },
        ],
      },
    });
  });

  afterEach(async () => {
    // 清理测试关系
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: { in: testArticles.map(a => a.id) } },
          { targetId: { in: testArticles.map(a => a.id) } },
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

  describe('批量审核通过', () => {
    it('应该成功批量审核通过多个关系', async () => {
      // 创建待审核的关系
      const relations = await Promise.all([
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticles[0].id,
            targetId: testArticles[1].id,
            relationType: RelationType.CITES,
            strength: 0.9,
            confidence: 0.95,
            discoveryMethod: DiscoveryMethod.RULE_BASED,
            verificationStatus: VerificationStatus.PENDING,
          },
        }),
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticles[1].id,
            targetId: testArticles[2].id,
            relationType: RelationType.COMPLETES,
            strength: 0.8,
            confidence: 0.85,
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
            verificationStatus: VerificationStatus.PENDING,
          },
        }),
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticles[2].id,
            targetId: testArticles[3].id,
            relationType: RelationType.RELATED,
            strength: 0.7,
            confidence: 0.75,
            discoveryMethod: DiscoveryMethod.CASE_DERIVED,
            verificationStatus: VerificationStatus.PENDING,
          },
        }),
      ]);

      const requestBody = {
        relationIds: relations.map(r => r.id),
        approved: true,
        verifiedBy: adminUser.id,
        note: '批量审核通过',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(3);
      expect(data.data.failedCount).toBe(0);
      expect(data.data.results).toHaveLength(3);

      // 验证所有关系都被审核通过
      const updatedRelations = await prisma.lawArticleRelation.findMany({
        where: {
          id: { in: relations.map(r => r.id) },
        },
      });

      updatedRelations.forEach(relation => {
        expect(relation.verificationStatus).toBe(VerificationStatus.VERIFIED);
        expect(relation.verifiedBy).toBe(adminUser.id);
        expect(relation.verifiedAt).toBeDefined();
      });
    });

    it('应该成功批量审核拒绝多个关系', async () => {
      // 创建待审核的关系
      const relations = await Promise.all([
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticles[0].id,
            targetId: testArticles[1].id,
            relationType: RelationType.CITES,
            strength: 0.5,
            confidence: 0.6,
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
            verificationStatus: VerificationStatus.PENDING,
          },
        }),
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticles[1].id,
            targetId: testArticles[2].id,
            relationType: RelationType.RELATED,
            strength: 0.4,
            confidence: 0.5,
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
            verificationStatus: VerificationStatus.PENDING,
          },
        }),
      ]);

      const requestBody = {
        relationIds: relations.map(r => r.id),
        approved: false,
        verifiedBy: adminUser.id,
        note: '关系不准确，批量拒绝',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(2);
      expect(data.data.failedCount).toBe(0);

      // 验证所有关系都被拒绝
      const updatedRelations = await prisma.lawArticleRelation.findMany({
        where: {
          id: { in: relations.map(r => r.id) },
        },
      });

      updatedRelations.forEach(relation => {
        expect(relation.verificationStatus).toBe(VerificationStatus.REJECTED);
      });
    });
  });

  describe('权限检查', () => {
    it('应该拒绝普通用户批量审核', async () => {
      const requestBody = {
        relationIds: ['test-id-1', 'test-id-2'],
        approved: true,
        verifiedBy: normalUser.id,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('权限');
    });
  });

  describe('参数验证', () => {
    it('应该验证relationIds参数', async () => {
      const requestBody = {
        relationIds: [], // 空数组
        approved: true,
        verifiedBy: adminUser.id,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('relationIds');
    });

    it('应该限制批量审核的数量', async () => {
      // 创建超过限制的ID列表
      const tooManyIds = Array.from({ length: 101 }, (_, i) => `id-${i}`);

      const requestBody = {
        relationIds: tooManyIds,
        approved: true,
        verifiedBy: adminUser.id,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('最多');
    });

    it('应该验证approved参数类型', async () => {
      const requestBody = {
        relationIds: ['test-id'],
        approved: 'true', // 错误的类型
        verifiedBy: adminUser.id,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('approved');
    });
  });

  describe('部分成功场景', () => {
    it('应该处理部分关系不存在的情况', async () => {
      // 创建一个有效的关系
      const validRelation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticles[0].id,
          targetId: testArticles[1].id,
          relationType: RelationType.CITES,
          strength: 0.9,
          confidence: 0.95,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
          verificationStatus: VerificationStatus.PENDING,
        },
      });

      const requestBody = {
        relationIds: [
          validRelation.id,
          'non-existent-id-1',
          'non-existent-id-2',
        ],
        approved: true,
        verifiedBy: adminUser.id,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(1);
      expect(data.data.failedCount).toBe(2);
      expect(data.data.results).toHaveLength(3);

      // 验证有效关系被审核
      const updatedRelation = await prisma.lawArticleRelation.findUnique({
        where: { id: validRelation.id },
      });
      expect(updatedRelation?.verificationStatus).toBe(
        VerificationStatus.VERIFIED
      );
    });

    it('应该跳过已经审核过的关系', async () => {
      // 创建一个已审核的关系和一个待审核的关系
      const verifiedRelation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticles[0].id,
          targetId: testArticles[1].id,
          relationType: RelationType.CITES,
          strength: 0.9,
          confidence: 0.95,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedBy: adminUser.id,
          verifiedAt: new Date(),
        },
      });

      const pendingRelation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticles[1].id,
          targetId: testArticles[2].id,
          relationType: RelationType.COMPLETES,
          strength: 0.8,
          confidence: 0.85,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
          verificationStatus: VerificationStatus.PENDING,
        },
      });

      const requestBody = {
        relationIds: [verifiedRelation.id, pendingRelation.id],
        approved: true,
        verifiedBy: adminUser.id,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.successCount).toBe(1);
      expect(data.data.failedCount).toBe(1);

      // 验证只有待审核的关系被更新
      const updatedPending = await prisma.lawArticleRelation.findUnique({
        where: { id: pendingRelation.id },
      });
      expect(updatedPending?.verificationStatus).toBe(
        VerificationStatus.VERIFIED
      );
    });
  });

  describe('审核日志记录', () => {
    it('应该记录批量审核操作日志', async () => {
      // 创建待审核的关系
      const relations = await Promise.all([
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticles[0].id,
            targetId: testArticles[1].id,
            relationType: RelationType.CITES,
            strength: 0.9,
            confidence: 0.95,
            discoveryMethod: DiscoveryMethod.RULE_BASED,
            verificationStatus: VerificationStatus.PENDING,
          },
        }),
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticles[1].id,
            targetId: testArticles[2].id,
            relationType: RelationType.COMPLETES,
            strength: 0.8,
            confidence: 0.85,
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
            verificationStatus: VerificationStatus.PENDING,
          },
        }),
      ]);

      const requestBody = {
        relationIds: relations.map(r => r.id),
        approved: true,
        verifiedBy: adminUser.id,
        note: '批量审核测试',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.100',
          },
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);

      // 验证日志是否被创建
      const logs = await prisma.actionLog.findMany({
        where: {
          userId: adminUser.id,
          actionCategory: 'ADMIN',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      });

      expect(logs.length).toBeGreaterThan(0);
      const log = logs[0];
      expect(log.description).toContain('批量');

      const metadata = log.metadata as Record<string, unknown>;
      expect(metadata.count).toBe(2);
      expect(metadata.approved).toBe(true);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成批量审核', async () => {
      // 创建10个待审核的关系
      const relations = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.lawArticleRelation.create({
            data: {
              sourceId: testArticles[i % testArticles.length].id,
              targetId: testArticles[(i + 1) % testArticles.length].id,
              relationType: RelationType.RELATED,
              strength: 0.7,
              confidence: 0.75,
              discoveryMethod: DiscoveryMethod.RULE_BASED,
              verificationStatus: VerificationStatus.PENDING,
            },
          })
        )
      );

      const requestBody = {
        relationIds: relations.map(r => r.id),
        approved: true,
        verifiedBy: adminUser.id,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // 批量审核10个关系应该在3秒内完成
      expect(endTime - startTime).toBeLessThan(3000);
    });
  });
});
