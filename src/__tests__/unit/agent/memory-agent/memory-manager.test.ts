/**
 * MemoryManager - 单元测试
 * 测试三层记忆CRUD操作
 */

// Mock uuid模块
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-v4'),
}));

import { PrismaClient, AgentMemory, MemoryType } from '@prisma/client';
import { MemoryManager } from '@/lib/agent/memory-agent';

// Mock PrismaClient with proper types
const mockPrisma = {
  agentMemory: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
} as unknown as PrismaClient;

// Type-safe mock setup helpers
const mockAgentMemory = mockPrisma.agentMemory as unknown as {
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
};

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    jest.clearAllMocks();
    memoryManager = new MemoryManager(mockPrisma);
  });

  describe('Working Memory CRUD', () => {
    it('应该能够存储Working Memory', async () => {
      const mockMemory: Partial<AgentMemory> = {
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: 'test_key',
        memoryValue: JSON.stringify({ data: 'test' }),
        memoryType: 'WORKING' as MemoryType,
        importance: 0.5,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockAgentMemory.findFirst.mockResolvedValue(null);
      mockAgentMemory.create.mockResolvedValue(mockMemory);

      await memoryManager.storeWorkingMemory(
        'test_key',
        { data: 'test' },
        'user1'
      );

      expect(mockAgentMemory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          memoryType: 'WORKING',
          memoryKey: 'test_key',
          memoryValue: JSON.stringify({ data: 'test' }),
          userId: 'user1',
        }),
      });
    });

    it('应该能够获取Working Memory', async () => {
      const mockMemory: Partial<AgentMemory> = {
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: 'test_key',
        memoryValue: JSON.stringify({ data: 'test' }),
        memoryType: 'WORKING' as MemoryType,
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockAgentMemory.findFirst.mockResolvedValue(mockMemory);
      mockAgentMemory.update.mockResolvedValue({
        ...mockMemory,
        accessCount: 2,
      });

      const result = await memoryManager.getWorkingMemory('test_key');

      expect(result).toEqual({ data: 'test' });
      expect(mockAgentMemory.update).toHaveBeenCalledWith({
        where: { id: 'mem1' },
        data: expect.objectContaining({
          accessCount: { increment: 1 },
        }),
      });
    });

    it('应该能够删除Working Memory', async () => {
      mockAgentMemory.deleteMany.mockResolvedValue({ count: 1 });

      await memoryManager.deleteWorkingMemory('test_key');

      expect(mockAgentMemory.deleteMany).toHaveBeenCalledWith({
        where: {
          agentName: 'MemoryAgent',
          memoryKey: 'test_key',
          memoryType: 'WORKING',
        },
      });
    });

    it('应该返回null对于不存在的记忆', async () => {
      mockAgentMemory.findFirst.mockResolvedValue(null);

      const result = await memoryManager.getWorkingMemory('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('Hot Memory CRUD', () => {
    it('应该能够存储Hot Memory', async () => {
      const mockMemory: Partial<AgentMemory> = {
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: 'hot_key',
        memoryValue: JSON.stringify({ data: 'hot' }),
        memoryType: 'HOT' as MemoryType,
        importance: 0.8,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 604800000),
      };

      mockAgentMemory.findFirst.mockResolvedValue(null);
      mockAgentMemory.create.mockResolvedValue(mockMemory);

      await memoryManager.storeHotMemory(
        'hot_key',
        { data: 'hot' },
        'user1',
        0.8
      );

      expect(mockAgentMemory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          memoryType: 'HOT',
          memoryKey: 'hot_key',
          importance: 0.8,
        }),
      });
    });

    it('应该能够获取Hot Memory', async () => {
      const mockMemory: Partial<AgentMemory> = {
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: 'hot_key',
        memoryValue: JSON.stringify({ data: 'hot' }),
        memoryType: 'HOT' as MemoryType,
        importance: 0.8,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 604800000),
      };

      mockAgentMemory.findFirst.mockResolvedValue(mockMemory);
      mockAgentMemory.update.mockResolvedValue(mockMemory);

      const result = await memoryManager.getHotMemory('hot_key');

      expect(result).toEqual({ data: 'hot' });
    });

    it('应该能够更新Hot Memory', async () => {
      mockAgentMemory.updateMany.mockResolvedValue({ count: 1 });

      await memoryManager.updateHotMemory('hot_key', { data: 'updated' });

      expect(mockAgentMemory.updateMany).toHaveBeenCalledWith({
        where: {
          agentName: 'MemoryAgent',
          memoryKey: 'hot_key',
          memoryType: 'HOT',
        },
        data: expect.objectContaining({
          memoryValue: JSON.stringify({ data: 'updated' }),
        }),
      });
    });
  });

  describe('Cold Memory CRUD', () => {
    it('应该能够存储Cold Memory', async () => {
      const mockMemory: Partial<AgentMemory> = {
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: 'cold_key',
        memoryValue: JSON.stringify({ data: 'cold' }),
        memoryType: 'COLD' as MemoryType,
        importance: 1.0,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      };

      mockAgentMemory.findFirst.mockResolvedValue(null);
      mockAgentMemory.create.mockResolvedValue(mockMemory);

      await memoryManager.storeColdMemory(
        'cold_key',
        { data: 'cold' },
        'user1'
      );

      expect(mockAgentMemory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          memoryType: 'COLD',
          memoryKey: 'cold_key',
          importance: 1.0,
          expiresAt: null,
        }),
      });
    });

    it('应该能够获取Cold Memory', async () => {
      const mockMemory: Partial<AgentMemory> = {
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: 'cold_key',
        memoryValue: JSON.stringify({ data: 'cold' }),
        memoryType: 'COLD' as MemoryType,
        importance: 1.0,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      };

      mockAgentMemory.findFirst.mockResolvedValue(mockMemory);
      mockAgentMemory.update.mockResolvedValue(mockMemory);

      const result = await memoryManager.getColdMemory('cold_key');

      expect(result).toEqual({ data: 'cold' });
    });
  });

  describe('记忆过期', () => {
    it('应该自动过滤过期的记忆', async () => {
      mockAgentMemory.findFirst.mockResolvedValue(null);

      const result = await memoryManager.getMemory({
        memoryType: 'WORKING',
        memoryKey: 'expired',
      });

      expect(result).toBeNull();
    });

    it('应该能够清理过期记忆', async () => {
      mockAgentMemory.deleteMany.mockResolvedValue({ count: 10 });

      const count = await memoryManager.cleanExpired();

      expect(count).toBe(10);
      expect(mockPrisma.agentMemory.deleteMany).toHaveBeenCalledWith({
        where: {
          agentName: 'MemoryAgent',
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('访问计数追踪', () => {
    it('应该正确追踪访问次数', async () => {
      const mockMemory: Partial<AgentMemory> = {
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: 'test_key',
        memoryValue: JSON.stringify({ data: 'test' }),
        memoryType: 'WORKING' as MemoryType,
        importance: 0.5,
        accessCount: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockAgentMemory.findFirst.mockResolvedValue(mockMemory);
      mockAgentMemory.update.mockResolvedValue({
        ...mockMemory,
        accessCount: 6,
        lastAccessedAt: new Date(),
      });

      await memoryManager.getWorkingMemory('test_key');

      expect(mockAgentMemory.update).toHaveBeenCalledWith({
        where: { id: 'mem1' },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: expect.any(Date),
        },
      });
    });
  });

  describe('统计信息', () => {
    it('应该能够获取记忆统计信息', async () => {
      mockAgentMemory.count.mockResolvedValueOnce(10); // working
      mockAgentMemory.count.mockResolvedValueOnce(20); // hot
      mockAgentMemory.count.mockResolvedValueOnce(30); // cold
      mockAgentMemory.count.mockResolvedValueOnce(60); // total
      mockAgentMemory.aggregate.mockResolvedValue({
        _avg: { importance: 0.7 },
      });
      mockAgentMemory.count.mockResolvedValueOnce(15); // compressed
      mockAgentMemory.count.mockResolvedValueOnce(5); // expired

      const stats = await memoryManager.getStats();

      expect(stats.workingMemoryCount).toBe(10);
      expect(stats.hotMemoryCount).toBe(20);
      expect(stats.coldMemoryCount).toBe(30);
      expect(stats.totalMemoryCount).toBe(60);
      expect(stats.averageImportance).toBe(0.7);
      expect(stats.compressedMemoryCount).toBe(15);
      expect(stats.expiredMemoryCount).toBe(5);
    });
  });

  describe('边界条件', () => {
    it('应该处理空键值', async () => {
      mockAgentMemory.findFirst.mockResolvedValue(null);
      mockAgentMemory.create.mockResolvedValue({
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: '',
        memoryValue: JSON.stringify(null),
        memoryType: 'WORKING' as MemoryType,
        importance: 0.5,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      await memoryManager.storeWorkingMemory('', null, 'user1');

      expect(mockAgentMemory.create).toHaveBeenCalled();
    });

    it('应该处理大数据存储', async () => {
      const bigData = { items: Array(1000).fill({ data: 'test' }) };

      mockAgentMemory.findFirst.mockResolvedValue(null);
      mockAgentMemory.create.mockResolvedValue({
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: 'big_data',
        memoryValue: JSON.stringify(bigData),
        memoryType: 'WORKING' as MemoryType,
        importance: 0.5,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      });

      await memoryManager.storeWorkingMemory('big_data', bigData, 'user1');

      expect(mockAgentMemory.create).toHaveBeenCalled();
    });

    it('应该处理JSON解析错误', async () => {
      const invalidMemory: Partial<AgentMemory> = {
        id: 'mem1',
        agentName: 'MemoryAgent',
        memoryKey: 'test_key',
        memoryValue: 'invalid json',
        memoryType: 'WORKING' as MemoryType,
        importance: 0.5,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockAgentMemory.findFirst.mockResolvedValue(invalidMemory);

      await expect(
        memoryManager.getWorkingMemory('test_key')
      ).rejects.toThrow();
    });
  });
});
