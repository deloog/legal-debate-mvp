import { jest } from '@jest/globals';

/**
 * 测试工具函数
 */

/**
 * 创建Prisma客户端mock
 */
export function createMockPrisma() {
  return {
    caseExample: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };
}

/**
 * 清理所有mock
 */
export function clearAllMocks() {
  jest.clearAllMocks();
}
