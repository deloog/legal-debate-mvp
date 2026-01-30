/**
 * 测试辅助工具 - Memory测试用
 * 提供测试用的工具函数和辅助方法
 */

import type { Memory } from '@/lib/agent/memory-agent/types';
import type { MockAgentMemoryRecord } from './__mocks__/prisma-mock';
import { createMockMemoryRecord } from './__mocks__/prisma-mock';

/**
 * 创建测试用Memory对象
 */
export function createTestMemory(overrides?: Partial<Memory>): Memory {
  const now = new Date();
  return {
    memoryId: 'test-memory-1',
    memoryType: 'WORKING',
    memoryKey: 'test-key',
    memoryValue: { data: 'test' },
    importance: 0.5,
    accessCount: 1,
    lastAccessedAt: now,
    expiresAt: new Date(now.getTime() + 3600000),
    compressed: false,
    compressionRatio: undefined,
    createdAt: now,
    ...overrides,
  };
}

/**
 * 等待指定时间
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建测试用的用户ID
 */
export function createTestUserId(): string {
  return 'test-user-' + Date.now();
}

/**
 * 创建测试用的案件ID
 */
export function createTestCaseId(): string {
  return 'test-case-' + Date.now();
}

/**
 * 创建测试用的辩论ID
 */
export function createTestDebateId(): string {
  return 'test-debate-' + Date.now();
}

/**
 * 验证Memory对象
 */
export function validateMemory(memory: Memory): boolean {
  return !!(
    memory &&
    memory.memoryId &&
    memory.memoryKey &&
    memory.memoryType &&
    memory.lastAccessedAt instanceof Date &&
    memory.createdAt instanceof Date
  );
}

/**
 * 创建多个测试用Memory对象
 */
export function createTestMemories(count: number): Memory[] {
  const memories: Memory[] = [];
  for (let i = 0; i < count; i++) {
    memories.push(
      createTestMemory({
        memoryId: `test-memory-${i}`,
        memoryKey: `test-key-${i}`,
        memoryType: i % 2 === 0 ? 'WORKING' : i % 3 === 0 ? 'HOT' : 'COLD',
      })
    );
  }
  return memories;
}

/**
 * Mock Prisma Client的agentMemory
 */
export function createMockAgentMemoryDB() {
  const mockData = new Map<string, MockAgentMemoryRecord>();

  return {
    create: jest.fn().mockImplementation(async data => {
      const record = createMockMemoryRecord({
        id: 'mock-id-' + Date.now(),
        memoryKey: data.memoryKey,
        memoryType: data.memoryType,
      });
      mockData.set(record.id, record);
      return record;
    }),

    findFirst: jest.fn().mockImplementation(async ({ where }) => {
      const entries = Array.from(mockData.values());
      return (
        entries.find(entry => {
          if (where.memoryKey && entry.memoryKey !== where.memoryKey) {
            return false;
          }
          if (where.memoryType && entry.memoryType !== where.memoryType) {
            return false;
          }
          if (where.agentName && entry.agentName !== where.agentName) {
            return false;
          }
          return true;
        }) || null
      );
    }),

    findMany: jest.fn().mockImplementation(async ({ where }) => {
      const entries = Array.from(mockData.values());
      if (where?.memoryType) {
        return entries.filter(entry => entry.memoryType === where.memoryType);
      }
      return entries;
    }),

    update: jest.fn().mockImplementation(async ({ where, data }) => {
      const record = mockData.get(where.id);
      if (record) {
        const updated = { ...record, ...data, updatedAt: new Date() };
        mockData.set(where.id, updated as MockAgentMemoryRecord);
        return updated;
      }
      return record;
    }),

    updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
      const entries = Array.from(mockData.values());
      const count = entries.filter(entry => {
        if (where.memoryKey && entry.memoryKey !== where.memoryKey) {
          return false;
        }
        if (where.memoryType && entry.memoryType !== where.memoryType) {
          return false;
        }
        return true;
      }).length;
      return { count };
    }),

    deleteMany: jest.fn().mockImplementation(async ({ where }) => {
      let count = 0;
      for (const [id, entry] of mockData.entries()) {
        if (where.memoryKey && entry.memoryKey !== where.memoryKey) {
          continue;
        }
        if (where.memoryType && entry.memoryType !== where.memoryType) {
          continue;
        }
        mockData.delete(id);
        count++;
      }
      return { count };
    }),

    count: jest.fn().mockImplementation(async ({ where }) => {
      const entries = Array.from(mockData.values());
      if (where?.memoryType) {
        return entries.filter(entry => entry.memoryType === where.memoryType)
          .length;
      }
      return entries.length;
    }),

    aggregate: jest.fn().mockImplementation(async ({ _avg }) => {
      const entries = Array.from(mockData.values());
      if (_avg?.importance) {
        const sum = entries.reduce((acc, entry) => acc + entry.importance, 0);
        return { _avg: { importance: sum / (entries.length || 1) } };
      }
      return { _avg: { importance: 0 } };
    }),

    // 清理方法
    clear: jest.fn(() => {
      mockData.clear();
    }),
  };
}
