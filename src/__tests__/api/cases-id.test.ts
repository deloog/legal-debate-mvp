import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { GET, PUT, DELETE, OPTIONS } from '@/app/api/v1/cases/[id]/route';
import {
  createMockRequest,
  createTestResponse,
  assertions,
} from './test-utils';

// Mock authentication middleware
const mockGetAuthUser = jest.fn();
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: () => mockGetAuthUser(),
}));

// Mock permission middleware
const mockCheckResourceOwnership = jest.fn();
const mockCreatePermissionErrorResponse = jest.fn();
jest.mock('@/lib/middleware/resource-permission', () => ({
  checkResourceOwnership: () => mockCheckResourceOwnership(),
  createPermissionErrorResponse: (reason: string) =>
    mockCreatePermissionErrorResponse(reason),
  ResourceType: {
    CASE: 'CASE',
  },
}));

// Set default mock implementation
mockCreatePermissionErrorResponse.mockImplementation((reason: string) => {
  return new Response(JSON.stringify({ error: '权限不足', message: reason }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
});

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    document: {
      findMany: jest.fn(),
    },
    debate: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// Type assertion for mocked prisma
const mockedPrisma = prisma as any;

describe('Cases ID API', () => {
  const mockCaseId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    (mockGetAuthUser as jest.MockedFunction<any>).mockResolvedValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'USER',
    });
    (mockCheckResourceOwnership as jest.MockedFunction<any>).mockResolvedValue({
      hasPermission: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/cases/[id]', () => {
    it('should return case details', async () => {
      const mockCase = {
        id: mockCaseId,
        title: '合同纠纷案件',
        description: '涉及买卖合同违约的纠纷案件',
        type: 'CIVIL',
        status: 'ACTIVE',
        amount: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
        documents: [],
        debates: [],
        user: {
          id: 'user-123',
          username: 'testuser',
          name: '测试用户',
          email: 'test@example.com',
        },
      };

      mockedPrisma.case.findUnique.mockResolvedValue(mockCase);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.id).toBe(mockCaseId);
      expect(testResponse.data.title).toBe(mockCase.title);
    });

    it('should handle invalid UUID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases/invalid-id'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid-id' }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it('should return 404 for non-existent case', async () => {
      mockedPrisma.case.findUnique.mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/cases/[id]', () => {
    it('should update case successfully', async () => {
      const updateData = {
        title: '更新后的案件标题',
        description: '更新后的案件描述',
        type: 'criminal' as const,
      };

      const existingCase = {
        id: mockCaseId,
        title: '原标题',
        type: 'CIVIL',
        status: 'ACTIVE',
      };

      const updatedCase = {
        ...existingCase,
        ...updateData,
        updatedAt: new Date(),
      };

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      mockedPrisma.case.findUnique.mockResolvedValue(existingCase);
      mockedPrisma.case.update.mockResolvedValue(updatedCase);

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.id).toBe(mockCaseId);
      expect(testResponse.data.title).toBe(updateData.title);
    });

    it('should return 404 when updating non-existent case', async () => {
      const updateData = { title: '更新标题' };

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      mockedPrisma.case.findUnique.mockResolvedValue(null);

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(404);
    });

    it('should validate update data', async () => {
      const invalidData = {
        title: '', // 空标题应该失败
        type: 'invalid-type',
      };

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        {
          method: 'PUT',
          body: invalidData,
        }
      );

      mockedPrisma.case.findUnique.mockResolvedValue({ id: mockCaseId } as any);

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(400);
    });

    it('should validate UUID format', async () => {
      const { PUT } = await import('@/app/api/v1/cases/[id]/route');
      const response = await PUT(
        {
          ...(createMockRequest(
            'http://localhost:3000/api/v1/cases/invalid-uuid',
            { method: 'PUT', body: { title: 'test' } }
          ) as any),
        } as any,
        { params: Promise.resolve({ id: 'invalid-uuid' }) }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/cases/[id]', () => {
    it('should delete case successfully', async () => {
      const existingCase = {
        id: mockCaseId,
        title: '要删除的案件',
      };

      mockedPrisma.case.findUnique.mockResolvedValue(existingCase);
      mockedPrisma.case.update.mockResolvedValue({
        ...existingCase,
        deletedAt: new Date(),
      });

      const { DELETE } = await import('@/app/api/v1/cases/[id]/route');
      const response = await DELETE(
        createMockRequest(`http://localhost:3000/api/v1/cases/${mockCaseId}`, {
          method: 'DELETE',
        }) as any,
        { params: Promise.resolve({ id: mockCaseId }) }
      );

      expect(response.status).toBe(204);
    });

    it('should return 404 when deleting non-existent case', async () => {
      mockedPrisma.case.findUnique.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/v1/cases/[id]/route');
      const response = await DELETE(
        createMockRequest(`http://localhost:3000/api/v1/cases/${mockCaseId}`, {
          method: 'DELETE',
        }) as any,
        { params: Promise.resolve({ id: mockCaseId }) }
      );

      expect(response.status).toBe(404);
    });

    it('should validate UUID format', async () => {
      const { DELETE } = await import('@/app/api/v1/cases/[id]/route');
      const response = await DELETE(
        createMockRequest('http://localhost:3000/api/v1/cases/invalid-uuid', {
          method: 'DELETE',
        }) as any,
        { params: Promise.resolve({ id: 'invalid-uuid' }) }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('OPTIONS /api/v1/cases/[id]', () => {
    it('should return CORS headers', async () => {
      const { OPTIONS } = await import('@/app/api/v1/cases/[id]/route');
      const response = await OPTIONS(
        createMockRequest('http://localhost:3000/api/v1/cases/test', {
          method: 'OPTIONS',
        }) as any
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, PUT, DELETE, OPTIONS'
      );
    });
  });
});
