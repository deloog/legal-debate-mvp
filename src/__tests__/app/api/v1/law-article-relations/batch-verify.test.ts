/**
 * 批量审核API测试
 * 测试批量审核法条关系的功能
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/law-article-relations/batch-verify/route';

// Override global prisma mock with specific implementations needed by the route
jest.mock('@/lib/db/prisma', () => {
  const mockLawArticleRelation = {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  };
  const mock = {
    lawArticleRelation: mockLawArticleRelation,
    actionLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  return { default: mock, prisma: mock };
});

// Mock permission middleware
jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(() =>
    Promise.resolve({ hasPermission: true })
  ),
  logKnowledgeGraphAction: jest.fn(() => Promise.resolve()),
  KnowledgeGraphAction: {
    BATCH_VERIFY: 'batch_verify',
  },
  KnowledgeGraphResource: {
    RELATION: 'law_article_relation',
  },
}));

const getPrisma = () => {
  const { prisma } = require('@/lib/db/prisma');
  return prisma;
};

const getPermissionMock = () => {
  return require('@/lib/middleware/knowledge-graph-permission');
};

// Pre-defined IDs used as admin/normal user IDs in tests
const ADMIN_USER_ID = 'admin-user-id-001';
const NORMAL_USER_ID = 'normal-user-id-001';

describe('批量审核API测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: permission granted
    (
      getPermissionMock().checkKnowledgeGraphPermission as jest.Mock
    ).mockResolvedValue({
      hasPermission: true,
    });
    (
      getPermissionMock().logKnowledgeGraphAction as jest.Mock
    ).mockResolvedValue(undefined);

    // Default: relation exists and is PENDING
    (getPrisma().lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
      id: 'relation-1',
      sourceId: 'art-1',
      targetId: 'art-2',
      relationType: 'CITES',
      verificationStatus: 'PENDING',
    });

    // Default: update succeeds
    (getPrisma().lawArticleRelation.update as jest.Mock).mockResolvedValue({
      id: 'relation-1',
      verificationStatus: 'VERIFIED',
      verifiedBy: ADMIN_USER_ID,
      verifiedAt: new Date(),
    });
  });

  describe('批量审核通过', () => {
    it('应该成功批量审核通过多个关系', async () => {
      const relationIds = ['relation-1', 'relation-2', 'relation-3'];

      // Mock each findUnique call to return a PENDING relation
      (
        getPrisma().lawArticleRelation.findUnique as jest.Mock
      ).mockImplementation((args: { where: { id: string } }) =>
        Promise.resolve({
          id: args.where.id,
          verificationStatus: 'PENDING',
        })
      );
      (getPrisma().lawArticleRelation.update as jest.Mock).mockImplementation(
        (args: { where: { id: string }; data: Record<string, unknown> }) =>
          Promise.resolve({
            id: args.where.id,
            verificationStatus: 'VERIFIED',
            verifiedBy: ADMIN_USER_ID,
            verifiedAt: new Date(),
          })
      );

      const requestBody = {
        relationIds,
        approved: true,
        verifiedBy: ADMIN_USER_ID,
        note: '批量审核通过',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(3);
      expect(data.data.failedCount).toBe(0);
      expect(data.data.results).toHaveLength(3);
    });

    it('应该成功批量审核拒绝多个关系', async () => {
      const relationIds = ['relation-1', 'relation-2'];

      (
        getPrisma().lawArticleRelation.findUnique as jest.Mock
      ).mockImplementation((args: { where: { id: string } }) =>
        Promise.resolve({
          id: args.where.id,
          verificationStatus: 'PENDING',
        })
      );
      (getPrisma().lawArticleRelation.update as jest.Mock).mockImplementation(
        (args: { where: { id: string }; data: Record<string, unknown> }) =>
          Promise.resolve({
            id: args.where.id,
            verificationStatus: 'REJECTED',
            verifiedBy: ADMIN_USER_ID,
            verifiedAt: new Date(),
          })
      );

      const requestBody = {
        relationIds,
        approved: false,
        verifiedBy: ADMIN_USER_ID,
        note: '关系不准确，批量拒绝',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(2);
      expect(data.data.failedCount).toBe(0);
    });
  });

  describe('权限检查', () => {
    it('应该拒绝普通用户批量审核', async () => {
      (
        getPermissionMock().checkKnowledgeGraphPermission as jest.Mock
      ).mockResolvedValue({
        hasPermission: false,
        reason: '需要管理员权限',
      });

      const requestBody = {
        relationIds: ['test-id-1', 'test-id-2'],
        approved: true,
        verifiedBy: NORMAL_USER_ID,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
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
        verifiedBy: ADMIN_USER_ID,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
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
        verifiedBy: ADMIN_USER_ID,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
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
        verifiedBy: ADMIN_USER_ID,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
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
      const validRelationId = 'valid-relation-1';

      // First call returns valid relation, subsequent calls return null
      let callCount = 0;
      (
        getPrisma().lawArticleRelation.findUnique as jest.Mock
      ).mockImplementation((args: { where: { id: string } }) => {
        callCount++;
        if (args.where.id === validRelationId) {
          return Promise.resolve({
            id: validRelationId,
            verificationStatus: 'PENDING',
          });
        }
        return Promise.resolve(null);
      });
      (getPrisma().lawArticleRelation.update as jest.Mock).mockResolvedValue({
        id: validRelationId,
        verificationStatus: 'VERIFIED',
        verifiedBy: ADMIN_USER_ID,
        verifiedAt: new Date(),
      });

      const requestBody = {
        relationIds: [
          validRelationId,
          'non-existent-id-1',
          'non-existent-id-2',
        ],
        approved: true,
        verifiedBy: ADMIN_USER_ID,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(1);
      expect(data.data.failedCount).toBe(2);
      expect(data.data.results).toHaveLength(3);
    });

    it('应该跳过已经审核过的关系', async () => {
      const verifiedId = 'verified-relation';
      const pendingId = 'pending-relation';

      (
        getPrisma().lawArticleRelation.findUnique as jest.Mock
      ).mockImplementation((args: { where: { id: string } }) => {
        if (args.where.id === verifiedId) {
          return Promise.resolve({
            id: verifiedId,
            verificationStatus: 'VERIFIED',
            verifiedBy: ADMIN_USER_ID,
            verifiedAt: new Date(),
          });
        }
        return Promise.resolve({
          id: pendingId,
          verificationStatus: 'PENDING',
        });
      });

      const requestBody = {
        relationIds: [verifiedId, pendingId],
        approved: true,
        verifiedBy: ADMIN_USER_ID,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.successCount).toBe(1);
      expect(data.data.failedCount).toBe(1);
    });
  });

  describe('审核日志记录', () => {
    it('应该记录批量审核操作日志', async () => {
      const relationIds = ['relation-1', 'relation-2'];

      (
        getPrisma().lawArticleRelation.findUnique as jest.Mock
      ).mockImplementation((args: { where: { id: string } }) =>
        Promise.resolve({ id: args.where.id, verificationStatus: 'PENDING' })
      );
      (getPrisma().lawArticleRelation.update as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        verificationStatus: 'VERIFIED',
      });

      const requestBody = {
        relationIds,
        approved: true,
        verifiedBy: ADMIN_USER_ID,
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

      // Verify logKnowledgeGraphAction was called
      expect(getPermissionMock().logKnowledgeGraphAction).toHaveBeenCalled();
      const logCall = (getPermissionMock().logKnowledgeGraphAction as jest.Mock)
        .mock.calls[0][0];
      expect(logCall.userId).toBe(ADMIN_USER_ID);
      expect(logCall.description).toContain('批量');
      expect(logCall.metadata.count).toBe(2);
      expect(logCall.metadata.approved).toBe(true);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成批量审核', async () => {
      const relationIds = Array.from({ length: 10 }, (_, i) => `relation-${i}`);

      (
        getPrisma().lawArticleRelation.findUnique as jest.Mock
      ).mockImplementation((args: { where: { id: string } }) =>
        Promise.resolve({ id: args.where.id, verificationStatus: 'PENDING' })
      );
      (getPrisma().lawArticleRelation.update as jest.Mock).mockImplementation(
        (args: { where: { id: string } }) =>
          Promise.resolve({
            id: args.where.id,
            verificationStatus: 'VERIFIED',
            verifiedBy: ADMIN_USER_ID,
            verifiedAt: new Date(),
          })
      );

      const requestBody = {
        relationIds,
        approved: true,
        verifiedBy: ADMIN_USER_ID,
      };

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: { 'Content-Type': 'application/json' },
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
