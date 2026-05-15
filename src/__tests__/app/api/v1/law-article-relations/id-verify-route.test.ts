/**
 * 关系审核API测试：POST /api/v1/law-article-relations/[id]/verify
 *
 * 契约重点：审核人来自登录态，关系表 verifiedBy 写入专家档案 ID；
 * 日志仍记录真实 userId。
 */

import { POST } from '@/app/api/v1/law-article-relations/[id]/verify/route';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/middleware/auth';

const ADMIN_USER_ID = 'admin-user-verify-001';
const NORMAL_USER_ID = 'normal-user-verify-001';
const ADMIN_EXPERT_ID = 'expert-admin-verify-001';

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
    VERIFY_RELATION: 'VERIFY_RELATION',
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
    'http://localhost:3000/api/v1/law-article-relations/relation-1/verify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }
  );

describe('POST /api/v1/law-article-relations/[id]/verify', () => {
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

    (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
      id: 'relation-1',
      sourceId: 'article-1',
      targetId: 'article-2',
      relationType: 'CITES',
      verificationStatus: 'PENDING',
    });

    (prisma.lawArticleRelation.update as jest.Mock).mockImplementation(
      (args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({
          id: args.where.id,
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: 'CITES',
          verificationStatus: args.data.verificationStatus,
          verifiedBy: args.data.verifiedBy,
          verifiedAt: args.data.verifiedAt,
        })
    );
  });

  it('应该允许管理员审核通过关系并写入专家ID', async () => {
    const response = await POST(
      makeRequest({
        approved: true,
        verifiedBy: 'forged-client-user',
        note: '关系准确',
      }) as any,
      { params: Promise.resolve({ id: 'relation-1' }) }
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.verificationStatus).toBe('VERIFIED');
    expect(data.data.verifiedBy).toBe(ADMIN_EXPERT_ID);
    expect(data.data.verifiedBy).not.toBe('forged-client-user');
    expect(prisma.lawArticleRelation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'relation-1' },
        data: expect.objectContaining({
          verificationStatus: 'VERIFIED',
          verifiedBy: ADMIN_EXPERT_ID,
        }),
      })
    );
  });

  it('应该允许管理员拒绝关系', async () => {
    const response = await POST(makeRequest({ approved: false }) as any, {
      params: Promise.resolve({ id: 'relation-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.verificationStatus).toBe('REJECTED');
    expect(data.data.verifiedBy).toBe(ADMIN_EXPERT_ID);
  });

  it('应该拒绝未登录请求', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const response = await POST(makeRequest({ approved: true }) as any, {
      params: Promise.resolve({ id: 'relation-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('请先登录');
    expect(prisma.lawArticleRelation.update).not.toHaveBeenCalled();
  });

  it('应该拒绝普通用户审核关系', async () => {
    mockGetAuthUser.mockResolvedValue({
      userId: NORMAL_USER_ID,
      email: 'user@example.com',
      role: 'USER',
    });
    getPermissionMock().checkKnowledgeGraphPermission.mockResolvedValue({
      hasPermission: false,
      reason: '需要管理员权限',
    });

    const response = await POST(makeRequest({ approved: true }) as any, {
      params: Promise.resolve({ id: 'relation-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('权限');
    expect(prisma.lawArticleRelation.update).not.toHaveBeenCalled();
  });

  it('应该验证approved参数类型', async () => {
    const response = await POST(makeRequest({ approved: 'true' }) as any, {
      params: Promise.resolve({ id: 'relation-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('approved');
    expect(prisma.lawArticleRelation.update).not.toHaveBeenCalled();
  });

  it('应该处理不存在的关系ID', async () => {
    (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ approved: true }) as any, {
      params: Promise.resolve({ id: 'non-existent-id' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('不存在');
  });

  it('应该拒绝重复审核', async () => {
    (prisma.lawArticleRelation.findUnique as jest.Mock).mockResolvedValue({
      id: 'relation-1',
      verificationStatus: 'VERIFIED',
    });

    const response = await POST(makeRequest({ approved: false }) as any, {
      params: Promise.resolve({ id: 'relation-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('已经被审核');
  });

  it('应该记录审核日志并使用登录用户ID', async () => {
    const response = await POST(
      makeRequest(
        {
          approved: true,
          note: '关系准确无误',
        },
        {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Mozilla/5.0 Test Browser',
        }
      ) as any,
      { params: Promise.resolve({ id: 'relation-1' }) }
    );

    expect(response.status).toBe(200);
    expect(getPermissionMock().logKnowledgeGraphAction).toHaveBeenCalledWith({
      userId: ADMIN_USER_ID,
      action: 'VERIFY_RELATION',
      resource: 'RELATION',
      resourceId: 'relation-1',
      description: '通过法条关系审核',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Test Browser',
      metadata: {
        approved: true,
        note: '关系准确无误',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
      },
    });
  });
});
