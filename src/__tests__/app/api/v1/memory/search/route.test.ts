/**
 * Memory Search API 测试
 * TDD Step 1 (Red): 编写失败的测试
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/memory/search/route';
import { prisma } from '@/lib/db/prisma';
import { MemoryType } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    agentMemory: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock Auth
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';

describe('GET /api/v1/memory/search', () => {
  const mockMemories = [
    {
      id: 'mem_1',
      memoryType: MemoryType.WORKING,
      memoryKey: 'case:123:context',
      memoryValue: { data: 'test value 1' },
      importance: 0.9,
      accessCount: 5,
      lastAccessedAt: new Date('2026-03-30'),
      expiresAt: new Date('2026-04-01'),
      compressed: false,
      compressionRatio: null,
      createdAt: new Date('2026-03-29'),
      updatedAt: new Date('2026-03-30'),
    },
    {
      id: 'mem_2',
      memoryType: MemoryType.HOT,
      memoryKey: 'case:456:summary',
      memoryValue: { data: 'test value 2' },
      importance: 0.7,
      accessCount: 3,
      lastAccessedAt: new Date('2026-03-28'),
      expiresAt: new Date('2026-04-15'),
      compressed: false,
      compressionRatio: null,
      createdAt: new Date('2026-03-25'),
      updatedAt: new Date('2026-03-28'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock admin user
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'admin_123',
      role: 'ADMIN',
    });
    // Mock admin role check
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      role: 'ADMIN',
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 if not authenticated', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search'
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未授权');
    });

    it('should return 403 if not admin', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue({
        userId: 'user_123',
        role: 'USER',
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'USER',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('权限不足');
    });
  });

  describe('Search Functionality', () => {
    it('should return all memories when no filters applied', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue(
        mockMemories
      );
      (prisma.agentMemory.count as jest.Mock).mockResolvedValue(2);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.memories).toHaveLength(2);
      expect(data.data.pagination.total).toBe(2);
    });

    it('should filter by memory type (WORKING)', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue([
        mockMemories[0],
      ]);
      (prisma.agentMemory.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search?type=WORKING'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.memories).toHaveLength(1);
      expect(data.data.memories[0].memoryType).toBe('WORKING');
    });

    it('should filter by memory type (HOT)', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue([
        mockMemories[1],
      ]);
      (prisma.agentMemory.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search?type=HOT'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.memories).toHaveLength(1);
      expect(data.data.memories[0].memoryType).toBe('HOT');
    });

    it('should search by keyword in memoryKey', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue([
        mockMemories[0],
      ]);
      (prisma.agentMemory.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search?keyword=case:123'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(prisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memoryKey: { contains: 'case:123', mode: 'insensitive' },
          }),
        })
      );
    });

    it('should filter expired memories when expired=true', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.agentMemory.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search?expired=true'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiresAt: { lt: expect.any(Date) },
          }),
        })
      );
    });

    it('should support pagination', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue([
        mockMemories[0],
      ]);
      (prisma.agentMemory.count as jest.Mock).mockResolvedValue(10);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search?page=1&pageSize=5'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.pageSize).toBe(5);
      expect(data.data.pagination.total).toBe(10);
      expect(data.data.pagination.totalPages).toBe(2);
    });

    it('should sort by lastAccessedAt descending by default', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue(
        mockMemories
      );
      (prisma.agentMemory.count as jest.Mock).mockResolvedValue(2);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search'
      );
      await GET(request);

      expect(prisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { lastAccessedAt: 'desc' },
        })
      );
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted memory objects', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue(
        mockMemories
      );
      (prisma.agentMemory.count as jest.Mock).mockResolvedValue(2);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search'
      );
      const response = await GET(request);
      const data = await response.json();

      const memory = data.data.memories[0];
      expect(memory).toHaveProperty('id');
      expect(memory).toHaveProperty('memoryType');
      expect(memory).toHaveProperty('memoryKey');
      expect(memory).toHaveProperty('memoryValue');
      expect(memory).toHaveProperty('importance');
      expect(memory).toHaveProperty('accessCount');
      expect(memory).toHaveProperty('lastAccessedAt');
      expect(memory).toHaveProperty('expiresAt');
      expect(memory).toHaveProperty('compressed');
      expect(memory).toHaveProperty('createdAt');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/search'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('搜索记忆失败');
    });
  });
});
