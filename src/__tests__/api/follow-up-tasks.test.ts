/**
 * 跟进任务API测试
 */

import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '@/app/api/follow-up-tasks/route';

// Mock dependencies
jest.mock('@/lib/client/follow-up-task-processor');
jest.mock('@/lib/middleware/auth');
jest.mock('@/app/api/lib/responses/success');

describe('/api/follow-up-tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('应该返回任务列表', async () => {
      const mockResponse = {
        tasks: [
          {
            id: 'task-1',
            clientId: 'client-1',
            userId: 'user-1',
            summary: '跟进客户',
            dueDate: new Date('2026-01-25'),
            priority: 'HIGH',
            status: 'PENDING',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      const { getAuthUser } = await import('@/lib/middleware/auth');
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'user',
      });

      const { FollowUpTaskProcessor } =
        await import('@/lib/client/follow-up-task-processor');
      (FollowUpTaskProcessor.getTasks as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const { createSuccessResponse } =
        await import('@/app/api/lib/responses/success');
      (createSuccessResponse as jest.Mock).mockReturnValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const request = new NextRequest(
        'http://localhost:3000/api/follow-up-tasks'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持分页参数', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      };

      const { getAuthUser } = await import('@/lib/middleware/auth');
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'user',
      });

      const { FollowUpTaskProcessor } =
        await import('@/lib/client/follow-up-task-processor');
      (FollowUpTaskProcessor.getTasks as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const { createSuccessResponse } =
        await import('@/app/api/lib/responses/success');
      (createSuccessResponse as jest.Mock).mockReturnValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const request = new NextRequest(
        'http://localhost:3000/api/follow-up-tasks?page=2&limit=10'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持筛选参数', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };

      const { getAuthUser } = await import('@/lib/middleware/auth');
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'user',
      });

      const { FollowUpTaskProcessor } =
        await import('@/lib/client/follow-up-task-processor');
      (FollowUpTaskProcessor.getTasks as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const { createSuccessResponse } =
        await import('@/app/api/lib/responses/success');
      (createSuccessResponse as jest.Mock).mockReturnValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const request = new NextRequest(
        'http://localhost:3000/api/follow-up-tasks?status=PENDING&priority=HIGH'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持排序参数', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };

      const { getAuthUser } = await import('@/lib/middleware/auth');
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'user',
      });

      const { FollowUpTaskProcessor } =
        await import('@/lib/client/follow-up-task-processor');
      (FollowUpTaskProcessor.getTasks as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const { createSuccessResponse } =
        await import('@/app/api/lib/responses/success');
      (createSuccessResponse as jest.Mock).mockReturnValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const request = new NextRequest(
        'http://localhost:3000/api/follow-up-tasks?sortBy=dueDate&sortOrder=desc'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持日期范围筛选', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };

      const { getAuthUser } = await import('@/lib/middleware/auth');
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'user',
      });

      const { FollowUpTaskProcessor } =
        await import('@/lib/client/follow-up-task-processor');
      (FollowUpTaskProcessor.getTasks as jest.Mock).mockResolvedValue(
        mockResponse
      );

      const { createSuccessResponse } =
        await import('@/app/api/lib/responses/success');
      (createSuccessResponse as jest.Mock).mockReturnValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const request = new NextRequest(
        'http://localhost:3000/api/follow-up-tasks?dueDateFrom=2026-01-01&dueDateTo=2026-01-31'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该返回401当用户未认证', async () => {
      const { getAuthUser } = await import('@/lib/middleware/auth');
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/follow-up-tasks'
      );

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('应该验证分页参数', async () => {
      const { getAuthUser } = await import('@/lib/middleware/auth');
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'user',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/follow-up-tasks?page=0'
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('应该验证限制参数', async () => {
      const { getAuthUser } = await import('@/lib/middleware/auth');
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user-1',
        role: 'user',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/follow-up-tasks?limit=101'
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('OPTIONS', () => {
    it('应该支持CORS预检请求', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/follow-up-tasks',
        { method: 'OPTIONS' }
      );

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
        'GET'
      );
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
        'OPTIONS'
      );
    });
  });
});
