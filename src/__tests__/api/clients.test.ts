/**
 * Clients API测试
 * 测试客户管理API的完整功能
 */

import {
  DELETE,
  GET as GET_BY_ID,
  OPTIONS as OPTIONS_BY_ID,
  PATCH,
} from '@/app/api/clients/[id]/route';
import { GET, OPTIONS as OPTIONS_LIST, POST } from '@/app/api/clients/route';
import {
  assertions,
  createMockRequest,
  createTestResponse,
} from './test-utils';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    client: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    communicationRecord: {
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';

describe('Clients API', () => {
  let mockedPrisma: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma = prisma;

    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'USER',
    });

    (mockedPrisma as any).client.findMany.mockResolvedValue([
      {
        id: 'client-1',
        userId: 'user-123',
        clientType: 'INDIVIDUAL',
        name: '张三',
        gender: '男',
        age: 30,
        profession: '工程师',
        phone: '13800138000',
        email: 'zhangsan@example.com',
        address: '北京市朝阳区',
        idCardNumber: null,
        company: null,
        creditCode: null,
        legalRep: null,
        source: 'REFERRAL',
        tags: ['VIP', '长期'],
        status: 'ACTIVE',
        notes: null,
        metadata: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        deletedAt: null,
      },
    ]);
    (mockedPrisma as any).client.count.mockResolvedValue(1);
    (mockedPrisma as any).case.findMany.mockResolvedValue([]);
    (mockedPrisma as any).case.count.mockResolvedValue(0);
    (mockedPrisma as any).communicationRecord.count.mockResolvedValue(0);

    (mockedPrisma as any).client.create.mockImplementation((data: unknown) =>
      Promise.resolve({
        id: 'client-new',
        userId: 'user-123',
        clientType: (data as any).data.clientType,
        name: (data as any).data.name,
        gender: (data as any).data.gender || null,
        age: (data as any).data.age || null,
        profession: (data as any).data.profession || null,
        phone: (data as any).data.phone || null,
        email: (data as any).data.email || null,
        address: (data as any).data.address || null,
        idCardNumber: (data as any).data.idCardNumber || null,
        company: (data as any).data.company || null,
        creditCode: (data as any).data.creditCode || null,
        legalRep: (data as any).data.legalRep || null,
        source: (data as any).data.source || null,
        tags: (data as any).data.tags || [],
        notes: (data as any).data.notes || null,
        metadata: (data as any).data.metadata || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
    );

    (mockedPrisma as any).client.findFirst.mockResolvedValue({
      id: 'client-1',
      userId: 'user-123',
      clientType: 'INDIVIDUAL',
      name: '张三',
      gender: '男',
      age: 30,
      profession: '工程师',
      phone: '13800138000',
      email: 'zhangsan@example.com',
      address: '北京市朝阳区',
      idCardNumber: null,
      company: null,
      creditCode: null,
      legalRep: null,
      source: 'REFERRAL',
      tags: ['VIP', '长期'],
      status: 'ACTIVE',
      notes: null,
      metadata: null,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      deletedAt: null,
    });

    (mockedPrisma as any).client.update.mockImplementation((data: unknown) =>
      Promise.resolve({
        id: (data as any).where.id,
        userId: 'user-123',
        clientType: 'INDIVIDUAL',
        name: '李四',
        gender: '女',
        age: 25,
        profession: '医生',
        phone: '13900139000',
        email: 'lisi@example.com',
        address: '上海市浦东新区',
        idCardNumber: null,
        company: null,
        creditCode: null,
        legalRep: null,
        source: 'ONLINE',
        tags: ['新客户'],
        status: 'ACTIVE',
        notes: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })
    );
  });

  describe('GET /api/clients', () => {
    it('应该返回客户列表', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/clients?page=1&limit=20'
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.clients).toHaveLength(1);
      expect(testResponse.data.total).toBe(1);
      expect(testResponse.meta.pagination.page).toBe(1);
      expect(testResponse.meta.pagination.limit).toBe(20);
    });

    it('应该支持按客户类型筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/clients?clientType=INDIVIDUAL'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect((mockedPrisma as any).client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientType: 'INDIVIDUAL',
          }),
        })
      );
    });

    it('应该支持按状态筛选', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/clients?status=ACTIVE'
      );
      const response = await GET(request);
      await createTestResponse(response);

      expect((mockedPrisma as any).client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/clients');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/clients', () => {
    it('应该创建个人客户', async () => {
      const clientData = {
        clientType: 'INDIVIDUAL',
        name: '王五',
        gender: '男',
        age: 35,
        phone: '13700137000',
        email: 'wangwu@example.com',
      };

      const request = createMockRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: clientData,
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.name).toBe('王五');
      expect(testResponse.data.clientType).toBe('INDIVIDUAL');
    });

    it('应该验证必填字段', async () => {
      const clientData = {
        clientType: 'INDIVIDUAL',
      };

      const request = createMockRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: clientData,
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const clientData = {
        clientType: 'INDIVIDUAL',
        name: '测试客户',
      };

      const request = createMockRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: clientData,
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/clients/[id]', () => {
    it('应该返回客户详情', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/clients/client-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.id).toBe('client-1');
      expect(testResponse.data.name).toBe('张三');
    });

    it('应该在未包含include参数时不返回案件历史', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/clients/client-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.caseHistory).toBeUndefined();
    });

    it('应该在客户不存在时返回404错误', async () => {
      (mockedPrisma as any).client.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/clients/not-exist'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'not-exist' }),
      });

      expect(response.status).toBe(404);
    });

    it('应该在未认证时返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/clients/client-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该验证用户权限', async () => {
      (mockedPrisma as any).client.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/clients/client-1'
      );
      const response = await GET_BY_ID(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/clients/[id]', () => {
    it('应该更新客户信息', async () => {
      const updateData = {
        name: '李四',
        phone: '13900139000',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/clients/client-1',
        {
          method: 'PATCH',
          body: updateData,
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.name).toBe('李四');
    });

    it('应该在客户不存在时返回404错误', async () => {
      (mockedPrisma as any).client.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/clients/not-exist',
        {
          method: 'PATCH',
          body: { name: '测试' },
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
        'http://localhost:3000/api/clients/client-1',
        {
          method: 'PATCH',
          body: { name: '测试' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该验证用户权限', async () => {
      (mockedPrisma as any).client.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/clients/client-1',
        {
          method: 'PATCH',
          body: { name: '测试' },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/clients/[id]', () => {
    it('应该软删除客户', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/clients/client-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });

      assertions.assertNoContent(response);
      expect((mockedPrisma as any).client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          deletedAt: expect.any(Date),
        },
      });
    });

    it('应该在客户不存在时返回404错误', async () => {
      (mockedPrisma as any).client.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/clients/not-exist',
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
        'http://localhost:3000/api/clients/client-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });

      expect(response.status).toBe(401);
    });

    it('应该验证用户权限', async () => {
      (mockedPrisma as any).client.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/clients/client-1',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'client-1' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('OPTIONS /api/clients', () => {
    it('应该返回CORS头部', async () => {
      const request = createMockRequest('http://localhost:3000/api/clients', {
        method: 'OPTIONS',
      });
      const response = await OPTIONS_LIST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type'
      );
    });
  });

  describe('OPTIONS /api/clients/[id]', () => {
    it('应该返回CORS头部', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/clients/client-1',
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
