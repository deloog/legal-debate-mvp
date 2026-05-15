/**
 * 操作日志API测试
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/action-logs/route';
import { prisma } from '@/lib/db/prisma';

// Mock依赖
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    actionLog: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth');
jest.mock('@/lib/middleware/permission-check');
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

const mockedGetAuthUser = getAuthUser as jest.Mock;
const mockedValidatePermissions = validatePermissions as jest.Mock;

describe('操作日志API - GET /api/admin/action-logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'user-123',
    email: 'admin@test.com',
    role: 'ADMIN',
  };

  const mockActionLogs = [
    {
      id: 'log-1',
      userId: 'user-123',
      actionType: 'CREATE_CASE',
      actionCategory: 'CASE',
      description: '创建案件测试',
      resourceType: 'CASE',
      resourceId: 'case-123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      requestMethod: 'POST',
      requestPath: '/api/cases',
      requestParams: { title: '测试案件' },
      responseStatus: 201,
      executionTime: 150,
      metadata: null,
      createdAt: new Date('2024-01-01'),
    },
  ];

  describe('认证和权限检查', () => {
    it('未认证用户应返回401', async () => {
      mockedGetAuthUser.mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/admin/action-logs');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      const errorCode =
        typeof data.error === 'string' ? data.error : data.error?.code;
      expect(errorCode).toBe('UNAUTHORIZED');
    });

    it('无权限用户应返回403', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(
        Response.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: '权限不足' },
          },
          { status: 403 }
        )
      );

      const request = new NextRequest('http://localhost/api/admin/action-logs');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('FORBIDDEN');
    });

    it('有权限用户可以访问', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(1);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/admin/action-logs');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('查询参数处理', () => {
    beforeEach(() => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
    });

    it('默认分页参数应为第1页，每页20条', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(0);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/admin/action-logs');
      await GET(request);

      expect(prisma.actionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
    });

    it('应正确解析自定义分页参数', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(0);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/admin/action-logs?page=3&limit=50'
      );
      await GET(request);

      expect(prisma.actionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 100,
          take: 50,
        })
      );
    });

    it('限制limit最大值为100', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(0);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/admin/action-logs?limit=200'
      );
      await GET(request);

      expect(prisma.actionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it('应正确按操作类型筛选', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(0);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/admin/action-logs?actionType=CREATE_CASE'
      );
      await GET(request);

      expect(prisma.actionLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actionType: 'CREATE_CASE',
          }),
        })
      );
    });

    it('应正确按操作分类筛选', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(0);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/admin/action-logs?actionCategory=CASE'
      );
      await GET(request);

      expect(prisma.actionLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actionCategory: 'CASE',
          }),
        })
      );
    });

    it('应正确按用户ID筛选', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(0);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/admin/action-logs?userId=user-123'
      );
      await GET(request);

      expect(prisma.actionLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      );
    });

    it('应支持关键词搜索', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(0);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/admin/action-logs?search=案件'
      );
      await GET(request);

      expect(prisma.actionLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                description: expect.objectContaining({
                  contains: '案件',
                  mode: 'insensitive',
                }),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('响应数据格式', () => {
    beforeEach(() => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
    });

    it('应返回正确的数据结构', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(1);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue(
        mockActionLogs
      );

      const request = new NextRequest('http://localhost/api/admin/action-logs');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('data');
      expect(data.data).toHaveProperty('logs');
      expect(data.data).toHaveProperty('pagination');
      expect(data.data.logs).toHaveLength(1);
      expect(data.data.pagination.total).toBe(1);
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.totalPages).toBe(1);
    });

    it('应正确计算总页数', async () => {
      (prisma.actionLog.count as jest.Mock).mockResolvedValue(50);
      (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/admin/action-logs?limit=20'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.pagination.totalPages).toBe(3);
    });
  });

  describe('错误处理', () => {
    beforeEach(() => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
    });

    it('数据库错误应返回500', async () => {
      (prisma.actionLog.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest('http://localhost/api/admin/action-logs');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
