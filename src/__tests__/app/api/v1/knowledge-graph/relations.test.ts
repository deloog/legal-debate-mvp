/**
 * 知识图谱关系创建API测试
 */

import { POST } from '@/app/api/v1/knowledge-graph/relations/route';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/middleware/auth';
import { checkKnowledgeGraphPermission } from '@/lib/middleware/knowledge-graph-permission';

// Mock数据库
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
    },
    lawArticleRelation: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

// Mock权限检查
jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(() =>
    Promise.resolve({ hasPermission: true })
  ),
  logKnowledgeGraphAction: jest.fn(() => Promise.resolve()),
  KnowledgeGraphAction: {
    MANAGE_RELATIONS: 'MANAGE_RELATIONS',
  },
  KnowledgeGraphResource: {
    RELATION: 'law_article_relation',
  },
}));

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCheckPermission = checkKnowledgeGraphPermission as jest.Mock;

describe('POST /api/v1/knowledge-graph/relations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({
      userId: 'auth-user-123',
      email: 'user@example.com',
      role: 'ADMIN',
    });
    mockCheckPermission.mockResolvedValue({ hasPermission: true });
  });

  describe('参数验证', () => {
    it('应该拒绝未登录请求', async () => {
      mockGetAuthUser.mockResolvedValueOnce(null);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
          }),
        }
      );

      const response = await POST(request as any);

      expect(response.status).toBe(401);
    });

    it('应该拒绝缺少sourceId的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId: 'article-2',
            relationType: 'CITES',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需参数: sourceId');
    });

    it('应该拒绝缺少targetId的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            relationType: 'CITES',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需参数: targetId');
    });

    it('应该拒绝缺少relationType的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需参数: relationType');
    });

    it('应该不再要求客户端传createdBy', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
        lawName: '《民法典》',
        articleNumber: '第123条',
      });
      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue(
        null
      );
      (prisma.lawArticleRelation.create as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
        confidence: 0.7,
        strength: 0.7,
        verificationStatus: 'PENDING',
        createdBy: 'auth-user-123',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(prisma.lawArticleRelation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'auth-user-123',
          }),
        })
      );
    });

    it('应该拒绝无效的confidence参数', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
            confidence: 1.5,
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('confidence参数必须在0-1之间');
    });
  });

  describe('关系创建功能', () => {
    beforeEach(() => {
      // Mock源法条和目标法条
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
        lawName: '《民法典》',
        articleNumber: '第123条',
      });

      // Mock已存在关系检查（返回null表示不存在）
      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue(
        null
      );

      // Mock创建关系
      (prisma.lawArticleRelation.create as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
        confidence: 0.9,
        strength: 0.9,
        verificationStatus: 'PENDING',
        createdBy: 'auth-user-123',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
    });

    it('应该成功创建关系', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
            confidence: 0.9,
            createdBy: 'forged-user-id',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.relation).toBeDefined();
      expect(data.relation.sourceId).toBe('article-1');
      expect(data.relation.targetId).toBe('article-2');
      expect(data.relation.relationType).toBe('CITES');
      expect(prisma.lawArticleRelation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdBy: 'auth-user-123',
          }),
        })
      );
    });

    it('应该使用默认confidence值', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(prisma.lawArticleRelation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            confidence: 0.7, // 默认值
            strength: 0.7,
          }),
        })
      );
    });

    it('应该支持自定义evidence', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
            evidence: { description: '人工创建的关系' },
          }),
        }
      );

      const response = await POST(request as any);

      expect(response.status).toBe(201);
      expect(prisma.lawArticleRelation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            evidence: { description: '人工创建的关系' },
          }),
        })
      );
    });
  });

  describe('错误处理', () => {
    it('应该处理源法条不存在的情况', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('源法条不存在');
    });

    it('应该处理目标法条不存在的情况', async () => {
      (prisma.lawArticle.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'article-1',
          lawName: '《民法典》',
          articleNumber: '第123条',
        })
        .mockResolvedValueOnce(null);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('目标法条不存在');
    });

    it('应该处理关系已存在的情况', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
        lawName: '《民法典》',
        articleNumber: '第123条',
      });

      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
            createdBy: 'user-123',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('关系已存在');
    });

    it('应该处理权限不足的情况', async () => {
      mockCheckPermission.mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });

    it('应该处理数据库错误', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
        lawName: '《民法典》',
        articleNumber: '第123条',
      });
      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue(
        null
      );
      (prisma.lawArticleRelation.create as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/relations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: 'article-1',
            targetId: 'article-2',
            relationType: 'CITES',
          }),
        }
      );

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
