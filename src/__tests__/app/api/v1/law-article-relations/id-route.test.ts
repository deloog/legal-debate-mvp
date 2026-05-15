/**
 * 法条关系验证和删除API测试（动态路由入口）
 *
 * 契约重点：审核/删除操作者一律来自登录态，不接受客户端传入的
 * verifiedBy 或历史 x-verified-by 请求头。
 */

import { POST, DELETE } from '@/app/api/v1/law-article-relations/[id]/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';

const ADMIN_USER_ID = 'admin-user-001';
const ADMIN_EXPERT_ID = 'expert-admin-001';

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/law-article/relation-service', () => ({
  LawArticleRelationService: {
    verifyRelation: jest.fn(),
    deleteRelation: jest.fn(),
  },
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
    MANAGE_RELATIONS: 'MANAGE_RELATIONS',
  },
  KnowledgeGraphResource: {
    RELATION: 'RELATION',
  },
}));

const mockGetAuthUser = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const mockService = LawArticleRelationService as jest.Mocked<
  typeof LawArticleRelationService
>;

const getPermissionMock = () =>
  require('@/lib/middleware/knowledge-graph-permission');

const relationFixture = {
  id: 'relation-1',
  sourceId: 'article-1',
  targetId: 'article-2',
  relationType: 'CITES',
  strength: 1,
  confidence: 1,
  description: null,
  evidence: null,
  discoveryMethod: 'MANUAL',
  verificationStatus: 'VERIFIED',
  verifiedBy: ADMIN_EXPERT_ID,
  verifiedAt: new Date('2026-01-01T00:00:00Z'),
  createdBy: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  addedByExpertId: null,
  aiConfidence: null,
  aiCreatedAt: null,
  aiModel: null,
  aiProvider: null,
  aiReasoning: null,
  rejectionReason: null,
  reviewHistory: [],
} as const;

const makeRequest = (body?: unknown, headers?: HeadersInit) =>
  new Request('http://localhost:3000/api/v1/law-article-relations/relation-1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  });

describe('/api/v1/law-article-relations/[id]', () => {
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

    mockService.verifyRelation.mockResolvedValue({ ...relationFixture } as any);

    mockService.deleteRelation.mockResolvedValue(undefined);
  });

  describe('DELETE - 删除关系', () => {
    it('应该成功删除关系并使用登录用户记录日志', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        {
          method: 'DELETE',
          headers: {
            'x-forwarded-for': '192.168.1.1',
            'user-agent': 'Mozilla/5.0',
          },
        }
      );

      const response = await DELETE(request as any, {
        params: Promise.resolve({ id: 'relation-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('成功删除关系');
      expect(mockService.deleteRelation).toHaveBeenCalledWith('relation-1');
      expect(getPermissionMock().logKnowledgeGraphAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ADMIN_USER_ID,
          action: 'MANAGE_RELATIONS',
          resourceId: 'relation-1',
        })
      );
    });

    it('应该拒绝未登录用户删除关系', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request as any, {
        params: Promise.resolve({ id: 'relation-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('请先登录');
      expect(mockService.deleteRelation).not.toHaveBeenCalled();
    });

    it('应该拒绝权限不足的删除请求', async () => {
      getPermissionMock().checkKnowledgeGraphPermission.mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/law-article-relations/relation-1',
        { method: 'DELETE' }
      );

      const response = await DELETE(request as any, {
        params: Promise.resolve({ id: 'relation-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
      expect(mockService.deleteRelation).not.toHaveBeenCalled();
    });
  });

  describe('POST - 验证关系', () => {
    it('应该成功通过验证并写入登录用户对应的专家ID', async () => {
      const request = makeRequest({
        verifiedBy: 'forged-client-user',
        isApproved: true,
      });

      const response = await POST(request as any, {
        params: Promise.resolve({ id: 'relation-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.verificationStatus).toBe('VERIFIED');
      expect(mockService.verifyRelation).toHaveBeenCalledWith(
        'relation-1',
        ADMIN_EXPERT_ID,
        true
      );
    });

    it('应该成功拒绝验证', async () => {
      mockService.verifyRelation.mockResolvedValueOnce({
        ...relationFixture,
        verificationStatus: 'REJECTED',
        rejectionReason: '关系准确性不足',
      } as any);

      const request = makeRequest({
        isApproved: false,
        comment: '关系准确性不足',
      });

      const response = await POST(request as any, {
        params: Promise.resolve({ id: 'relation-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.verificationStatus).toBe('REJECTED');
      expect(mockService.verifyRelation).toHaveBeenCalledWith(
        'relation-1',
        ADMIN_EXPERT_ID,
        false
      );
    });

    it('应该拒绝未登录用户验证关系', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const response = await POST(makeRequest({ isApproved: true }) as any, {
        params: Promise.resolve({ id: 'relation-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('请先登录');
      expect(mockService.verifyRelation).not.toHaveBeenCalled();
    });

    it('应该拒绝缺少isApproved的请求', async () => {
      const response = await POST(makeRequest({}) as any, {
        params: Promise.resolve({ id: 'relation-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需字段: isApproved');
      expect(mockService.verifyRelation).not.toHaveBeenCalled();
    });

    it('应该拒绝权限不足的验证请求', async () => {
      getPermissionMock().checkKnowledgeGraphPermission.mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const response = await POST(makeRequest({ isApproved: true }) as any, {
        params: Promise.resolve({ id: 'relation-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
      expect(mockService.verifyRelation).not.toHaveBeenCalled();
    });

    it('应该记录验证操作日志并使用登录用户ID', async () => {
      const request = makeRequest(
        { isApproved: true },
        {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Mozilla/5.0',
        }
      );

      await POST(request as any, {
        params: Promise.resolve({ id: 'relation-1' }),
      });

      expect(getPermissionMock().logKnowledgeGraphAction).toHaveBeenCalledWith({
        userId: ADMIN_USER_ID,
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
  });
});
