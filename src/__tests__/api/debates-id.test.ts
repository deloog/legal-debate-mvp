import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
/// <reference path="./test-types.d.ts" />

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
    DEBATE: 'DEBATE',
  },
}));

// Set default mock implementation
mockCreatePermissionErrorResponse.mockImplementation((reason: string) => {
  return new Response(JSON.stringify({ error: '权限不足', message: reason }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
});

// Mock Prisma with any type to avoid complex typing issues
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    debate: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    debateRound: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    argument: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock AI service
jest.mock('@/lib/ai/unified-service', () => ({
  getUnifiedAIService: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';

// Type assertion for mocked prisma
const mockedPrisma = prisma as any;

describe('Debates ID API', () => {
  let mockReq: any;

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
    mockReq = {
      url: 'http://localhost:3000/api/v1/debates/123e4567-e89b-12d3-a456-426614174000',
      json: jest.fn(),
      headers: new Headers(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/debates/[id]', () => {
    it('should return debate details with related data', async () => {
      const mockDebate = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: '测试辩论',
        status: 'active',
        currentRound: 1,
        debateConfig: { maxRounds: 3 },
        createdAt: new Date(),
        updatedAt: new Date(),
        case: {
          id: 'case-123',
          title: '测试案件',
          type: 'civil',
        },
        user: {
          id: 'user-123',
          username: 'testuser',
          name: '测试用户',
        },
        rounds: [
          {
            id: 'round-123',
            roundNumber: 1,
            status: 'completed',
            startedAt: new Date(),
            completedAt: new Date(),
            arguments: [
              {
                id: 'arg-123',
                side: 'PLAINTIFF',
                content: '原告论点',
                type: 'MAIN_POINT',
                confidence: 0.85,
                createdAt: new Date(),
              },
            ],
          },
        ],
        _count: {
          rounds: 1,
          arguments: 1,
        },
      };

      mockReq.url =
        'http://localhost:3000/api/v1/debates/123e4567-e89b-12d3-a456-426614174000';

      mockedPrisma.debate.findUnique.mockResolvedValue(mockDebate);

      const { GET } = await import('@/app/api/v1/debates/[id]/route');
      const response = await GET(mockReq, {
        params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(mockDebate.id);
      expect(data.data.title).toBe(mockDebate.title);
      expect(data.data.case).toBeDefined();
      expect(data.data.user).toBeDefined();
      expect(data.data.rounds).toHaveLength(1);
    });

    it('should return 404 for non-existent debate', async () => {
      mockedPrisma.debate.findUnique.mockResolvedValue(null);

      const { GET } = await import('@/app/api/v1/debates/[id]/route');
      const response = await GET(mockReq, {
        params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
      });

      expect(response.status).toBe(404);
    });

    it('should validate UUID format', async () => {
      const { GET } = await import('@/app/api/v1/debates/[id]/route');
      const response = await GET(
        {
          ...mockReq,
          url: 'http://localhost:3000/api/v1/debates/invalid-uuid',
        },
        { params: Promise.resolve({ id: 'invalid-uuid' }) }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/v1/debates/[id]', () => {
    it('should update debate successfully', async () => {
      const updateData = {
        title: '更新的辩论标题',
        status: 'COMPLETED', // 使用大写状态
        config: {
          // 使用config而不是debateConfig
          maxRounds: 5,
          timePerRound: 45,
        },
      };

      const existingDebate = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: '原辩论标题',
        status: 'IN_PROGRESS', // 使用大写状态
      };

      const updatedDebate = {
        ...existingDebate,
        ...updateData,
        updatedAt: new Date(),
      };

      // @ts-expect-error - testing purpose
      mockReq.json = jest.fn().mockResolvedValue(updateData);
      mockedPrisma.debate.findUnique.mockResolvedValue(existingDebate);
      mockedPrisma.debate.update.mockResolvedValue(updatedDebate);

      const { PUT } = await import('@/app/api/v1/debates/[id]/route');
      const response = await PUT(mockReq, {
        params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe(updateData.title);
      expect(data.data.status).toBe(updateData.status);
    });

    it('should return 404 when updating non-existent debate', async () => {
      const updateData = { title: '更新的标题' };
      // @ts-expect-error - testing purpose
      mockReq.json = jest.fn().mockResolvedValue(updateData);
      mockedPrisma.debate.findUnique.mockResolvedValue(null);

      const { PUT } = await import('@/app/api/v1/debates/[id]/route');
      const response = await PUT(mockReq, {
        params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
      });

      expect(response.status).toBe(404);
    });

    it('should validate update data', async () => {
      const invalidData = {
        title: '', // 空标题应该失败
        status: 'invalid-status',
      };

      // @ts-expect-error - testing purpose
      mockReq.json = jest.fn().mockResolvedValue(invalidData);

      mockedPrisma.debate.findUnique.mockResolvedValue({ id: '123' } as any);

      const { PUT } = await import('@/app/api/v1/debates/[id]/route');
      const response = await PUT(mockReq, {
        params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/debates/[id]', () => {
    it('should delete debate successfully', async () => {
      const existingDebate = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: '要删除的辩论',
      };

      mockedPrisma.debate.findUnique.mockResolvedValue(existingDebate);
      mockedPrisma.debate.update.mockResolvedValue({
        ...existingDebate,
        deletedAt: new Date(),
      });

      const { DELETE } = await import('@/app/api/v1/debates/[id]/route');
      const response = await DELETE(mockReq, {
        params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
      });

      // DELETE返回204 No Content
      expect(response.status).toBe(204);
    });

    it('should return 404 when deleting non-existent debate', async () => {
      mockedPrisma.debate.findUnique.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/v1/debates/[id]/route');
      const response = await DELETE(mockReq, {
        params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
      });

      expect(response.status).toBe(404);
    });

    it('should handle database errors during deletion', async () => {
      mockedPrisma.debate.findUnique.mockResolvedValue({ id: '123' } as any);
      mockedPrisma.debate.update.mockRejectedValue(
        new Error('Database connection failed')
      );

      const { DELETE } = await import('@/app/api/v1/debates/[id]/route');
      const response = await DELETE(mockReq, {
        params: Promise.resolve({ id: '123e4567-e89b-12d3-a456-426614174000' }),
      });

      expect(response.status).toBe(500);
    });
  });

  describe('OPTIONS /api/v1/debates/[id]', () => {
    it('should return correct CORS headers', async () => {
      const { OPTIONS } = await import('@/app/api/v1/debates/[id]/route');
      const response = await OPTIONS(mockReq);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, PUT, DELETE, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization'
      );
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });
});
