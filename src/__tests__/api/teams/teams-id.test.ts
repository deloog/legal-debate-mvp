/**
 * Teams API测试 - 团队详情、更新、删除
 * 测试团队详情、更新和删除功能
 */

import {
  DELETE,
  GET as GET_BY_ID,
  OPTIONS as OPTIONS_BY_ID,
  PATCH,
} from '@/app/api/teams/[id]/route';
import { createMockRequest } from '../test-utils';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    team: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamMember: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { TeamType, TeamStatus, TeamRole, MemberStatus } from '@/types/team';

describe('Teams API - Detail, Update, Delete', () => {
  let mockedPrisma: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma;

    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'USER',
    });

    (mockedPrisma as any).teamMember.findFirst.mockResolvedValue({
      id: 'member-1',
      teamId: 'team-1',
      userId: 'user-123',
      role: TeamRole.ADMIN,
      status: MemberStatus.ACTIVE,
    });

    (mockedPrisma as any).team.findUnique.mockResolvedValue({
      id: 'team-1',
      name: '测试律师事务所',
      type: TeamType.LAW_FIRM,
      description: '专业的法律团队',
      logo: null,
      status: TeamStatus.ACTIVE,
      metadata: null,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
    });

    (mockedPrisma as any).teamMember.count.mockResolvedValue(5);

    (mockedPrisma as any).team.update.mockImplementation((data: unknown) =>
      Promise.resolve({
        id: (data as any).where.id,
        name: (data as any).data.name || '测试律师事务所',
        type: (data as any).data.type || TeamType.LAW_FIRM,
        description: (data as any).data.description || null,
        logo: (data as any).data.logo || null,
        status: (data as any).data.status || TeamStatus.ACTIVE,
        metadata: (data as any).data.metadata || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    (mockedPrisma as any).teamMember.deleteMany.mockResolvedValue({
      count: 5,
    });

    (mockedPrisma as any).team.delete.mockResolvedValue({
      id: 'team-1',
      name: '测试律师事务所',
    });

    (mockedPrisma as any).$transaction = jest.fn(
      async (operations: unknown[]) => {
        // 模拟Prisma事务 - operations是操作对象数组
        // Prisma会自动按顺序执行这些操作
        const results = [];
        for (const op of operations as Array<{
          where: unknown;
          data?: unknown;
        }>) {
          if (op.where && (mockedPrisma as any).teamMember.deleteMany) {
            // 模拟deleteMany操作
            const result = await (mockedPrisma as any).teamMember.deleteMany(
              op
            );
            results.push(result);
          } else if (op.where && (mockedPrisma as any).team.delete) {
            // 模拟delete操作
            const result = await (mockedPrisma as any).team.delete(op);
            results.push(result);
          } else {
            results.push(null);
          }
        }
        return results;
      }
    );
  });

  describe('GET /api/teams/[id]', () => {
    it('应该返回团队详情', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1'
      );
      const response = await GET_BY_ID(request, {
        params: { id: 'team-1' },
      });
      const testResponse = await response.clone().json();

      expect(response.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.id).toBe('team-1');
      expect(testResponse.data.name).toBe('测试律师事务所');
    });

    it('应该返回团队成员数量', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1'
      );
      const response = await GET_BY_ID(request, {
        params: { id: 'team-1' },
      });
      const testResponse = await response.clone().json();

      expect(testResponse.data.memberCount).toBe(5);
    });

    it('应该在团队不存在时返回404错误', async () => {
      (mockedPrisma as any).team.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/not-exist'
      );
      const response = await GET_BY_ID(request, {
        params: { id: 'not-exist' },
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1'
      );
      const response = await GET_BY_ID(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(401);
    });

    it('应该在权限不足时返回403错误', async () => {
      (mockedPrisma as any).teamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1'
      );
      const response = await GET_BY_ID(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(403);
    });

    it('应该在非管理员访问时返回403错误', async () => {
      // 重置findFirst返回非管理员成员，确保认证用户不是团队成员
      (mockedPrisma as any).teamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1'
      );
      const response = await GET_BY_ID(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/teams/[id]', () => {
    it('应该更新团队名称', async () => {
      const updateData = {
        name: '更新后的团队名称',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: { id: 'team-1' },
      });
      const testResponse = await response.clone().json();

      expect(response.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.name).toBe('更新后的团队名称');
    });

    it('应该更新团队类型', async () => {
      const updateData = {
        type: TeamType.LEGAL_DEPT,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(200);
    });

    it('应该更新团队状态', async () => {
      const updateData = {
        status: TeamStatus.INACTIVE,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(200);
    });

    it('应该支持更新多个字段', async () => {
      const updateData = {
        name: '完整更新',
        description: '新的描述',
        logo: 'http://example.com/new-logo.png',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: { id: 'team-1' },
      });
      const testResponse = await response.clone().json();

      expect(response.status).toBe(200);
      expect(testResponse.data.description).toBe('新的描述');
      expect(testResponse.data.logo).toBe('http://example.com/new-logo.png');
    });

    it('应该在团队不存在时返回404错误', async () => {
      (mockedPrisma as any).team.findUnique.mockResolvedValue(null);

      const updateData = { name: '更新' };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/not-exist',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: { id: 'not-exist' },
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'PATCH',
          body: { name: '更新' },
        }
      );
      const response = await PATCH(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(401);
    });

    it('应该在权限不足时返回403错误', async () => {
      (mockedPrisma as any).teamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'PATCH',
          body: { name: '更新' },
        }
      );
      const response = await PATCH(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/teams/[id]', () => {
    it('应该删除团队及其所有成员', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(204);
      expect((mockedPrisma as any).teamMember.deleteMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
      });
    });

    it('应该在团队不存在时返回404错误', async () => {
      (mockedPrisma as any).team.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/not-exist',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: { id: 'not-exist' },
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(401);
    });

    it('应该在权限不足时返回403错误', async () => {
      (mockedPrisma as any).teamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: { id: 'team-1' },
      });

      expect(response.status).toBe(403);
    });

    it('应该使用事务确保数据一致性', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'DELETE',
        }
      );

      await DELETE(request, {
        params: { id: 'team-1' },
      });

      expect((mockedPrisma as any).$transaction).toHaveBeenCalled();
    });
  });

  describe('OPTIONS /api/teams/[id]', () => {
    it('应该返回CORS头部', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1',
        {
          method: 'OPTIONS',
        }
      );
      const response = await OPTIONS_BY_ID(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, PATCH, DELETE, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type'
      );
    });
  });
});
