/**
 * Prisma Mock - 内存测试用
 * 提供Mock的PrismaClient实例，避免测试连接真实数据库
 */

import { MemoryType } from '@prisma/client';

/**
 * Mock记忆记录
 */
export interface MockAgentMemoryRecord {
  id: string;
  userId: string | null;
  caseId: string | null;
  debateId: string | null;
  memoryType: MemoryType;
  agentName: string;
  memoryKey: string;
  memoryValue: string;
  importance: number;
  accessCount: number;
  lastAccessedAt: Date;
  expiresAt: Date | null;
  compressed: boolean;
  compressionRatio: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建Mock记忆记录
 */
export function createMockMemoryRecord(
  overrides?: Partial<MockAgentMemoryRecord>
): MockAgentMemoryRecord {
  const now = new Date();
  return {
    id: 'mock-memory-1',
    userId: 'user-1',
    caseId: 'case-1',
    debateId: 'debate-1',
    memoryType: 'WORKING',
    agentName: 'MemoryAgent',
    memoryKey: 'test-key',
    memoryValue: JSON.stringify({ data: 'test data' }),
    importance: 0.5,
    accessCount: 1,
    lastAccessedAt: now,
    expiresAt: new Date(now.getTime() + 3600000), // 1小时后过期
    compressed: false,
    compressionRatio: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * 创建Mock记录列表
 */
export function createMockMemoryRecords(
  count: number
): MockAgentMemoryRecord[] {
  const records: MockAgentMemoryRecord[] = [];
  for (let i = 0; i < count; i++) {
    records.push(
      createMockMemoryRecord({
        id: `mock-memory-${i}`,
        memoryKey: `test-key-${i}`,
        memoryType: i % 2 === 0 ? 'WORKING' : i % 3 === 0 ? 'HOT' : 'COLD',
      })
    );
  }
  return records;
}

/**
 * 验证Mock记录
 */
export function validateMockRecord(record: MockAgentMemoryRecord): boolean {
  return !!(
    record.id &&
    record.agentName &&
    record.memoryKey &&
    record.memoryType &&
    record.lastAccessedAt instanceof Date &&
    record.createdAt instanceof Date
  );
}
