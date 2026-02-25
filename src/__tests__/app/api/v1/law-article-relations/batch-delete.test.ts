/**
 * 批量删除法条关系API测试
 */

import { POST } from '@/app/api/v1/law-article-relations/batch-delete/route';
import { prisma } from '@/lib/db';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
} from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// Mock日志
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock知识图谱权限中间件
jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(),
  logKnowledgeGraphAction: jest.fn(),
  KnowledgeGraphAction: {
    MANAGE_RELATIONS: 'MANAGE_RELATIONS',
  },
  KnowledgeGraphResource: {
    RELATION: 'RELATION',
  },
}));

const {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
} = require('@/lib/middleware/knowledge-graph-permission');

describe('批量删除法条关系API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('参数验证', () => {
    it('应该拒绝无效的请求体', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: 'invalid json',
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('无效的请求体');
    });

    it('应该拒绝缺少relationIds的请求', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('relationIds参数必须是数组');
    });

    it('应该拒绝relationIds为空数组的请求', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: [],
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('relationIds不能为空');
    });

    it('应该拒绝relationIds超过最大限制的请求', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: Array(101).fill('id'),
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('最多只能批量删除100个关系');
    });

    it('应该拒绝缺少deletedBy的请求', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['id1', 'id2'],
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('deletedBy参数是必需的');
    });

    it('应该拒绝deletedBy为空字符串的请求', async () => {
      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['id1', 'id2'],
            deletedBy: '  ',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('deletedBy不能为空');
    });
  });

  describe('权限检查', () => {
    it('应该拒绝权限不足的请求', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['id1'],
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('权限不足');
      expect(checkKnowledgeGraphPermission).toHaveBeenCalledWith(
        'user123',
        'MANAGE_RELATIONS',
        'RELATION'
      );
    });
  });

  describe('删除逻辑', () => {
    it('应该成功删除存在的关系', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation1',
        sourceId: 'source1',
        targetId: 'target1',
        relationType: RelationType.CITES,
      });

      (prisma.lawArticleRelation.delete as jest.Mock).mockResolvedValue({
        id: 'relation1',
      });

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['relation1'],
            deletedBy: 'user123',
            reason: '数据错误',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.successCount).toBe(1);
      expect(data.data?.failedCount).toBe(0);
      expect(data.data?.results[0].relationId).toBe('relation1');
      expect(data.data?.results[0].success).toBe(true);

      expect(prisma.lawArticleRelation.delete).toHaveBeenCalledWith({
        where: { id: 'relation1' },
      });

      expect(logKnowledgeGraphAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          action: 'MANAGE_RELATIONS',
          description: expect.stringContaining('批量删除'),
          metadata: expect.objectContaining({
            reason: '数据错误',
          }),
        })
      );
    });

    it('应该成功批量删除多个关系', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticleRelation.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'relation1',
        })
        .mockResolvedValueOnce({
          id: 'relation2',
        })
        .mockResolvedValueOnce({
          id: 'relation3',
        });

      (prisma.lawArticleRelation.delete as jest.Mock)
        .mockResolvedValueOnce({ id: 'relation1' })
        .mockResolvedValueOnce({ id: 'relation2' })
        .mockResolvedValueOnce({ id: 'relation3' });

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['relation1', 'relation2', 'relation3'],
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.successCount).toBe(3);
      expect(data.data?.failedCount).toBe(0);
      expect(data.data?.results).toHaveLength(3);
    });

    it('应该处理不存在的关系', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['nonexistent'],
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.successCount).toBe(0);
      expect(data.data?.failedCount).toBe(1);
      expect(data.data?.results[0].success).toBe(false);
      expect(data.data?.results[0].error).toBe('关系不存在');
    });

    it('应该处理部分成功的情况', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticleRelation.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'relation1' })
        .mockResolvedValueOnce(null);

      (prisma.lawArticleRelation.delete as jest.Mock).mockResolvedValue({
        id: 'relation1',
      });

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['relation1', 'nonexistent'],
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.successCount).toBe(1);
      expect(data.data?.failedCount).toBe(1);
    });

    it('应该处理删除失败的情况', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation1',
      });

      (prisma.lawArticleRelation.delete as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['relation1'],
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.failedCount).toBe(1);
      expect(data.data?.results[0].success).toBe(false);
      expect(data.data?.results[0].error).toBe('删除失败');
    });

    it('应该记录操作日志', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation1',
      });

      (prisma.lawArticleRelation.delete as jest.Mock).mockResolvedValue({
        id: 'relation1',
      });

      (logKnowledgeGraphAction as jest.Mock).mockResolvedValue(undefined);

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          headers: {
            'x-forwarded-for': '192.168.1.1',
            'user-agent': 'test-agent',
          },
          body: JSON.stringify({
            relationIds: ['relation1'],
            deletedBy: 'user123',
            reason: '测试删除',
          }),
        }
      );

      const response = await POST(request as any);

      expect(logKnowledgeGraphAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          action: 'MANAGE_RELATIONS',
          resource: 'RELATION',
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent',
          metadata: expect.objectContaining({
            count: 1,
            reason: '测试删除',
          }),
        })
      );
    });
  });

  describe('错误处理', () => {
    it('应该处理日志记录失败但不影响主流程', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation1',
      });

      (prisma.lawArticleRelation.delete as jest.Mock).mockResolvedValue({
        id: 'relation1',
      });

      (logKnowledgeGraphAction as jest.Mock).mockRejectedValue(
        new Error('日志记录失败')
      );

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['relation1'],
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      // 即使日志失败，主流程仍然成功
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.successCount).toBe(1);
    });

    it('应该处理服务器错误', async () => {
      (checkKnowledgeGraphPermission as jest.Mock).mockRejectedValue(
        new Error('服务器错误')
      );

      const request = new Request(
        'http://localhost/api/v1/law-article-relations/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            relationIds: ['relation1'],
            deletedBy: 'user123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('批量删除关系失败');
    });
  });
});
