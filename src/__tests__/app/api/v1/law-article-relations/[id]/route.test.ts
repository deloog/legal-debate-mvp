/**
 * 法条关系验证和删除API测试
 */

import { POST, DELETE } from '@/app/api/v1/law-article-relations/[id]/route';
import { prisma } from '@/lib/db';

// Mock数据库
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
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
    VERIFY_RELATION: 'VERIFY_RELATION',
    MANAGE_RELATIONS: 'MANAGE_RELATIONS',
  },
  KnowledgeGraphResource: {
    RELATION: 'RELATION',
  },
}));

describe('/api/v1/law-article-relations/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('DELETE - 删除关系', () => {
    beforeEach(() => {
      // Mock删除操作
      (prisma.lawArticleRelation.delete as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
      });
    });

    it('应该成功删除关系', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'DELETE',
          headers: { 'x-verified-by': 'user-123' },
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await DELETE(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('成功删除关系');
      expect(data.id).toBe('relation-1');
      expect(prisma.lawArticleRelation.delete).toHaveBeenCalledWith({
        where: { id: 'relation-1' },
      });
    });

    it('应该拒绝缺少x-verified-by头的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        { method: 'DELETE' }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await DELETE(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需字段: x-verified-by');
    });

    it('应该拒绝权限不足的删除请求', async () => {
      const { checkKnowledgeGraphPermission } = require('@/lib/middleware/knowledge-graph-permission');
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'DELETE',
          headers: { 'x-verified-by': 'user-123' },
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await DELETE(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });

    it('应该记录删除操作日志', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'DELETE',
          headers: {
            'x-verified-by': 'user-123',
            'x-forwarded-for': '192.168.1.1',
            'user-agent': 'Mozilla/5.0',
          },
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      await DELETE(request as any, params as any);

      const { logKnowledgeGraphAction } = require('@/lib/middleware/knowledge-graph-permission');
      expect(logKnowledgeGraphAction).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'MANAGE_RELATIONS',
        resource: 'RELATION',
        resourceId: 'relation-1',
        description: '删除关系',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: {
          relationId: 'relation-1',
        },
      });
    });

    it('应该处理删除失败的情况', async () => {
      (prisma.lawArticleRelation.delete as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'DELETE',
          headers: { 'x-verified-by': 'user-123' },
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await DELETE(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST - 验证关系', () => {
    beforeEach(() => {
      // Mock更新操作
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
        verificationStatus: 'PENDING',
        reviewHistory: [],
      });

      (prisma.lawArticleRelation.update as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
        verificationStatus: 'VERIFIED',
        verifiedBy: 'admin-123',
        verifiedAt: new Date('2026-01-01T00:00:00Z'),
        rejectionReason: null,
      });
    });

    it('应该成功通过验证', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: true,
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await POST(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verificationStatus).toBe('VERIFIED');
      expect(data.verifiedBy).toBe('admin-123');
      expect(prisma.lawArticleRelation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'relation-1' },
          data: expect.objectContaining({
            verificationStatus: 'VERIFIED',
          }),
        })
      );
    });

    it('应该成功拒绝验证', async () => {
      (prisma.lawArticleRelation.update as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
        verificationStatus: 'REJECTED',
        verifiedBy: 'admin-123',
        verifiedAt: new Date('2026-01-01T00:00:00Z'),
        rejectionReason: '关系准确性不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: false,
            comment: '关系准确性不足',
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await POST(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.verificationStatus).toBe('REJECTED');
      expect(data.rejectionReason).toBe('关系准确性不足');
    });

    it('应该记录审核历史', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: true,
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      await POST(request as any, params as any);

      expect(prisma.lawArticleRelation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'relation-1' },
          data: expect.objectContaining({
            reviewHistory: expect.any(Array),
          }),
        })
      );
    });

    it('应该拒绝缺少verifiedBy的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isApproved: true,
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await POST(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需字段: verifiedBy');
    });

    it('应该拒绝缺少isApproved的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await POST(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需字段: isApproved');
    });

    it('应该拒绝无效的isApproved类型', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: 'true',
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await POST(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需字段: isApproved');
    });

    it('应该拒绝权限不足的验证请求', async () => {
      const { checkKnowledgeGraphPermission } = require('@/lib/middleware/knowledge-graph-permission');
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'user-123',
            isApproved: true,
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await POST(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });

    it('应该记录验证操作日志', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '192.168.1.1',
            'user-agent': 'Mozilla/5.0',
          },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: true,
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      await POST(request as any, params as any);

      const { logKnowledgeGraphAction } = require('@/lib/middleware/knowledge-graph-permission');
      expect(logKnowledgeGraphAction).toHaveBeenCalledWith({
        userId: 'admin-123',
        action: 'VERIFY_RELATION',
        resource: 'RELATION',
        resourceId: 'relation-1',
        description: '验证关系通过',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: {
          isApproved: true,
          relationType: 'CITES',
        },
      });
    });

    it('应该处理关系不存在的情况', async () => {
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: true,
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await POST(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('关系不存在');
    });

    it('应该处理验证失败的情况', async () => {
      (prisma.lawArticleRelation.update as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: true,
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await POST(request as any, params as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('应该在日志记录失败时不影响主流程', async () => {
      const { logKnowledgeGraphAction } = require('@/lib/middleware/knowledge-graph-permission');
      (logKnowledgeGraphAction as jest.Mock).mockRejectedValue(
        new Error('日志记录失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: true,
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const response = await POST(request as any, params as any);

      // 日志失败不应影响主流程
      expect(response.status).toBe(200);
    });
  });

  describe('端到端流程测试', () => {
    it('应该支持完整的审核流程：创建→验证通过→验证状态', async () => {
      const createRequest = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: true,
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const createResponse = await POST(createRequest as any, params as any);
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(200);
      expect(createData.verificationStatus).toBe('VERIFIED');
      expect(createData.verifiedBy).toBe('admin-123');
      expect(createData.verifiedAt).toBeDefined();
    });

    it('应该支持完整的拒绝流程：创建→验证拒绝→记录原因', async () => {
      const rejectRequest = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: false,
            comment: '关系准确性不足，需要人工复核',
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const rejectResponse = await POST(rejectRequest as any, params as any);
      const rejectData = await rejectResponse.json();

      expect(rejectResponse.status).toBe(200);
      expect(rejectData.verificationStatus).toBe('REJECTED');
      expect(rejectData.rejectionReason).toBe('关系准确性不足，需要人工复核');
      expect(rejectData.reviewHistory).toBeDefined();
    });

    it('应该支持审核历史记录验证', async () => {
      // 第一次审核
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
        verificationStatus: 'PENDING',
        reviewHistory: [],
      });

      const firstRequest = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-123',
            isApproved: false,
            comment: '第一次审核',
          }),
        }
      );

      const { params } = { params: { id: 'relation-1' } };
      const firstResponse = await POST(firstRequest as any, params as any);
      const firstData = await firstResponse.json();

      // 第二次审核
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
        verificationStatus: 'REJECTED',
        reviewHistory: [
          {
            userId: 'admin-123',
            action: 'REJECTED',
            comment: '第一次审核',
            timestamp: '2026-01-01T00:00:00Z',
            previousStatus: 'PENDING',
            newStatus: 'REJECTED',
          },
        ],
      });

      (prisma.lawArticleRelation.update as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
        verificationStatus: 'VERIFIED',
        reviewHistory: [
          {
            userId: 'admin-123',
            action: 'REJECTED',
            comment: '第一次审核',
            timestamp: '2026-01-01T00:00:00Z',
            previousStatus: 'PENDING',
            newStatus: 'REJECTED',
          },
          {
            userId: 'admin-456',
            action: 'VERIFIED',
            comment: '重新审核',
            timestamp: '2026-01-02T00:00:00Z',
            previousStatus: 'REJECTED',
            newStatus: 'VERIFIED',
          },
        ],
      });

      const secondRequest = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedBy: 'admin-456',
            isApproved: true,
            comment: '重新审核',
          }),
        }
      );

      const secondResponse = await POST(secondRequest as any, params as any);
      const secondData = await secondResponse.json();

      expect(secondResponse.status).toBe(200);
      expect(secondData.reviewHistory).toHaveLength(2);
      expect(secondData.reviewHistory[0].action).toBe('REJECTED');
      expect(secondData.reviewHistory[1].action).toBe('VERIFIED');
    });
  });
});
