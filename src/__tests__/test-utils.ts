import { jest } from '@jest/globals';

/**
 * 测试工具函数
 */

// 重新导出工厂函数，方便测试文件使用
export * from './factories';

/**
 * Prisma Mock 类型定义
 */
type MockFunction = jest.Mock;

interface PrismaMock {
  caseExample: {
    create: MockFunction;
    findUnique: MockFunction;
    update: MockFunction;
    delete: MockFunction;
    findMany: MockFunction;
    count: MockFunction;
    groupBy: MockFunction;
  };
  user: {
    create: MockFunction;
    findUnique: MockFunction;
    findFirst: MockFunction;
    update: MockFunction;
    delete: MockFunction;
    findMany: MockFunction;
    count: MockFunction;
  };
  case: {
    create: MockFunction;
    findUnique: MockFunction;
    findFirst: MockFunction;
    update: MockFunction;
    delete: MockFunction;
    findMany: MockFunction;
    count: MockFunction;
  };
  order: {
    create: MockFunction;
    findUnique: MockFunction;
    findFirst: MockFunction;
    update: MockFunction;
    delete: MockFunction;
    findMany: MockFunction;
    count: MockFunction;
  };
  debate: {
    create: MockFunction;
    findUnique: MockFunction;
    update: MockFunction;
    delete: MockFunction;
    findMany: MockFunction;
    count: MockFunction;
  };
  evidence: {
    create: MockFunction;
    findUnique: MockFunction;
    update: MockFunction;
    delete: MockFunction;
    findMany: MockFunction;
    count: MockFunction;
  };
  consultation: {
    create: MockFunction;
    findUnique: MockFunction;
    update: MockFunction;
    delete: MockFunction;
    findMany: MockFunction;
    count: MockFunction;
  };
  team: {
    create: MockFunction;
    findUnique: MockFunction;
    update: MockFunction;
    delete: MockFunction;
    findMany: MockFunction;
    count: MockFunction;
  };
}

/**
 * 创建Prisma客户端mock
 * 增强版，支持更多实体类型
 */
export function createMockPrisma(): PrismaMock {
  const createModelMock = () => ({
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  });

  return {
    caseExample: createModelMock(),
    user: createModelMock(),
    case: createModelMock(),
    order: createModelMock(),
    debate: createModelMock(),
    evidence: createModelMock(),
    consultation: createModelMock(),
    team: createModelMock(),
  } as PrismaMock;
}

/**
 * 清理所有mock
 */
export function clearAllMocks() {
  jest.clearAllMocks();
}
