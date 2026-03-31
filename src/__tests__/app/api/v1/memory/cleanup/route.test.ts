/**
 * Memory Cleanup API 测试
 * TDD Step 1 (Red): 编写失败的测试
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/memory/cleanup/route';
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
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock Auth
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

// Mock Logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { getAuthUser } from '@/lib/middleware/auth';

describe('POST /api/v1/memory/cleanup', () => {
  const mockExpiredMemories = [
    { id: 'mem_1', memoryKey: 'key1', memoryType: MemoryType.WORKING },
    { id: 'mem_2', memoryKey: 'key2', memoryType: MemoryType.HOT },
    { id: 'mem_3', memoryKey: 'key3', memoryType: MemoryType.COLD },
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
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      const response = await POST(request);

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
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('权限不足');
    });
  });

  describe('Cleanup Modes', () => {
    it('should cleanup expired memories by default', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue(
        mockExpiredMemories
      );
      (prisma.agentMemory.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.deletedCount).toBe(3);
      expect(data.data.mode).toBe('expired');
    });

    it('should support type-specific cleanup', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue([
        mockExpiredMemories[0],
      ]);
      (prisma.agentMemory.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'WORKING' }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.deletedCount).toBe(1);
      expect(data.data.type).toBe('WORKING');
    });

    it('should support cleanup by memoryIds', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue([
        { id: 'mem_1', memoryKey: 'key1' },
        { id: 'mem_2', memoryKey: 'key2' },
      ]);
      (prisma.agentMemory.deleteMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({ memoryIds: ['mem_1', 'mem_2'] }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.deletedCount).toBe(2);
      expect(data.data.mode).toBe('selected');
    });

    it('should support dry-run mode', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue(
        mockExpiredMemories
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({ dryRun: true }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.deletedCount).toBe(0);
      expect(data.data.dryRun).toBe(true);
      expect(data.data.wouldDelete).toBe(3);
      // Should not call deleteMany in dry-run mode
      expect(prisma.agentMemory.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should return 400 for invalid memory type', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({ type: 'INVALID_TYPE' }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid type');
    });

    it('should return 400 for empty memoryIds array', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({ memoryIds: [] }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('memoryIds cannot be empty');
    });

    it('should handle invalid JSON body', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: 'invalid json',
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('Response Format', () => {
    it('should return detailed cleanup result', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockResolvedValue(
        mockExpiredMemories
      );
      (prisma.agentMemory.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      const response = await POST(request);
      const data = await response.json();

      expect(data.data).toHaveProperty('deletedCount');
      expect(data.data).toHaveProperty('mode');
      expect(data.data).toHaveProperty('deletedMemories');
      expect(data.data).toHaveProperty('executionTime');
      expect(Array.isArray(data.data.deletedMemories)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (prisma.agentMemory.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/memory/cleanup',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('清理记忆失败');
    });
  });
});
