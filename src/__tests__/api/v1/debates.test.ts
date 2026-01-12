import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { GET, POST, OPTIONS } from '@/app/api/v1/debates/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { DebateStatus } from '@prisma/client';

describe('Debates API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/debates', () => {
    it('应该返回辩论列表', async () => {
      const mockRequest = {
        url: new URL('http://localhost:3000/api/v1/debates'),
      } as unknown as NextRequest;

      const mockPrismaFindMany = jest
        .spyOn(prisma.debate, 'findMany')
        .mockResolvedValue([]);
      const mockPrismaCount = jest
        .spyOn(prisma.debate, 'count')
        .mockResolvedValue(0);

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');

      mockPrismaFindMany.mockRestore();
      mockPrismaCount.mockRestore();
    });

    it('应该支持分页参数', async () => {
      const mockRequest = {
        url: new URL('http://localhost:3000/api/v1/debates?page=1&limit=10'),
      } as unknown as NextRequest;

      jest.spyOn(prisma.debate, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.debate, 'count').mockResolvedValue(0);

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta).toHaveProperty('pagination');
    });

    it('应该支持搜索功能', async () => {
      const mockRequest = {
        url: new URL('http://localhost:3000/api/v1/debates?search=合同'),
      } as unknown as NextRequest;

      jest.spyOn(prisma.debate, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.debate, 'count').mockResolvedValue(0);

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该计算正确的分页信息', async () => {
      const mockRequest = {
        url: new URL('http://localhost:3000/api/v1/debates?page=1&limit=10'),
      } as unknown as NextRequest;

      jest.spyOn(prisma.debate, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.debate, 'count').mockResolvedValue(25);

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(data.meta.pagination).toBeDefined();
      expect(data.meta.pagination.page).toBe(1);
      expect(data.meta.pagination.limit).toBe(10);
      expect(data.meta.pagination.total).toBe(25);
      expect(data.meta.pagination.totalPages).toBe(3);
      expect(data.meta.pagination.hasNext).toBe(true);
      expect(data.meta.pagination.hasPrev).toBe(false);
    });
  });

  describe('POST /api/v1/debates', () => {
    it('应该创建新辩论', async () => {
      const requestBody = {
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        title: '测试辩论',
        status: DebateStatus.DRAFT,
      };

      const mockRequest = {
        json: async () => requestBody,
        url: 'http://localhost:3000/api/v1/debates',
        headers: {
          get: jest.fn(),
        },
      } as unknown as NextRequest;

      jest.spyOn(prisma.case, 'findUnique').mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'test-user-id',
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL' as const,
        status: 'ACTIVE' as const,
        metadata: {},
        plaintiffName: '原告',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as never);

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        id: 'user-id',
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        role: 'USER' as const,
        permissions: {},
        preferences: {},
      } as never);

      jest.spyOn(prisma.debate, 'create').mockResolvedValue({
        id: '987e6543-e89b-12d3-a456-426614174001',
        caseId: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user-id',
        title: '测试辩论',
        status: DebateStatus.DRAFT,
        currentRound: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        debateConfig: {},
      } as never);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('success', true);
    });

    it('应该返回404当案件不存在', async () => {
      const requestBody = {
        caseId: '00000000-0000-0000-0000-000000000000',
        title: '测试辩论',
      };

      const mockRequest = {
        json: async () => requestBody,
        url: 'http://localhost:3000/api/v1/debates',
        headers: {
          get: jest.fn(),
        },
      } as unknown as NextRequest;

      jest.spyOn(prisma.case, 'findUnique').mockResolvedValue(null);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该创建默认状态为DRAFT', async () => {
      const requestBody = {
        caseId: '123e4567-e89b-12d3-a456-426614174002',
        title: '测试辩论',
      };

      const mockRequest = {
        json: async () => requestBody,
        url: 'http://localhost:3000/api/v1/debates',
        headers: {
          get: jest.fn(),
        },
      } as unknown as NextRequest;

      jest.spyOn(prisma.case, 'findUnique').mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174002',
        userId: 'test-user-id',
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL' as const,
        status: 'ACTIVE' as const,
        metadata: {},
        plaintiffName: '原告',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as never);

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        id: 'user-id',
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        name: 'Test User',
        email: 'test@example.com',
        username: 'testuser',
        role: 'USER' as const,
        permissions: {},
        preferences: {},
      } as never);

      jest.spyOn(prisma.debate, 'create').mockResolvedValue({
        id: '987e6543-e89b-12d3-a456-426614174002',
        caseId: '123e4567-e89b-12d3-a456-426614174002',
        userId: 'user-id',
        title: '测试辩论',
        status: DebateStatus.DRAFT,
        currentRound: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        debateConfig: {},
      } as never);

      const response = await POST(mockRequest);

      expect(response.status).toBe(201);
    });
  });

  describe('OPTIONS /api/v1/debates', () => {
    it('应该返回CORS头', async () => {
      const response = await OPTIONS({} as unknown as NextRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization'
      );
    });

    it('应该设置正确的缓存控制', async () => {
      const response = await OPTIONS({} as unknown as NextRequest);

      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });
});
