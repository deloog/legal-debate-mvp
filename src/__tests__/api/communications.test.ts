/**
 * Communications API测试
 * 测试沟通记录列表查询和创建功能
 */

import {
  GET,
  OPTIONS as OPTIONS_LIST,
  POST,
} from '@/app/api/communications/route';
import {
  assertions,
  createMockRequest,
  createTestResponse,
} from './test-utils';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    communicationRecord: {
      findMany: jest.fn(),
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

describe('Communications API', () => {
  let mockedPrisma: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma;

    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'USER',
    });

    (mockedPrisma as any).communicationRecord.findMany.mockResolvedValue([
      {
        id: 'comm-1',
        clientId: 'client-1',
        userId: 'user-123',
        type: 'PHONE',
        summary: '电话沟通',
        content: '客户询问案件进展',
        nextFollowUpDate: null,
        isImportant: false,
        metadata: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      },
    ]);
    (mockedPrisma as any).communicationRecord.count.mockResolvedValue(1);
    (mockedPrisma as any).communicationRecord.create.mockImplementation(
      (data: unknown) => {
        const nextFollowUpDate = (data as any).data.nextFollowUpDate;
        return Promise.resolve({
          id: 'comm-new',
          clientId: (data as any).data.clientId,
          userId: 'user-123',
          type: (data as any).data.type,
          summary: (data as any).data.summary,
          content: (data as any).data.content || null,
          nextFollowUpDate:
            nextFollowUpDate === undefined
              ? undefined
              : nextFollowUpDate || null,
          isImportant: (data as any).data.isImportant || false,
          metadata: (data as any).data.metadata || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    );
  });

  describe('GET /api/communications', () => {
    it('应该返回沟通记录列表', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?page=1&limit=20'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.communications).toHaveLength(1);
      expect(testResponse.data.total).toBe(1);
      expect(testResponse.meta.pagination.page).toBe(1);
      expect(testResponse.meta.pagination.limit).toBe(20);
    });

    it('应该在没有查询参数时返回默认列表', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.communications).toHaveLength(1);
      expect(testResponse.data.total).toBe(1);
    });

    it('应该支持按客户ID筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?clientId=client-1'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: 'client-1',
          }),
        })
      );
    });

    it('应该支持按类型筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?type=PHONE'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'PHONE',
          }),
        })
      );
    });

    it('应该支持按重要性筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?isImportant=true'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isImportant: true,
          }),
        })
      );
    });

    it('应该支持按重要性筛选false', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?isImportant=false'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isImportant: false,
          }),
        })
      );
    });

    it('应该支持分页', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?page=2&limit=10'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.meta.pagination.page).toBe(2);
      expect(testResponse.meta.pagination.limit).toBe(10);
    });

    it('应该在不提供isImportant时不过滤', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?page=1'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            isImportant: expect.anything(),
          }),
        })
      );
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/communications', () => {
    it('应该创建沟通记录', async () => {
      const commData = {
        clientId: 'client-1',
        type: 'PHONE',
        summary: '电话沟通案件',
        content: '客户询问案件进展',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications',
        {
          method: 'POST',
          body: commData,
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.clientId).toBe('client-1');
      expect(testResponse.data.type).toBe('PHONE');
    });

    it('应该支持所有沟通类型', async () => {
      const types = ['PHONE', 'EMAIL', 'MEETING', 'WECHAT', 'OTHER'];

      for (const type of types) {
        const commData = {
          clientId: 'client-1',
          type: type as any,
          summary: '测试沟通',
        };

        const request = createMockRequest(
          'http://localhost:3000/api/communications',
          {
            method: 'POST',
            body: commData,
          }
        );

        const response = await POST(request);
        const testResponse = await createTestResponse(response);

        assertions.assertCreated(testResponse);
        expect(testResponse.data.type).toBe(type);
      }
    });

    it('应该支持设置isImportant为true', async () => {
      const commData = {
        clientId: 'client-1',
        type: 'EMAIL',
        summary: '重要邮件',
        isImportant: true,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications',
        {
          method: 'POST',
          body: commData,
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.isImportant).toBe(true);
    });

    it('应该支持设置isImportant为false', async () => {
      const commData = {
        clientId: 'client-1',
        type: 'EMAIL',
        summary: '普通邮件',
        isImportant: false,
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications',
        {
          method: 'POST',
          body: commData,
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.isImportant).toBe(false);
    });

    it('应该验证必填字段', async () => {
      const commData = {
        type: 'PHONE',
        summary: '测试',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications',
        {
          method: 'POST',
          body: commData,
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const commData = {
        clientId: 'client-1',
        type: 'PHONE',
        summary: '测试',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications',
        {
          method: 'POST',
          body: commData,
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('应该在未提供isImportant时使用默认值false', async () => {
      const commData = {
        clientId: 'client-1',
        type: 'EMAIL',
        summary: '测试沟通',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications',
        {
          method: 'POST',
          body: commData,
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.isImportant).toBe(false);
    });

    it('应该在未提供nextFollowUpDate时设置为undefined', async () => {
      const commData = {
        clientId: 'client-1',
        type: 'MEETING',
        summary: '面谈记录',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications',
        {
          method: 'POST',
          body: commData,
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.nextFollowUpDate).toBeNull();
      expect(
        (mockedPrisma as any).communicationRecord.create
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextFollowUpDate: undefined,
          }),
        })
      );
    });

    it('应该在提供nextFollowUpDate时正确处理', async () => {
      const commData = {
        clientId: 'client-1',
        type: 'MEETING',
        summary: '面谈记录',
        nextFollowUpDate: new Date('2024-02-01T10:00:00Z').toISOString(),
      };

      const request = createMockRequest(
        'http://localhost:3000/api/communications',
        {
          method: 'POST',
          body: commData,
        }
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.nextFollowUpDate).not.toBeNull();
      expect(
        (mockedPrisma as any).communicationRecord.create
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextFollowUpDate: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('OPTIONS /api/communications', () => {
    it('应该返回CORS头部', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications',
        {
          method: 'OPTIONS',
        }
      );
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

  describe('Response Structure', () => {
    it('应该返回一致的响应格式', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);
      const parsed = await response.json();
      expect(parsed.success).toBeDefined();
      expect(parsed.data).toBeDefined();
      expect(parsed.meta).toBeDefined();
    });

    it('应该包含分页元数据', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?page=1&limit=5'
      );
      const response = await GET(request);
      const parsed = await response.json();
      expect(parsed.meta.pagination).toBeDefined();
      expect(parsed.meta.pagination.page).toBe(1);
      expect(parsed.meta.pagination.limit).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('应该处理无效的沟通记录数据', async () => {
      (mockedPrisma as any).communicationRecord.findMany.mockResolvedValue([
        null,
        undefined,
      ]);

      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('应该处理映射时的类型错误', async () => {
      (mockedPrisma as any).communicationRecord.findMany.mockResolvedValue([
        'invalid',
        123,
      ]);

      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('应该处理缺少id的记录', async () => {
      (mockedPrisma as any).communicationRecord.findMany.mockResolvedValue([
        {
          clientId: 'client-1',
          userId: 'user-123',
          type: 'PHONE',
          summary: '测试',
          content: null,
          nextFollowUpDate: null,
          isImportant: false,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('应该处理空id的记录', async () => {
      (mockedPrisma as any).communicationRecord.findMany.mockResolvedValue([
        {
          id: '',
          clientId: 'client-1',
          userId: 'user-123',
          type: 'PHONE',
          summary: '测试',
          content: null,
          nextFollowUpDate: null,
          isImportant: false,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('应该处理只提供开始日期的查询', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?startDate=2024-01-01T00:00:00Z'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('应该处理有nextFollowUpDate的沟通记录列表', async () => {
      (mockedPrisma as any).communicationRecord.findMany.mockResolvedValue([
        {
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
        },
      ]);

      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(
        testResponse.data.communications[0].nextFollowUpDate
      ).not.toBeNull();
    });

    it('应该处理只提供结束日期的查询', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?endDate=2024-12-31T23:59:59Z'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
    });

    it('应该同时提供开始和结束日期的查询', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('应该处理不重要的沟通筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?isImportant=false'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isImportant: false,
          }),
        })
      );
    });

    it('应该处理无效的isImportant参数', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?isImportant=invalid'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isImportant: false,
          }),
        })
      );
    });

    it('应该处理isImportant为yes的情况', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?isImportant=yes'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isImportant: false,
          }),
        })
      );
    });

    it('应该处理isImportant为1的情况', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?isImportant=1'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isImportant: false,
          }),
        })
      );
    });

    it('应该处理isImportant为空字符串的情况', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?isImportant='
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            isImportant: expect.anything(),
          }),
        })
      );
    });

    it('应该处理isImportant为TRUE（大写）的情况', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?isImportant=TRUE'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isImportant: false,
          }),
        })
      );
    });

    it('应该处理isImportant为0的情况', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?isImportant=0'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect(
        (mockedPrisma as any).communicationRecord.findMany
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isImportant: false,
          }),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('应该处理空数据列表', async () => {
      (mockedPrisma as any).communicationRecord.findMany.mockResolvedValue([]);
      (mockedPrisma as any).communicationRecord.count.mockResolvedValue(0);

      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.communications).toHaveLength(0);
      expect(testResponse.data.total).toBe(0);
    });

    it('应该处理单个沟通记录', async () => {
      (mockedPrisma as any).communicationRecord.findMany.mockResolvedValue([
        {
          id: 'comm-1',
          clientId: 'client-1',
          userId: 'user-123',
          type: 'EMAIL',
          summary: '邮件沟通',
          content: null,
          nextFollowUpDate: null,
          isImportant: true,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      (mockedPrisma as any).communicationRecord.count.mockResolvedValue(1);

      const request = createMockRequest(
        'http://localhost:3000/api/communications'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.communications).toHaveLength(1);
      expect(testResponse.data.total).toBe(1);
    });

    it('应该处理最大分页限制', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/communications?limit=100'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.meta.pagination.limit).toBe(100);
    });
  });
});
