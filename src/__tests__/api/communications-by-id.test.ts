/**
 * Communications [id] API测试
 * 测试沟通记录详情获取、更新、删除功能
 */

import {
  DELETE,
  GET as GET_BY_ID,
  OPTIONS as OPTIONS_BY_ID,
  PATCH,
} from '@/app/api/communications/[id]/route';
import {
  assertions,
  createMockRequest,
  createTestResponse,
} from './test-utils';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    communicationRecord: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';

describe('Communications [id] API', () => {
  let mockedPrisma: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma;

    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'USER',
    });

    (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue({
      id: 'comm-1',
      clientId: 'client-1',
      userId: 'user-123',
      type: 'PHONE',
      summary: '电话沟通',
      content: '客户询问案件进展',
      nextFollowUpDate: null,
      isImportant: false,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (mockedPrisma as any).communicationRecord.update.mockImplementation(
      (data: unknown) =>
        Promise.resolve({
          id: (data as any).where.id,
          clientId: 'client-1',
          userId: 'user-123',
          type: (data as any).data.type,
          summary: (data as any).data.summary,
          content: (data as any).data.content,
          nextFollowUpDate: (data as any).data.nextFollowUpDate,
          isImportant: (data as any).data.isImportant,
          metadata: (data as any).data.metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
    );
    (mockedPrisma as any).communicationRecord.delete.mockResolvedValue({});
  });

  describe('GET /api/communications/[id]', () => {
    it('应该返回沟通记录详情', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.id).toBe('comm-1');
      expect(testResponse.data.type).toBe('PHONE');
      expect(testResponse.data.nextFollowUpDate).toBeNull();
    });

    it('应该返回有nextFollowUpDate的记录详情', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue({
        id: 'comm-2',
        clientId: 'client-1',
        userId: 'user-123',
        type: 'EMAIL',
        summary: '邮件沟通',
        content: null,
        nextFollowUpDate: new Date('2024-02-01'),
        isImportant: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-2'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'comm-2' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.nextFollowUpDate).not.toBeNull();
      expect(testResponse.data.nextFollowUpDate).toBeTruthy();
    });

    it('应该返回nextFollowUpDate为undefined的记录详情', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue({
        id: 'comm-4',
        clientId: 'client-1',
        userId: 'user-123',
        type: 'EMAIL',
        summary: '邮件沟通',
        content: null,
        nextFollowUpDate: undefined,
        isImportant: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-4'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'comm-4' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.nextFollowUpDate).toBeNull();
    });

    it('应该返回nextFollowUpDate为null的记录详情', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue({
        id: 'comm-3',
        clientId: 'client-1',
        userId: 'user-123',
        type: 'PHONE',
        summary: '电话沟通',
        content: null,
        nextFollowUpDate: null,
        isImportant: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-3'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'comm-3' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.nextFollowUpDate).toBeNull();
    });

    it('应该在记录不存在时返回404错误', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue(
        null
      );

      const request = createMockRequest(
        'http://localhost:3000/api/communications/not-exist'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'not-exist' }),
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该验证用户权限', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue(
        null
      );

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });

      expect(response.status).toBe(404);
    });

    it('应该处理无效的沟通记录数据（非对象）', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue(
        'invalid-data' as any
      );

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });

      expect(response.status).toBe(500);
    });
  });

  describe('PATCH /api/communications/[id]', () => {
    it('应该更新沟通记录', async () => {
      const updateData = {
        summary: '更新后的摘要',
        content: '更新后的内容',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('应该更新所有可选字段', async () => {
      const updateData = {
        type: 'EMAIL',
        summary: '更新后的摘要',
        content: '更新后的内容',
        nextFollowUpDate: new Date('2024-02-01').toISOString(),
        isImportant: true,
        metadata: { test: 'value' },
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.type).toBe('EMAIL');
      expect(testResponse.data.summary).toBe('更新后的摘要');
    });

    it('应该在记录不存在时返回404错误', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue(
        null
      );

      const request = createMockRequest(
        'http://localhost:3000/api/communications/not-exist',
        {
          method: 'PATCH',
          body: { summary: '更新' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'not-exist' }),
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'PATCH',
          body: { summary: '更新' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该验证用户权限', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue(
        null
      );

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'PATCH',
          body: { summary: '更新' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });

      expect(response.status).toBe(404);
    });

    it('应该处理PATCH更新后nextFollowUpDate为null的情况', async () => {
      (mockedPrisma as any).communicationRecord.update.mockResolvedValue({
        id: 'comm-1',
        clientId: 'client-1',
        userId: 'user-123',
        type: 'EMAIL',
        summary: '更新后的摘要',
        content: null,
        nextFollowUpDate: null,
        isImportant: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updateData = {
        summary: '更新后的摘要',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.nextFollowUpDate).toBeNull();
    });

    it('应该处理PATCH更新后nextFollowUpDate为有值的情况', async () => {
      (mockedPrisma as any).communicationRecord.update.mockResolvedValue({
        id: 'comm-1',
        clientId: 'client-1',
        userId: 'user-123',
        type: 'EMAIL',
        summary: '更新后的摘要',
        content: null,
        nextFollowUpDate: new Date('2024-02-01'),
        isImportant: false,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updateData = {
        summary: '更新后的摘要',
        nextFollowUpDate: new Date('2024-02-01').toISOString(),
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.nextFollowUpDate).not.toBeNull();
    });

    it('应该处理PATCH更新时nextFollowUpDate为undefined（数据库层）', async () => {
      const originalMock = (mockedPrisma as any).communicationRecord.update;
      (mockedPrisma as any).communicationRecord.update.mockImplementation(
        (data: unknown) => {
          const nextFollowUpDate = (data as any).data.nextFollowUpDate;
          const dbNextFollowUpDate = nextFollowUpDate
            ? new Date(nextFollowUpDate)
            : undefined;

          return Promise.resolve({
            id: (data as any).where.id,
            clientId: 'client-1',
            userId: 'user-123',
            type: (data as any).data.type,
            summary: (data as any).data.summary,
            content: (data as any).data.content,
            nextFollowUpDate: dbNextFollowUpDate,
            isImportant: false,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      );

      const updateData = {
        summary: '更新摘要',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.nextFollowUpDate).toBeNull();

      (mockedPrisma as any).communicationRecord.update.mockImplementation(
        originalMock
      );
    });
  });

  describe('DELETE /api/communications/[id]', () => {
    it('应该删除沟通记录', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });

      assertions.assertNoContent(response);
    });

    it('应该在记录不存在时返回404错误', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue(
        null
      );

      const request = createMockRequest(
        'http://localhost:3000/api/communications/not-exist',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'not-exist' }),
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该验证用户权限', async () => {
      (mockedPrisma as any).communicationRecord.findFirst.mockResolvedValue(
        null
      );

      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'comm-1' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('OPTIONS /api/communications/[id]', () => {
    it('应该返回CORS头部', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications/comm-1',
        {
          method: 'OPTIONS',
        }
      );
      const response = await OPTIONS_BY_ID(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, PATCH, DELETE, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type'
      );
    });
  });
});
