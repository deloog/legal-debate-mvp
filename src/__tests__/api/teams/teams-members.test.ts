/**
 * Teams API测试 - 团队成员管理
 * 测试团队成员的列表、添加、更新和删除功能
 */

import {
  DELETE as DELETE_MEMBER,
  GET as GET_MEMBER_BY_ID,
  OPTIONS as OPTIONS_MEMBER_BY_ID,
  PATCH as PATCH_MEMBER,
} from '@/app/api/teams/[id]/members/[userId]/route';
import {
  GET as GET_MEMBERS,
  OPTIONS as OPTIONS_MEMBERS,
  POST,
} from '@/app/api/teams/[id]/members/route';
import { createMockRequest } from '../test-utils';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    teamMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  MemberStatusValues,
  TeamRoleValues,
  TeamStatusValues,
  TeamTypeValues,
} from '@/types/team';

describe('Teams API - Members Management', () => {
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
      role: TeamRoleValues.ADMIN,
      status: MemberStatusValues.ACTIVE,
    });

    (mockedPrisma as any).teamMember.findMany.mockResolvedValue([
      {
        id: 'member-1',
        teamId: 'team-1',
        userId: 'user-123',
        role: TeamRoleValues.ADMIN,
        status: MemberStatusValues.ACTIVE,
        joinedAt: new Date('2024-01-01T10:00:00Z'),
        notes: null,
        metadata: null,
        user: {
          id: 'user-123',
          name: '管理员',
          email: 'admin@example.com',
          avatar: null,
          role: 'USER',
        },
        team: {
          id: 'team-1',
          name: '测试团队',
          type: TeamTypeValues.LAW_FIRM,
          status: TeamStatusValues.ACTIVE,
        },
      },
    ]);

    (mockedPrisma as any).teamMember.count.mockImplementation(
      (query: unknown) => {
        const where = (query as any)?.where;
        if (
          where?.role === TeamRoleValues.ADMIN &&
          where?.status === MemberStatusValues.ACTIVE
        ) {
          return Promise.resolve(2);
        }
        return Promise.resolve(1);
      }
    );

    (mockedPrisma as any).teamMember.findUnique.mockImplementation(
      (query: unknown) => {
        const where = (query as any).where;
        // 默认返回user-123作为团队成员
        if (where?.teamId_userId) {
          const { teamId, userId } = where.teamId_userId;
          if (teamId === 'team-1' && userId === 'user-123') {
            return Promise.resolve({
              id: 'member-1',
              teamId: 'team-1',
              userId: 'user-123',
              role: TeamRoleValues.ADMIN,
              status: MemberStatusValues.ACTIVE,
              joinedAt: new Date('2024-01-01T10:00:00Z'),
              notes: null,
              metadata: null,
              user: {
                id: 'user-123',
                name: '管理员',
                email: 'admin@example.com',
                avatar: null,
                role: 'USER',
              },
              team: {
                id: 'team-1',
                name: '测试团队',
                type: TeamTypeValues.LAW_FIRM,
                status: TeamStatusValues.ACTIVE,
              },
            });
          }
        }
        return Promise.resolve(null);
      }
    );

    (mockedPrisma as any).teamMember.create.mockImplementation(
      (data: unknown) =>
        Promise.resolve({
          id: 'member-new',
          teamId: (data as any).data.teamId,
          userId: (data as any).data.userId,
          role: (data as any).data.role,
          notes: (data as any).data.notes || null,
          metadata: (data as any).data.metadata || null,
          joinedAt: new Date(),
        })
    );

    (mockedPrisma as any).teamMember.update.mockImplementation(
      (data: unknown) =>
        Promise.resolve({
          id: (data as any).where.id,
          teamId: (data as any).where.teamId || 'team-1',
          userId: (data as any).where.userId || 'user-123',
          role: TeamRoleValues.LAWYER,
          status: MemberStatusValues.ACTIVE,
          notes: (data as any).data.notes || null,
          metadata: (data as any).data.metadata || null,
          joinedAt: new Date('2024-01-01T10:00:00Z'),
        })
    );

    (mockedPrisma as any).teamMember.delete.mockResolvedValue({
      id: 'member-1',
      teamId: 'team-1',
      userId: 'user-123',
    });
  });

  describe('GET /api/teams/[id]/members', () => {
    it('应该返回团队成员列表', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members'
      );
      const response = await GET_MEMBERS(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });
      const testResponse = await response.clone().json();

      expect(response.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.members).toHaveLength(1);
      expect(testResponse.data.total).toBe(1);
    });

    it('应该支持按角色筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members?role=ADMIN'
      );
      const response = await GET_MEMBERS(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(200);
    });

    it('应该支持按状态筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members?status=ACTIVE'
      );
      const response = await GET_MEMBERS(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(200);
    });

    it('应该支持分页', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members?page=2&limit=10'
      );
      const __response = await GET_MEMBERS(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect((mockedPrisma as any).teamMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members'
      );
      const response = await GET_MEMBERS(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该在权限不足时返回403错误', async () => {
      (mockedPrisma as any).teamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members'
      );
      const response = await GET_MEMBERS(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/teams/[id]/members', () => {
    it('应该添加团队成员', async () => {
      const memberData = {
        userId: 'user-456',
        role: TeamRoleValues.LAWYER,
        notes: '资深律师',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members',
        {
          method: 'POST',
          body: memberData,
        }
      );
      const response = await POST(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });
      const testResponse = await response.clone().json();

      expect(response.status).toBe(201);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.userId).toBe('user-456');
      expect(testResponse.data.role).toBe(TeamRoleValues.LAWYER);
    });

    it('应该添加律师助理', async () => {
      const memberData = {
        userId: 'user-789',
        role: TeamRoleValues.PARALEGAL,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members',
        {
          method: 'POST',
          body: memberData,
        }
      );
      const response = await POST(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(201);
    });

    it('应该在成员已存在时返回409错误', async () => {
      (mockedPrisma as any).teamMember.findUnique.mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId: 'user-456',
        role: TeamRoleValues.LAWYER,
        status: MemberStatusValues.ACTIVE,
      });

      const memberData = {
        userId: 'user-456',
        role: TeamRoleValues.LAWYER,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members',
        {
          method: 'POST',
          body: memberData,
        }
      );
      const response = await POST(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(409);
    });

    it('应该恢复已移除的成员而不是返回冲突', async () => {
      (mockedPrisma as any).teamMember.findUnique.mockResolvedValue({
        id: 'member-removed',
        teamId: 'team-1',
        userId: 'user-456',
        role: TeamRoleValues.LAWYER,
        status: MemberStatusValues.REMOVED,
      });

      const memberData = {
        userId: 'user-456',
        role: TeamRoleValues.LAWYER,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members',
        {
          method: 'POST',
          body: memberData,
        }
      );
      const response = await POST(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(201);
      expect((mockedPrisma as any).teamMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: MemberStatusValues.ACTIVE,
          }),
        })
      );
    });

    it('应该验证必填字段', async () => {
      const memberData = {};

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members',
        {
          method: 'POST',
          body: memberData,
        }
      );
      const response = await POST(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(400);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const memberData = {
        userId: 'user-456',
        role: TeamRoleValues.LAWYER,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members',
        {
          method: 'POST',
          body: memberData,
        }
      );
      const response = await POST(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该在权限不足时返回403错误', async () => {
      (mockedPrisma as any).teamMember.findFirst.mockResolvedValue(null);

      const memberData = {
        userId: 'user-456',
        role: TeamRoleValues.LAWYER,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members',
        {
          method: 'POST',
          body: memberData,
        }
      );
      const response = await POST(request, {
        params: Promise.resolve({ id: 'team-1' }),
      });

      expect(response.status).toBe(403);
    });

    it('不应允许降级最后一名活跃管理员', async () => {
      (mockedPrisma as any).teamMember.count.mockResolvedValueOnce(1);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'PATCH',
          body: { role: TeamRoleValues.LAWYER },
        }
      );
      const response = await PATCH_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(400);
      expect((mockedPrisma as any).teamMember.update).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/teams/[id]/members/[userId]', () => {
    it('应该返回成员详情', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123'
      );
      const response = await GET_MEMBER_BY_ID(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });
      const testResponse = await response.clone().json();

      expect(response.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.userId).toBe('user-123');
    });

    it('应该在成员不存在时返回404错误', async () => {
      (mockedPrisma as any).teamMember.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/not-exist'
      );
      const response = await GET_MEMBER_BY_ID(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'not-exist' }),
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123'
      );
      const response = await GET_MEMBER_BY_ID(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该在权限不足时返回403错误', async () => {
      (mockedPrisma as any).teamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123'
      );
      const response = await GET_MEMBER_BY_ID(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(403);
    });

    it('不应允许移除最后一名活跃管理员', async () => {
      (mockedPrisma as any).teamMember.count.mockResolvedValueOnce(1);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(400);
      expect((mockedPrisma as any).teamMember.delete).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/teams/[id]/members/[userId]', () => {
    it('应该更新成员角色', async () => {
      const updateData = {
        role: TeamRoleValues.LAWYER,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(200);
    });

    it('应该更新成员状态', async () => {
      const updateData = {
        status: MemberStatusValues.INACTIVE,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(200);
    });

    it('应该支持更新多个字段', async () => {
      const updateData = {
        role: TeamRoleValues.PARALEGAL,
        status: MemberStatusValues.ACTIVE,
        notes: '新的备注',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(200);
    });

    it('应该在成员不存在时返回404错误', async () => {
      (mockedPrisma as any).teamMember.findUnique.mockResolvedValue(null);

      const updateData = { role: TeamRoleValues.LAWYER };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/not-exist',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'not-exist' }),
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const updateData = { role: TeamRoleValues.LAWYER };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该在权限不足时返回403错误', async () => {
      (mockedPrisma as any).teamMember.findFirst.mockResolvedValue(null);

      const updateData = { role: TeamRoleValues.LAWYER };

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/teams/[id]/members/[userId]', () => {
    it('应该移除团队成员', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(204);
    });

    it('应该在成员不存在时返回404错误', async () => {
      (mockedPrisma as any).teamMember.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/not-exist',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'not-exist' }),
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该在权限不足时返回403错误', async () => {
      (mockedPrisma as any).teamMember.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE_MEMBER(request, {
        params: Promise.resolve({ id: 'team-1', userId: 'user-123' }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('OPTIONS /api/teams/[id]/members', () => {
    it('应该返回CORS头部', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members',
        {
          method: 'OPTIONS',
        }
      );
      const response = await OPTIONS_MEMBERS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, OPTIONS'
      );
    });
  });

  describe('OPTIONS /api/teams/[id]/members/[userId]', () => {
    it('应该返回CORS头部', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams/team-1/members/user-123',
        {
          method: 'OPTIONS',
        }
      );
      const response = await OPTIONS_MEMBER_BY_ID(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, PATCH, DELETE, OPTIONS'
      );
    });
  });
});
