/**
 * 批量审核API测试
 *
 * 当前契约：审核人来自登录态，关系表 verifiedBy 写入专家档案 ID。
 */

import { POST } from '@/app/api/v1/law-article-relations/batch-verify/route';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/middleware/auth';

const ADMIN_USER_ID = 'admin-123';
const ADMIN_EXPERT_ID = 'expert-admin-123';

jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/knowledge-graph/expert/expert-service', () => ({
  ExpertService: jest.fn().mockImplementation(() => ({
    getOrCreateExpertProfile: jest.fn().mockResolvedValue({
      id: ADMIN_EXPERT_ID,
      userId: ADMIN_USER_ID,
      userName: 'Admin',
      userEmail: 'admin@example.com',
      expertiseAreas: [],
      expertLevel: 'JUNIOR',
      certifiedBy: null,
      certifiedAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  })),
}));

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

const mockGetAuthUser = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const getPermissionMock = () =>
  require('@/lib/middleware/knowledge-graph-permission');

const makeRequest = (body: unknown, headers?: HeadersInit) =>
  new Request(
    'http://localhost:3000/api/v1/law-article-relations/batch-verify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }
  );

describe('POST /api/v1/law-article-relations/batch-verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAuthUser.mockResolvedValue({
      userId: ADMIN_USER_ID,
      email: 'admin@example.com',
      role: 'ADMIN',
    });

    getPermissionMock().checkKnowledgeGraphPermission.mockResolvedValue({
      hasPermission: true,
    });
    getPermissionMock().logKnowledgeGraphAction.mockResolvedValue(undefined);

    (prisma.lawArticleRelation.findUnique as jest.Mock).mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve({
          id: args.where.id,
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: 'CITES',
          verificationStatus: 'PENDING',
        })
    );

    (prisma.lawArticleRelation.update as jest.Mock).mockImplementation(
      (args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({
          id: args.where.id,
          verificationStatus: args.data.verificationStatus,
          verifiedBy: args.data.verifiedBy,
          verifiedAt: args.data.verifiedAt,
        })
    );
  });

  describe('参数验证', () => {
    it('应该拒绝未登录请求', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const response = await POST(
        makeRequest({ relationIds: ['relation-1'], approved: true }) as any
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权，请先登录');
    });

    it('应该拒绝缺少relationIds的请求', async () => {
      const response = await POST(makeRequest({ approved: true }) as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('relationIds参数必须是数组');
    });

    it('应该拒绝空的relationIds数组', async () => {
      const response = await POST(
        makeRequest({ relationIds: [], approved: true }) as any
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('relationIds不能为空');
    });

    it('应该拒绝超过最大批量大小的请求', async () => {
      const response = await POST(
        makeRequest({
          relationIds: Array.from({ length: 101 }, (_, i) => `relation-${i}`),
          approved: true,
        }) as any
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('最多只能批量审核100个关系');
    });

    it('应该拒绝approved参数不是布尔值的请求', async () => {
      const response = await POST(
        makeRequest({ relationIds: ['relation-1'], approved: 'true' }) as any
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('approved参数是必需的且必须是布尔值');
    });
  });

  describe('批量审核功能', () => {
    it('应该成功批量通过审核并写入专家ID', async () => {
      const response = await POST(
        makeRequest({
          relationIds: ['relation-1', 'relation-2', 'relation-3'],
          approved: true,
          verifiedBy: 'forged-client-user',
          note: '批量审核通过',
        }) as any
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(3);
      expect(data.data.failedCount).toBe(0);
      expect(prisma.lawArticleRelation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationStatus: 'VERIFIED',
            verifiedBy: ADMIN_EXPERT_ID,
          }),
        })
      );
    });

    it('应该成功批量拒绝审核', async () => {
      const response = await POST(
        makeRequest({
          relationIds: ['relation-1', 'relation-2'],
          approved: false,
        }) as any
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.successCount).toBe(2);
      expect(prisma.lawArticleRelation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationStatus: 'REJECTED',
            verifiedBy: ADMIN_EXPERT_ID,
          }),
        })
      );
    });
  });

  describe('权限验证', () => {
    it('应该拒绝权限不足的请求', async () => {
      getPermissionMock().checkKnowledgeGraphPermission.mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const response = await POST(
        makeRequest({ relationIds: ['relation-1'], approved: true }) as any
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
      expect(
        getPermissionMock().checkKnowledgeGraphPermission
      ).toHaveBeenCalledWith(ADMIN_USER_ID, 'BATCH_VERIFY', 'RELATION');
    });
  });

  describe('审核日志记录', () => {
    it('应该记录批量审核操作日志并使用登录用户ID', async () => {
      const response = await POST(
        makeRequest(
          {
            relationIds: ['relation-1', 'relation-2'],
            approved: true,
            note: '批量审核通过',
          },
          {
            'x-forwarded-for': '192.168.1.1',
            'user-agent': 'Mozilla/5.0',
          }
        ) as any
      );

      expect(response.status).toBe(200);
      expect(getPermissionMock().logKnowledgeGraphAction).toHaveBeenCalledWith({
        userId: ADMIN_USER_ID,
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
  });

  describe('错误处理', () => {
    it('应该处理关系不存在的情况', async () => {
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const response = await POST(
        makeRequest({ relationIds: ['relation-1'], approved: true }) as any
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.successCount).toBe(0);
      expect(data.data.failedCount).toBe(1);
      expect(data.data.results[0].error).toBe('关系不存在');
    });

    it('应该处理关系已经被审核的情况', async () => {
      (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
        id: 'relation-1',
        verificationStatus: 'VERIFIED',
      });

      const response = await POST(
        makeRequest({ relationIds: ['relation-1'], approved: true }) as any
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.successCount).toBe(0);
      expect(data.data.failedCount).toBe(1);
      expect(data.data.results[0].error).toBe('该关系已经被审核');
    });

    it('应该处理无效的JSON请求', async () => {
      const response = await POST(makeRequest('invalid json') as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('无效的请求体');
    });
  });
});
