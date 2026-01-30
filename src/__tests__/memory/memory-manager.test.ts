/**
 * MemoryManager单元测试
 * 测试三层记忆管理：Working、Hot、Cold Memory
 */

import { MemoryManager } from '@/lib/agent/memory-agent/memory-manager';
import { PrismaClient } from '@prisma/client';
import { createMockAgentMemoryDB } from './test-helpers';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      agentMemory: createMockAgentMemoryDB(),
    })),
  };
});

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let mockPrisma: ReturnType<typeof createMockAgentMemoryDB>;

  beforeEach(() => {
    // 创建MemoryManager实例
    const prisma = new PrismaClient();
    memoryManager = new MemoryManager(prisma);
    mockPrisma = prisma.agentMemory as any;

    // 清理所有Mock
    jest.clearAllMocks();
  });

  describe('Working Memory测试', () => {
    it('应该成功存储Working Memory', async () => {
      const userId = 'test-user-1';
      const caseId = 'test-case-1';
      const key = 'test-working-key';
      const value = { data: 'working data' };

      await memoryManager.storeWorkingMemory(key, value, userId, caseId);

      expect(mockPrisma.create).toHaveBeenCalled();
    });

    it('应该成功读取Working Memory', async () => {
      const key = 'test-working-key';
      const expectedValue = { data: 'working data' };

      // Mock返回数据
      mockPrisma.findFirst.mockResolvedValueOnce({
        id: 'mock-id',
        memoryKey: key,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(expectedValue),
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await memoryManager.getWorkingMemory(key);

      expect(result).toEqual(expectedValue);
    });

    it('应该成功删除Working Memory', async () => {
      const key = 'test-working-key';

      await memoryManager.deleteWorkingMemory(key);

      expect(mockPrisma.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memoryKey: key,
            memoryType: 'WORKING',
          }),
        })
      );
    });

    it('应该处理不存在的Working Memory', async () => {
      const key = 'non-existent-key';

      // Mock返回null
      mockPrisma.findFirst.mockResolvedValueOnce(null);

      const result = await memoryManager.getWorkingMemory(key);

      expect(result).toBeUndefined();
    });
  });

  describe('Hot Memory测试', () => {
    it('应该成功存储Hot Memory', async () => {
      const userId = 'test-user-2';
      const caseId = 'test-case-2';
      const key = 'test-hot-key';
      const value = { data: 'hot data' };
      const importance = 0.8;

      await memoryManager.storeHotMemory(
        key,
        value,
        userId,
        importance,
        caseId
      );

      expect(mockPrisma.create).toHaveBeenCalled();
    });

    it('应该成功读取Hot Memory', async () => {
      const key = 'test-hot-key';
      const expectedValue = { data: 'hot data' };

      mockPrisma.findFirst.mockResolvedValueOnce({
        id: 'mock-id',
        memoryKey: key,
        memoryType: 'HOT',
        memoryValue: JSON.stringify(expectedValue),
        importance: 0.8,
        accessCount: 5,
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 604800000),
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await memoryManager.getHotMemory(key);

      expect(result).toEqual(expectedValue);
    });

    it('应该成功更新Hot Memory', async () => {
      const key = 'test-hot-key';
      const newValue = { data: 'updated hot data' };

      await memoryManager.updateHotMemory(key, newValue);

      expect(mockPrisma.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memoryKey: key,
            memoryType: 'HOT',
          }),
          data: expect.objectContaining({
            memoryValue: JSON.stringify(newValue),
          }),
        })
      );
    });

    it('应该处理不存在的Hot Memory', async () => {
      const key = 'non-existent-hot-key';
      mockPrisma.findFirst.mockResolvedValueOnce(null);

      const result = await memoryManager.getHotMemory(key);

      expect(result).toBeUndefined();
    });
  });

  describe('Cold Memory测试', () => {
    it('应该成功存储Cold Memory', async () => {
      const userId = 'test-user-3';
      const key = 'test-cold-key';
      const value = { data: 'cold data' };

      await memoryManager.storeColdMemory(key, value, userId);

      expect(mockPrisma.create).toHaveBeenCalled();
    });

    it('应该成功读取Cold Memory', async () => {
      const key = 'test-cold-key';
      const expectedValue = { data: 'cold data' };

      mockPrisma.findFirst.mockResolvedValueOnce({
        id: 'mock-id',
        memoryKey: key,
        memoryType: 'COLD',
        memoryValue: JSON.stringify(expectedValue),
        importance: 1.0,
        accessCount: 10,
        lastAccessedAt: new Date(),
        expiresAt: null,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await memoryManager.getColdMemory(key);

      expect(result).toEqual(expectedValue);
    });

    it('应该永久保存Cold Memory', async () => {
      const userId = 'test-user-3';
      const key = 'test-cold-key';
      const value = { data: 'cold data' };

      await memoryManager.storeColdMemory(key, value, userId);

      expect(mockPrisma.create).toHaveBeenCalled();
    });
  });

  describe('通用功能测试', () => {
    it('应该正确解析JSON存储的值', async () => {
      const key = 'test-json-key';
      const value = { nested: { data: 'test', array: [1, 2, 3] } };

      mockPrisma.findFirst.mockResolvedValueOnce({
        id: 'mock-id',
        memoryKey: key,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(value),
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        expiresAt: new Date(),
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await memoryManager.getWorkingMemory(key);

      expect(result).toEqual(value);
    });

    it('应该返回null当记忆不存在时', async () => {
      mockPrisma.findFirst.mockResolvedValueOnce(null);

      const result = await memoryManager.getMemory({
        memoryType: 'WORKING',
        memoryKey: 'non-existent',
      });

      expect(result).toBeNull();
    });

    it('应该返回null当记忆已过期时', async () => {
      const key = 'expired-key';

      // MemoryManager的findFirst查询会过滤掉过期记录
      // 所以这里模拟findFirst返回null（因为过期记录被过滤了）
      mockPrisma.findFirst.mockResolvedValueOnce(null);

      const result = await memoryManager.getMemory({
        memoryType: 'WORKING',
        memoryKey: key,
      });

      expect(result).toBeNull();
    });

    it('应该按类型获取记忆', async () => {
      const memories = [
        {
          id: 'mock-id-1',
          memoryKey: 'key-1',
          memoryType: 'WORKING',
          memoryValue: JSON.stringify({ data: 'test1' }),
          importance: 0.5,
          accessCount: 1,
          lastAccessedAt: new Date(),
          expiresAt: new Date(),
          compressed: false,
          compressionRatio: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'mock-id-2',
          memoryKey: 'key-2',
          memoryType: 'WORKING',
          memoryValue: JSON.stringify({ data: 'test2' }),
          importance: 0.7,
          accessCount: 2,
          lastAccessedAt: new Date(Date.now() - 1000),
          expiresAt: new Date(),
          compressed: false,
          compressionRatio: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.findMany.mockResolvedValueOnce(memories);

      const result = await memoryManager.getMemoriesByType('WORKING');

      expect(result).toHaveLength(2);
    });

    it('应该清理过期记忆', async () => {
      mockPrisma.deleteMany.mockResolvedValue({ count: 5 });

      const count = await memoryManager.cleanExpired();

      expect(count).toBe(5);
      expect(mockPrisma.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiresAt: expect.objectContaining({
              lt: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('应该通过ID获取记忆', async () => {
      const memoryId = 'test-memory-id';
      const expectedValue = { data: 'test' };

      mockPrisma.findFirst.mockResolvedValueOnce({
        id: memoryId,
        memoryKey: 'test-key',
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(expectedValue),
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        expiresAt: new Date(),
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await memoryManager.getMemoryById(memoryId);

      expect(result).toEqual({
        memoryId,
        memoryType: 'WORKING',
        memoryKey: 'test-key',
        memoryValue: expectedValue,
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: expect.any(Date),
        expiresAt: expect.any(Date),
        compressed: false,
        compressionRatio: undefined,
        createdAt: expect.any(Date),
      });
    });

    it('应该通过ID获取记忆（包含元数据）', async () => {
      const memoryId = 'test-memory-id';
      const userId = 'test-user';
      const caseId = 'test-case';

      mockPrisma.findFirst.mockResolvedValueOnce({
        id: memoryId,
        userId,
        caseId,
        debateId: null,
        memoryKey: 'test-key',
        memoryType: 'WORKING',
        memoryValue: JSON.stringify({ data: 'test' }),
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        expiresAt: new Date(),
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await memoryManager.getMemoryWithMetadata(memoryId);

      expect(result).toEqual({
        memoryId,
        memoryType: 'WORKING',
        memoryKey: 'test-key',
        memoryValue: { data: 'test' },
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: expect.any(Date),
        expiresAt: expect.any(Date),
        compressed: false,
        compressionRatio: undefined,
        createdAt: expect.any(Date),
        userId,
        caseId,
        debateId: null,
      });
    });

    it('应该获取记忆统计信息', async () => {
      mockPrisma.count.mockResolvedValueOnce(10); // working
      mockPrisma.count.mockResolvedValueOnce(20); // hot
      mockPrisma.count.mockResolvedValueOnce(30); // cold
      mockPrisma.count.mockResolvedValueOnce(60); // total
      mockPrisma.aggregate.mockResolvedValueOnce({
        _avg: { importance: 0.6 },
      });
      mockPrisma.count.mockResolvedValueOnce(5); // compressed

      const stats = await memoryManager.getStats();

      expect(stats).toEqual({
        workingMemoryCount: 10,
        hotMemoryCount: 20,
        coldMemoryCount: 30,
        totalMemoryCount: 60,
        averageImportance: 0.6,
        expiredMemoryCount: 0, // 需要额外mock
        compressedMemoryCount: 5,
      });
    });

    it('应该标记记忆为已压缩', async () => {
      const memoryId = 'test-memory-id';
      const compressionRatio = 0.5;

      await memoryManager.markAsCompressed(memoryId, compressionRatio);

      expect(mockPrisma.update).toHaveBeenCalledWith({
        where: { id: memoryId },
        data: {
          compressed: true,
          compressionRatio,
          updatedAt: expect.any(Date),
        },
      });
    });
  });
});
