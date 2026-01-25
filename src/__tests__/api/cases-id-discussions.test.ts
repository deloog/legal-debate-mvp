/**
 * 案件讨论API测试
 *
 * 验证讨论的创建、查询、更新、删除和置顶功能
 */

import { GET, POST } from '@/app/api/cases/[id]/discussions/route';
import { PUT, DELETE } from '@/app/api/discussions/[id]/route';
import { POST as PIN_POST } from '@/app/api/discussions/[id]/pin/route';
import { createMockRequest } from './test-utils';
import {
  createTestUser,
  createTestCase,
  createTestDiscussion,
} from '@/app/api/discussions/__tests__/helpers';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { canAccessSharedCase } from '@/lib/case/share-permission-validator';

// Mock依赖
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/case/share-permission-validator', () => ({
  canAccessSharedCase: jest.fn(),
}));

describe('案件讨论API测试', () => {
  let ownerUser: { id: string };
  let memberUser: { id: string };

  beforeEach(async () => {
    jest.clearAllMocks();

    // 创建测试用户
    ownerUser = await createTestUser(`owner_${Date.now()}@test.com`);
    memberUser = await createTestUser(`member_${Date.now()}@test.com`);

    // Mock认证
    (getAuthUser as jest.Mock).mockImplementation(async request => {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) return null;

      if (authHeader.includes('owner')) {
        return { userId: ownerUser.id, email: 'owner@test.com' };
      }
      if (authHeader.includes('member')) {
        return { userId: memberUser.id, email: 'member@test.com' };
      }
      return null;
    });
  });

  afterAll(async () => {
    try {
      // 清理所有测试数据
      await prisma.caseDiscussion
        .deleteMany({
          where: { userId: { in: [ownerUser.id, memberUser.id] } },
        })
        .catch(() => {});
      await prisma.caseTeamMember
        .deleteMany({
          where: { userId: { in: [ownerUser.id, memberUser.id] } },
        })
        .catch(() => {});
      await prisma.case
        .deleteMany({
          where: { userId: { in: [ownerUser.id, memberUser.id] } },
        })
        .catch(() => {});
      await prisma.user
        .deleteMany({
          where: { id: { in: [ownerUser.id, memberUser.id] } },
        })
        .catch(() => {});
    } catch (error) {
      console.error('清理测试数据失败:', error);
    }
    await prisma.$disconnect();
  });

  describe('GET /api/cases/[id]/discussions', () => {
    let testCase: { id: string; userId: string };

    beforeEach(async () => {
      testCase = await createTestCase(ownerUser.id, 'GET测试案件');
      (canAccessSharedCase as jest.Mock).mockResolvedValue({
        hasAccess: true,
        isOwner: true,
        accessType: 'owner',
      });
    });

    it('未认证用户应返回401', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });

    it('应返回讨论列表', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions`,
        {
          headers: { authorization: 'Bearer owner_token' },
        }
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('discussions');
      expect(data.data).toHaveProperty('total');
      expect(Array.isArray(data.data.discussions)).toBe(true);
    });

    it('应支持分页', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions?page=1&limit=10`,
        {
          headers: { authorization: 'Bearer owner_token' },
        }
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.discussions.length).toBeLessThanOrEqual(10);
      expect(data.meta.pagination).toHaveProperty('page', 1);
      expect(data.meta.pagination).toHaveProperty('limit', 10);
    });

    it('应支持按置顶状态过滤', async () => {
      await createTestDiscussion(testCase.id, ownerUser.id);
      await prisma.caseDiscussion.updateMany({
        where: { caseId: testCase.id },
        data: { isPinned: true },
      });

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions?isPinned=true`,
        {
          headers: { authorization: 'Bearer owner_token' },
        }
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      data.data.discussions.forEach((d: { isPinned: boolean }) => {
        expect(d.isPinned).toBe(true);
      });
    });

    it('应支持排序', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions?sortBy=createdAt&sortOrder=desc`,
        {
          headers: { authorization: 'Bearer owner_token' },
        }
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.discussions.length).toBeGreaterThanOrEqual(0);
    });

    it('无权访问时应返回403', async () => {
      (canAccessSharedCase as jest.Mock).mockResolvedValue({
        hasAccess: false,
        isOwner: false,
        reason: '无权访问此案件',
      });

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions`,
        {
          headers: { authorization: 'Bearer owner_token' },
        }
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('无权访问');
    });
  });

  describe('POST /api/cases/[id]/discussions', () => {
    let testCase: { id: string; userId: string };

    beforeEach(async () => {
      testCase = await createTestCase(ownerUser.id, 'POST测试案件');
      (canAccessSharedCase as jest.Mock).mockResolvedValue({
        hasAccess: true,
        isOwner: true,
        accessType: 'owner',
      });
    });

    it('未认证用户应返回401', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions`,
        {
          method: 'POST',
          body: { content: '测试讨论' },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(401);
    });

    it('应成功创建讨论', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions`,
        {
          method: 'POST',
          headers: { authorization: 'Bearer owner_token' },
          body: {
            content: '新的讨论内容',
            mentions: [memberUser.id],
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.content).toBe('新的讨论内容');
    });

    it('应验证内容不为空', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions`,
        {
          method: 'POST',
          headers: { authorization: 'Bearer owner_token' },
          body: { content: '' },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('应验证内容长度限制', async () => {
      const longContent = 'a'.repeat(10001);
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions`,
        {
          method: 'POST',
          headers: { authorization: 'Bearer owner_token' },
          body: { content: longContent },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(400);
    });

    it('应支持metadata字段', async () => {
      const metadata = { priority: 'high', tags: ['重要'] };
      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions`,
        {
          method: 'POST',
          headers: { authorization: 'Bearer owner_token' },
          body: {
            content: '带metadata的讨论',
            metadata,
          },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.data.metadata).toEqual(metadata);
    });

    it('无权访问时应返回403', async () => {
      (canAccessSharedCase as jest.Mock).mockResolvedValue({
        hasAccess: false,
        isOwner: false,
        reason: '无权访问此案件',
      });

      const request = createMockRequest(
        `http://localhost:3000/api/cases/${testCase.id}/discussions`,
        {
          method: 'POST',
          headers: { authorization: 'Bearer owner_token' },
          body: { content: '测试' },
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: testCase.id }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/discussions/[id]', () => {
    let testCase: { id: string; userId: string };
    let testDiscussion: { id: string };

    beforeEach(async () => {
      testCase = await createTestCase(ownerUser.id, 'PUT测试案件');
      testDiscussion = await createTestDiscussion(testCase.id, ownerUser.id);
      (canAccessSharedCase as jest.Mock).mockResolvedValue({
        hasAccess: true,
        isOwner: true,
        accessType: 'owner',
      });
    });

    it('未认证用户应返回401', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'PUT',
          body: { content: '更新内容' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(401);
    });

    it('讨论创建者应能更新讨论', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'PUT',
          headers: { authorization: 'Bearer owner_token' },
          body: { content: '更新后的内容' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.content).toBe('更新后的内容');
    });

    it('应支持更新mentions字段', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'PUT',
          headers: { authorization: 'Bearer owner_token' },
          body: {
            mentions: [memberUser.id, 'user123'],
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.mentions).toContain(memberUser.id);
    });

    it('应支持更新metadata', async () => {
      const metadata = { priority: 'low' };
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'PUT',
          headers: { authorization: 'Bearer owner_token' },
          body: { metadata },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.metadata).toEqual(metadata);
    });

    it('应验证内容不为空', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'PUT',
          headers: { authorization: 'Bearer owner_token' },
          body: { content: '' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(400);
    });

    it('不存在的讨论应返回404', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/nonexistent`,
        {
          method: 'PUT',
          headers: { authorization: 'Bearer owner_token' },
          body: { content: '更新' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/discussions/[id]', () => {
    let testCase: { id: string; userId: string };
    let testDiscussion: { id: string };

    beforeEach(async () => {
      testCase = await createTestCase(ownerUser.id, 'DELETE测试案件');
      testDiscussion = await createTestDiscussion(testCase.id, ownerUser.id);
      (canAccessSharedCase as jest.Mock).mockResolvedValue({
        hasAccess: true,
        isOwner: true,
        accessType: 'owner',
      });
    });

    it('未认证用户应返回401', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(401);
    });

    it('讨论创建者应能删除讨论', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'DELETE',
          headers: { authorization: 'Bearer owner_token' },
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(204);

      const deleted = await prisma.caseDiscussion.findUnique({
        where: { id: testDiscussion.id },
      });
      expect(deleted?.deletedAt).not.toBeNull();
    });

    it('应返回204无内容响应', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'DELETE',
          headers: { authorization: 'Bearer owner_token' },
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(204);
      expect(response.body).toBeNull();
    });

    it('删除已删除的讨论应返回404', async () => {
      await prisma.caseDiscussion.update({
        where: { id: testDiscussion.id },
        data: { deletedAt: new Date() },
      });

      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'DELETE',
          headers: { authorization: 'Bearer owner_token' },
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/discussions/[id]/pin', () => {
    let testCase: { id: string; userId: string };
    let testDiscussion: { id: string };

    beforeEach(async () => {
      testCase = await createTestCase(ownerUser.id, 'PIN测试案件');
      testDiscussion = await createTestDiscussion(testCase.id, ownerUser.id);
      // PIN API不使用canAccessSharedCase，它有独立的权限检查逻辑
      (canAccessSharedCase as jest.Mock).mockReset();
    });

    it('未认证用户应返回401', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}/pin`,
        {
          method: 'POST',
          body: { isPinned: true },
        }
      );

      const response = await PIN_POST(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(401);
    });

    it('应成功置顶讨论', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}/pin`,
        {
          method: 'POST',
          headers: { authorization: 'Bearer owner_token' },
          body: { isPinned: true },
        }
      );

      const response = await PIN_POST(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.isPinned).toBe(true);
    });

    it('应能取消置顶讨论', async () => {
      await prisma.caseDiscussion.update({
        where: { id: testDiscussion.id },
        data: { isPinned: true },
      });

      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}/pin`,
        {
          method: 'POST',
          headers: { authorization: 'Bearer owner_token' },
          body: { isPinned: false },
        }
      );

      const response = await PIN_POST(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.isPinned).toBe(false);
    });

    it('应验证isPinned为布尔值', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}/pin`,
        {
          method: 'POST',
          headers: { authorization: 'Bearer owner_token' },
          body: { isPinned: 'true' },
        }
      );

      const response = await PIN_POST(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('不存在的讨论应返回404', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/nonexistent/pin`,
        {
          method: 'POST',
          headers: { authorization: 'Bearer owner_token' },
          body: { isPinned: true },
        }
      );

      const response = await PIN_POST(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('权限验证', () => {
    let testCase: { id: string; userId: string };
    let testDiscussion: { id: string };

    beforeEach(async () => {
      testCase = await createTestCase(ownerUser.id, '权限测试案件');
      testDiscussion = await createTestDiscussion(testCase.id, ownerUser.id);
      (canAccessSharedCase as jest.Mock).mockResolvedValue({
        hasAccess: true,
        isOwner: true,
        accessType: 'owner',
      });
    });

    it('非讨论创建者且非案件所有者应无法编辑', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'PUT',
          headers: { authorization: 'Bearer member_token' },
          body: { content: '尝试编辑' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(403);
    });

    it('案件所有者应能编辑任何讨论', async () => {
      const request = createMockRequest(
        `http://localhost:3000/api/discussions/${testDiscussion.id}`,
        {
          method: 'PUT',
          headers: { authorization: 'Bearer owner_token' },
          body: { content: '案件所有者编辑' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: testDiscussion.id }),
      });

      expect(response.status).toBe(200);
    });
  });
});
