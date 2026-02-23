import { GET, POST } from '@/app/api/tasks/route';
import { GET as GET_DETAIL, PUT, DELETE } from '@/app/api/tasks/[id]/route';
import { POST as ASSIGN } from '@/app/api/tasks/[id]/assign/route';
import { POST as COMPLETE } from '@/app/api/tasks/[id]/complete/route';
import {
  createMockRequest,
  createTestResponse,
  assertions,
} from './test-utils';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// Mock Auth
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';

describe('Tasks API', () => {
  let mockedPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma as any;

    // Default auth mock
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'cl1234567',
      email: 'test@example.com',
      role: 'lawyer',
    });

    // Default task mocks
    mockedPrisma.task.findMany.mockResolvedValue([
      {
        id: 'cm1234567',
        title: '测试任务1',
        description: '描述1',
        status: 'TODO',
        priority: 'HIGH',
        caseId: 'cl1234567',
        assignedTo: 'cl1234567',
        createdBy: 'cl1234567',
        dueDate: new Date('2024-12-31'),
        completedAt: null,
        deletedAt: null,
        tags: ['urgent', 'important'],
        estimatedHours: 8,
        actualHours: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        case: {
          id: 'cl1234567',
          title: '测试案件',
          type: 'civil',
          status: 'active',
        },
        assignedUser: {
          id: 'cl1234567',
          name: '测试用户',
          email: 'test@example.com',
          avatar: null,
        },
        createdByUser: {
          id: 'cl1234567',
          name: '测试用户',
          email: 'test@example.com',
          avatar: null,
        },
      },
    ]);
    mockedPrisma.task.count.mockResolvedValue(1);
    mockedPrisma.task.create.mockImplementation((data: any) => {
      return Promise.resolve({
        id: 'tk12345678',
        title: data.data.title,
        description: data.data.description,
        status: data.data.status || 'TODO',
        priority: data.data.priority || 'MEDIUM',
        caseId: data.data.caseId || 'cl1234567',
        assignedTo: data.data.assignedTo || 'cl1234567',
        createdBy: data.data.createdBy || 'cl1234567',
        dueDate: data.data.dueDate,
        completedAt: null,
        deletedAt: null,
        tags: data.data.tags || [],
        estimatedHours: data.data.estimatedHours,
        actualHours: null,
        metadata: data.data.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        case: null,
        assignedUser: null,
        createdByUser: null,
      });
    });
    mockedPrisma.task.findFirst.mockImplementation((query: any) => {
      if (query.where?.id === 'cm9999999') {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id: query.where?.id || 'cm1234567',
        title: '测试任务',
        description: '测试描述',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        caseId: 'cl1234567',
        assignedTo: 'cl1234567',
        createdBy: 'cl1234567',
        dueDate: new Date('2024-12-31'),
        completedAt: null,
        deletedAt: null,
        tags: ['urgent'],
        estimatedHours: 8,
        actualHours: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        case: {
          id: 'cl1234567',
          title: '测试案件',
          type: 'civil',
          status: 'active',
        },
        assignedUser: {
          id: 'cl1234567',
          name: '测试用户',
          email: 'test@example.com',
          avatar: null,
        },
        createdByUser: {
          id: 'cl1234567',
          name: '测试用户',
          email: 'test@example.com',
          avatar: null,
        },
      });
    });
    mockedPrisma.task.update.mockImplementation((data: any) => {
      return Promise.resolve({
        id: data.where.id,
        title: data.data.title || '测试任务',
        description: data.data.description || '测试描述',
        status: data.data.status || 'IN_PROGRESS',
        priority: data.data.priority || 'HIGH',
        caseId: data.data.caseId || 'cl1234567',
        assignedTo: data.data.assignedTo || 'cl1234567',
        createdBy: 'cl1234567',
        dueDate: data.data.dueDate || new Date('2024-12-31'),
        completedAt: data.data.completedAt || null,
        deletedAt: null,
        tags: data.data.tags || ['urgent'],
        estimatedHours: data.data.estimatedHours || 8,
        actualHours: data.data.actualHours || null,
        metadata: data.data.metadata || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        case: {
          id: 'cl1234567',
          title: '测试案件',
          type: 'civil',
          status: 'active',
        },
        assignedUser: {
          id: 'cl1234567',
          name: '测试用户',
          email: 'test@example.com',
          avatar: null,
        },
        createdByUser: {
          id: 'cl1234567',
          name: '测试用户',
          email: 'test@example.com',
          avatar: null,
        },
      });
    });
    mockedPrisma.user.findFirst.mockResolvedValue({
      id: 'cl12345678',
      name: '被分配用户',
      email: 'assigned@example.com',
      avatar: null,
    });
  });

  describe('GET /api/tasks', () => {
    it('should return paginated tasks list', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks?page=1&limit=10'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.tasks).toHaveLength(1);
      expect(testResponse.data.total).toBe(1);
      expect(testResponse.data.page).toBe(1);
      expect(testResponse.data.limit).toBe(10);
      expect(testResponse.data.totalPages).toBe(1);
    });

    it('should filter by caseId', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks?caseId=cl1234567'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(mockedPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            caseId: 'cl1234567',
          }),
        })
      );
    });

    it('should filter by assignedTo', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks?assignedTo=cl1234567'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(mockedPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedTo: 'cl1234567',
          }),
        })
      );
    });

    it('should filter by status', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks?status=TODO'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(mockedPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'TODO',
          }),
        })
      );
    });

    it('should filter by priority', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks?priority=HIGH'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(mockedPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: 'HIGH',
          }),
        })
      );
    });

    it('should filter by tags', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks?tags=urgent,important'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('should search by keyword', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks?search=测试'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('should validate pagination parameters', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks?page=1&limit=50'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.page).toBe(1);
      expect(testResponse.data.limit).toBe(50);
    });

    it('should use default pagination values', async () => {
      const request = createMockRequest('http://localhost:3000/api/tasks');
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.page).toBe(1);
      expect(testResponse.data.limit).toBe(20);
    });

    it('should require authentication', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);
      const request = createMockRequest('http://localhost:3000/api/tasks');
      const response = await GET(request);
      const _testResponse = await createTestResponse(response);

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result.message).toBe('请先登录');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const taskData = {
        title: '新任务',
        description: '任务描述',
        status: 'TODO',
        priority: 'HIGH',
        caseId: 'cl1234567',
        assignedTo: 'cl1234567',
        dueDate: '2024-12-31',
        tags: ['urgent'],
        estimatedHours: 8,
      };

      const request = createMockRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: taskData,
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.title).toBe('新任务');
      expect(testResponse.data.description).toBe('任务描述');
      expect(testResponse.data.status).toBe('TODO');
      expect(testResponse.data.priority).toBe('HIGH');
      expect(mockedPrisma.task.create).toHaveBeenCalled();
    });

    it('should set default status to TODO', async () => {
      const taskData = {
        title: '新任务',
      };

      const request = createMockRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: taskData,
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.status).toBe('TODO');
    });

    it('should set default priority to MEDIUM', async () => {
      const taskData = {
        title: '新任务',
      };

      const request = createMockRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: taskData,
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.priority).toBe('MEDIUM');
    });

    it('should validate required title field', async () => {
      const request = createMockRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: {},
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate title length', async () => {
      const taskData = {
        title: 'a'.repeat(201),
      };

      const request = createMockRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: taskData,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate description length', async () => {
      const taskData = {
        title: '新任务',
        description: 'a'.repeat(2001),
      };

      const request = createMockRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: taskData,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should validate estimated hours range', async () => {
      const taskData = {
        title: '新任务',
        estimatedHours: 1001,
      };

      const request = createMockRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: taskData,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should accept valid task statuses', async () => {
      const validStatuses = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

      for (const status of validStatuses) {
        const taskData = {
          title: '新任务',
          status,
        };

        const request = createMockRequest('http://localhost:3000/api/tasks', {
          method: 'POST',
          body: taskData,
        });

        const response = await POST(request);
        const testResponse = await createTestResponse(response);

        assertions.assertCreated(testResponse);
        expect(testResponse.data.status).toBe(status);
      }
    });

    it('should accept valid task priorities', async () => {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

      for (const priority of validPriorities) {
        const taskData = {
          title: '新任务',
          priority,
        };

        const request = createMockRequest('http://localhost:3000/api/tasks', {
          method: 'POST',
          body: taskData,
        });

        const response = await POST(request);
        const testResponse = await createTestResponse(response);

        assertions.assertCreated(testResponse);
        expect(testResponse.data.priority).toBe(priority);
      }
    });

    it('should require authentication', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);
      const request = createMockRequest('http://localhost:3000/api/tasks', {
        method: 'POST',
        body: { title: '新任务' },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tasks/[id]', () => {
    it('should return task details', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567'
      );

      const response = await GET_DETAIL(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.id).toBe('cm1234567');
      expect(testResponse.data.title).toBeDefined();
    });

    it('should return 404 for non-existent task', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm9999999'
      );

      const response = await GET_DETAIL(request);

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567'
      );

      const response = await GET_DETAIL(request);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/tasks/[id]', () => {
    it('should update task', async () => {
      const updateData = {
        title: '更新后的标题',
        status: 'COMPLETED',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567',
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(mockedPrisma.task.update).toHaveBeenCalled();
    });

    it('should allow task creator to update', async () => {
      const updateData = { title: '更新后的标题' };

      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567',
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('should allow assigned user to update', async () => {
      const updateData = { title: '更新后的标题' };

      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567',
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('should return 404 for non-existent task', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm9999999',
        {
          method: 'PUT',
          body: { title: '更新' },
        }
      );

      const response = await PUT(request);

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567',
        {
          method: 'PUT',
          body: { title: '更新' },
        }
      );

      const response = await PUT(request);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/tasks/[id]', () => {
    it('should soft delete task', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);

      expect(response.status).toBe(204);
      expect(mockedPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cm1234567' },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should only allow creator to delete', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);

      expect(response.status).toBe(204);
    });

    it('should return 404 for non-existent task', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm9999999',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/tasks/[id]/assign', () => {
    it('should assign task to user', async () => {
      const assignData = {
        assignedTo: 'cl12345678',
        priority: 'HIGH',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/assign',
        {
          method: 'POST',
          body: assignData,
        }
      );

      const response = await ASSIGN(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(mockedPrisma.task.update).toHaveBeenCalled();
    });

    it('should only allow creator to assign', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/assign',
        {
          method: 'POST',
          body: { assignedTo: 'cl1234567' },
        }
      );

      const response = await ASSIGN(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('should validate assigned user exists', async () => {
      mockedPrisma.user.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/assign',
        {
          method: 'POST',
          body: { assignedTo: 'cl9999999' },
        }
      );

      const response = await ASSIGN(request);

      expect(response.status).toBe(404);
    });

    it('should validate assignedTo field', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/assign',
        {
          method: 'POST',
          body: {},
        }
      );

      const response = await ASSIGN(request);

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/assign',
        {
          method: 'POST',
          body: { assignedTo: 'cl1234567' },
        }
      );

      const response = await ASSIGN(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/tasks/[id]/complete', () => {
    it('should mark task as completed', async () => {
      const completeData = {
        actualHours: 6,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/complete',
        {
          method: 'POST',
          body: completeData,
        }
      );

      const response = await COMPLETE(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(mockedPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            completedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should only allow assigned user to complete', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/complete',
        {
          method: 'POST',
          body: {},
        }
      );

      const response = await COMPLETE(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('should return error if already completed', async () => {
      mockedPrisma.task.findFirst.mockResolvedValue({
        id: 'cm1234567',
        status: 'COMPLETED',
        assignedTo: 'cl1234567',
        createdBy: 'cl1234567',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/complete',
        {
          method: 'POST',
          body: {},
        }
      );

      const response = await COMPLETE(request);

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.message).toBe('任务已经被标记为完成');
    });

    it('should validate actual hours', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/complete',
        {
          method: 'POST',
          body: { actualHours: 1001 },
        }
      );

      const response = await COMPLETE(request);

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);
      const request = createMockRequest(
        'http://localhost:3000/api/tasks/cm1234567/complete',
        {
          method: 'POST',
          body: {},
        }
      );

      const response = await COMPLETE(request);

      expect(response.status).toBe(401);
    });
  });
});
