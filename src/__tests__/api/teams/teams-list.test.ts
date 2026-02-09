/**
 * Teams API测试 - 团队列表和创建
 * 测试团队管理API的列表查询和创建功能
 */

import { GET, OPTIONS as OPTIONS_LIST, POST } from '@/app/api/teams/route';
import { createMockRequest } from '../test-utils';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    team: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    teamMember: {
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { TeamStatusValues, TeamTypeValues } from '@/types/team';

describe('Teams API - List and Create', () => {
  let mockedPrisma: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma;

    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'USER',
    });

    (mockedPrisma as any).team.findMany.mockResolvedValue([
      {
        id: 'team-1',
        name: '测试律师事务所',
        type: TeamTypeValues.LAW_FIRM,
        description: '专业的法律团队',
        logo: null,
        status: TeamStatusValues.ACTIVE,
        metadata: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      },
    ]);
    (mockedPrisma as any).team.count.mockResolvedValue(1);
    (mockedPrisma as any).teamMember.count.mockResolvedValue(5);

    (mockedPrisma as any).team.create.mockImplementation((data: unknown) =>
      Promise.resolve({
        id: 'team-new',
        name: (data as any).data.name,
        type: (data as any).data.type,
        description: (data as any).data.description || null,
        logo: (data as any).data.logo || null,
        status: (data as any).data.status || TeamStatusValues.ACTIVE,
        metadata: (data as any).data.metadata || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    (mockedPrisma as any).teamMember.create.mockResolvedValue({
      id: 'member-1',
      teamId: 'team-new',
      userId: 'user-123',
      role: 'ADMIN',
      status: 'ACTIVE',
      joinedAt: new Date(),
    });
  });

  describe('GET /api/teams', () => {
    it('应该返回用户参与的团队列表', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams?page=1&limit=20'
      );
      const response = await GET(request);
      const testResponse = await response.clone().json();

      expect(response.status).toBe(200);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.teams).toHaveLength(1);
      expect(testResponse.data.total).toBe(1);
      expect(testResponse.meta.pagination.page).toBe(1);
      expect(testResponse.meta.pagination.limit).toBe(20);
    });

    it('应该支持按团队类型筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams?type=LAW_FIRM'
      );
      const response = await GET(request);
      await response.clone().json();

      expect((mockedPrisma as any).team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: TeamTypeValues.LAW_FIRM,
          }),
        })
      );
    });

    it('应该支持按状态筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams?status=ACTIVE'
      );
      const response = await GET(request);
      await response.clone().json();

      expect((mockedPrisma as any).team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: TeamStatusValues.ACTIVE,
          }),
        })
      );
    });

    it('应该支持关键词搜索', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams?search=法律'
      );
      const response = await GET(request);
      await response.clone().json();

      expect((mockedPrisma as any).team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: expect.objectContaining({
                  contains: '法律',
                  mode: 'insensitive',
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('应该支持分页参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams?page=2&limit=10'
      );
      const response = await GET(request);
      const testResponse = await response.clone().json();

      expect((mockedPrisma as any).team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(testResponse.meta.pagination.page).toBe(2);
    });

    it('应该支持排序功能', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/teams?sortBy=name&sortOrder=asc'
      );
      const response = await GET(request);
      await response.clone().json();

      expect((mockedPrisma as any).team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/teams');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('应该返回团队成员数量', async () => {
      const request = createMockRequest('http://localhost:3000/api/teams');
      const response = await GET(request);
      const testResponse = await response.clone().json();

      expect(testResponse.data.teams[0].memberCount).toBe(5);
    });
  });

  describe('POST /api/teams', () => {
    it('应该创建律师事务所类型团队', async () => {
      const teamData = {
        name: '新律师事务所',
        type: TeamTypeValues.LAW_FIRM,
        description: '专业的法律服务机构',
      };

      const request = createMockRequest('http://localhost:3000/api/teams', {
        method: 'POST',
        body: teamData,
      });

      const response = await POST(request);
      const testResponse = await response.clone().json();

      expect(response.status).toBe(201);
      expect(testResponse.success).toBe(true);
      expect(testResponse.data.name).toBe('新律师事务所');
      expect(testResponse.data.type).toBe(TeamTypeValues.LAW_FIRM);
    });

    it('应该创建法务部类型团队', async () => {
      const teamData = {
        name: '公司法务部',
        type: TeamTypeValues.LEGAL_DEPT,
      };

      const request = createMockRequest('http://localhost:3000/api/teams', {
        method: 'POST',
        body: teamData,
      });

      const response = await POST(request);
      const testResponse = await response.clone().json();

      expect(response.status).toBe(201);
      expect(testResponse.data.type).toBe(TeamTypeValues.LEGAL_DEPT);
    });

    it('应该自动将创建者添加为管理员', async () => {
      const teamData = {
        name: '新团队',
        type: TeamTypeValues.OTHER,
      };

      const request = createMockRequest('http://localhost:3000/api/teams', {
        method: 'POST',
        body: teamData,
      });

      await POST(request);

      expect((mockedPrisma as any).teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teamId: 'team-new',
            userId: 'user-123',
            role: 'ADMIN',
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('应该验证必填字段', async () => {
      const teamData = {};

      const request = createMockRequest('http://localhost:3000/api/teams', {
        method: 'POST',
        body: teamData,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该验证团队名称长度', async () => {
      const teamData = {
        name: 'a'.repeat(101),
        type: TeamTypeValues.LAW_FIRM,
      };

      const request = createMockRequest('http://localhost:3000/api/teams', {
        method: 'POST',
        body: teamData,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const teamData = {
        name: '测试团队',
        type: TeamTypeValues.LAW_FIRM,
      };

      const request = createMockRequest('http://localhost:3000/api/teams', {
        method: 'POST',
        body: teamData,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('应该支持可选字段', async () => {
      const teamData = {
        name: '完整团队',
        type: TeamTypeValues.LAW_FIRM,
        description: '团队描述',
        logo: 'http://example.com/logo.png',
        status: TeamStatusValues.ACTIVE,
        metadata: { key: 'value' },
      };

      const request = createMockRequest('http://localhost:3000/api/teams', {
        method: 'POST',
        body: teamData,
      });

      const response = await POST(request);
      const testResponse = await response.clone().json();

      expect(response.status).toBe(201);
      expect(testResponse.data.description).toBe('团队描述');
      expect(testResponse.data.logo).toBe('http://example.com/logo.png');
    });
  });

  describe('OPTIONS /api/teams', () => {
    it('应该返回CORS头部', async () => {
      const request = createMockRequest('http://localhost:3000/api/teams', {
        method: 'OPTIONS',
      });
      const response = await OPTIONS_LIST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type'
      );
    });
  });
});
