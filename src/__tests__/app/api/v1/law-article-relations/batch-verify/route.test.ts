/**
 * 批量审核API测试
 */

import { POST } from '@/app/api/v1/law-article-relations/batch-verify/route';
import { prisma } from '@/lib/db';

// Mock数据库
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock权限检查
jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(() =>
    Promise.resolve({ hasPermission: true })
  ),
  logKnowledgeGraphAction: jest.fn(() => Promise.resolve()),
  KnowledgeGraphAction: {
    BATCH_VERIFY: 'BATCH_VERIFY',
  },
  KnowledgeGraphResource: {
    RELATION: 'RELATION',
  },
}));

describe('POST /api/v1/law-article-relations/batch-verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const {
      checkKnowledgeGraphPermission,
    } = require('@/lib/middleware/knowledge-graph-permission');
    (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
      hasPermission: true,
    });
    // Reset DB mocks to prevent implementation bleed from previous tests
    (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
      id: 'relation-1',
      verificationStatus: 'PENDING',
    });
    (prisma.lawArticleRelation.update as jest.Mock).mockResolvedValue({
      id: 'relation-1',
      verificationStatus: 'VERIFIED',
      verifiedBy: 'admin-123',
      verifiedAt: new Date(),
    });
  });

  describe('参数验证', () => {
    it('应该拒绝缺少relationIds的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('relationIds参数必须是数组');
    });

    it('应该拒绝relationIds不是数组的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: 'not-an-array',
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('relationIds参数必须是数组');
    });

    it('应该拒绝空的relationIds数组', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: [],
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('relationIds不能为空');
    });

    it('应该拒绝超过最大批量大小的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: Array.from({ length: 101 }, (_, i) => `relation-${i}`),
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('最多只能批量审核100个关系');
    });

    it('应该拒绝缺少approved参数的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1', 'relation-2'],
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('approved参数是必需的且必须是布尔值');
    });

    it('应该拒绝approved参数不是布尔值的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1', 'relation-2'],
            approved: 'true',
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('approved参数是必需的且必须是布尔值');
    });

    it('应该拒绝缺少verifiedBy参数的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1', 'relation-2'],
            approved: true,
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('verifiedBy参数是必需的');
    });

    it('应该拒绝空的verifiedBy参数', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1', 'relation-2'],
            approved: true,
            verifiedBy: '  ',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('verifiedBy不能为空');
    });
  });

  describe('批量审核功能', () => {
    beforeEach(() => {
      // Mock关系查询
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockImplementation(
        (args: { where: { id: string } }) => {
          const relationId = args.where.id;
          return Promise.resolve({
            id: relationId,
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
            verificationStatus: 'PENDING',
          });
        }
      );

      // Mock更新操作
      (prisma.lawArticleRelation.update as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'admin-123',
        verifiedAt: new Date(),
      });
    });

    it('应该成功批量通过审核', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1', 'relation-2', 'relation-3'],
            approved: true,
            verifiedBy: 'admin-123',
            note: '批量审核通过',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(3);
      expect(data.data.failedCount).toBe(0);
      expect(data.data.results).toHaveLength(3);
      expect(data.data.results[0].success).toBe(true);
    });

    it('应该成功批量拒绝审核', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1', 'relation-2'],
            approved: false,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(2);

      // 验证更新时传入正确的状态
      expect(prisma.lawArticleRelation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationStatus: 'REJECTED',
          }),
        })
      );
    });

    it('应该支持混合操作（部分通过/拒绝）', async () => {
      // Mock不同的关系状态
      let callCount = 0;
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockImplementation(
        (args: { where: { id: string } }) => {
          callCount++;
          return Promise.resolve({
            id: args.where.id,
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
            verificationStatus: 'PENDING',
          });
        }
      );

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1', 'relation-2'],
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.results).toHaveLength(2);
    });
  });

  describe('权限验证', () => {
    it('应该拒绝权限不足的请求', async () => {
      const {
        checkKnowledgeGraphPermission,
      } = require('@/lib/middleware/knowledge-graph-permission');
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1'],
            approved: true,
            verifiedBy: 'user-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });
  });

  describe('审核日志记录', () => {
    it('应该记录批量审核操作日志', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
            'user-agent': 'Mozilla/5.0',
          },
          body: JSON.stringify({
            relationIds: ['relation-1', 'relation-2'],
            approved: true,
            verifiedBy: 'admin-123',
            note: '批量审核通过',
          }),
        }
      );

      await POST(request as any);

      const {
        logKnowledgeGraphAction,
      } = require('@/lib/middleware/knowledge-graph-permission');
      expect(logKnowledgeGraphAction).toHaveBeenCalledWith({
        userId: 'admin-123',
        action: 'BATCH_VERIFY',
        resource: 'RELATION',
        description: '批量通过2个法条关系审核',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: {
          count: 2,
          successCount: 2,
          failedCount: 0,
          approved: true,
          note: '批量审核通过',
        },
      });
    });

    it('应该记录批量拒绝操作的日志', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
            'user-agent': 'Mozilla/5.0',
          },
          body: JSON.stringify({
            relationIds: ['relation-1'],
            approved: false,
            verifiedBy: 'admin-123',
          }),
        }
      );

      await POST(request as any);

      const {
        logKnowledgeGraphAction,
      } = require('@/lib/middleware/knowledge-graph-permission');
      expect(logKnowledgeGraphAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-123',
          action: 'BATCH_VERIFY',
          resource: 'RELATION',
          description: '批量拒绝1个法条关系审核',
          metadata: expect.objectContaining({
            approved: false,
          }),
        })
      );
    });
  });

  describe('错误处理', () => {
    it('应该处理关系不存在的情况', async () => {
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1'],
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.successCount).toBe(0);
      expect(data.data.failedCount).toBe(1);
      expect(data.data.results[0].success).toBe(false);
      expect(data.data.results[0].error).toBe('关系不存在');
    });

    it('应该处理关系已经被审核的情况', async () => {
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        verificationStatus: 'VERIFIED',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1'],
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.successCount).toBe(0);
      expect(data.data.failedCount).toBe(1);
      expect(data.data.results[0].success).toBe(false);
      expect(data.data.results[0].error).toBe('该关系已经被审核');
    });

    it('应该处理部分失败的情况', async () => {
      let callCount = 0;
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockImplementation(
        (args: { where: { id: string } }) => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              id: args.where.id,
              verificationStatus: 'PENDING',
            });
          }
          if (callCount === 2) {
            return Promise.resolve(null); // 关系不存在
          }
          return Promise.resolve({
            id: args.where.id,
            verificationStatus: 'PENDING',
          });
        }
      );

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1', 'relation-2', 'relation-3'],
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = (await response.json()) as {
        success: boolean;
        data?: {
          successCount: number;
          failedCount: number;
          results: unknown[];
        };
      };

      expect(response.status).toBe(200);
      expect(data.data?.successCount).toBe(2);
      expect(data.data?.failedCount).toBe(1);
      expect(data.data?.results).toHaveLength(3);
    });

    it('应该处理更新失败的情况', async () => {
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        verificationStatus: 'PENDING',
      });

      (prisma.lawArticleRelation.update as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1'],
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.successCount).toBe(0);
      expect(data.data.failedCount).toBe(1);
      expect(data.data.results[0].success).toBe(false);
      expect(data.data.results[0].error).toBe('审核失败');
    });

    it('应该处理无效的JSON请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json',
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('无效的请求体');
    });

    it('应该在日志记录失败时不影响主流程', async () => {
      const {
        logKnowledgeGraphAction,
      } = require('@/lib/middleware/knowledge-graph-permission');
      (logKnowledgeGraphAction as jest.Mock).mockRejectedValue(
        new Error('日志记录失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/batch-verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationIds: ['relation-1'],
            approved: true,
            verifiedBy: 'admin-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = (await response.json()) as {
        success: boolean;
        data?: { successCount: number; failedCount: number };
      };

      // 日志失败不应影响主流程
      expect(response.status).toBe(200);
      expect(data.data?.successCount).toBe(1);
    });
  });
});
