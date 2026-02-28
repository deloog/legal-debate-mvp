/**
 * 共享的 Mock Prisma 客户端
 * 用于所有 Jest 测试，避免每个测试套件创建独立连接
 */

import { jest } from '@jest/globals';

// 创建共享的 mock 函数工厂 - 使用 ReturnType 来获取正确的 jest mock 类型
type MockFn = ReturnType<typeof jest.fn>;

const createMockFn = (): MockFn => jest.fn();

// 完整的 Mock Prisma 客户端
const mockPrisma = {
  // 用户相关
  user: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 案例相关
  case: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 辩论相关
  debate: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 辩论回合相关
  debateRound: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 辩论论点相关
  debateArgument: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 法律条文相关
  lawArticle: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 证据相关
  evidence: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 文档相关
  document: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 站内消息相关
  inAppMessage: {
    create: createMockFn(),
    createMany: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 提醒相关
  reminder: {
    create: createMockFn(),
    createMany: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 团队相关
  team: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 团队成员相关
  teamMember: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 会员相关
  membership: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 会员计划相关
  membershipPlan: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 会员功能相关
  membershipFeature: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 知识图谱相关
  knowledgeGraph: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 知识图谱专家相关
  knowledgeGraphExpert: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 法律条文关系相关
  lawArticleRelation: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
    aggregate: createMockFn(),
  },

  // 订单相关
  order: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 支付相关
  payment: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // AI配额相关
  aiQuota: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 存储相关
  storage: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 审核日志相关
  auditLog: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 代理相关
  agent: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 代理内存相关
  agentMemory: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 模板相关
  template: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 法院日程相关
  courtSchedule: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 任务相关
  task: {
    create: createMockFn(),
    findUnique: createMockFn(),
    findFirst: createMockFn(),
    update: createMockFn(),
    delete: createMockFn(),
    deleteMany: createMockFn(),
    findMany: createMockFn(),
    count: createMockFn(),
    upsert: createMockFn(),
  },

  // 事务处理
  $transaction: jest.fn(),

  // 连接管理
  $connect: createMockFn(),
  $disconnect: createMockFn(),
};

// 导出为单一实例
export const prisma = mockPrisma;

// 便捷方法：重置所有 mock
export function resetAllMocks(): void {
  Object.values(mockPrisma).forEach(value => {
    if (
      typeof value === 'object' &&
      value !== null &&
      !('$transaction' in value) &&
      typeof (value as Record<string, unknown>)['create'] === 'function'
    ) {
      Object.values(value as Record<string, { mockReset(): void }>).forEach(
        fn => {
          if (typeof fn.mockReset === 'function') {
            fn.mockReset();
          }
        }
      );
    }
  });
}

// 便捷方法：设置默认返回值（简化版）
export function setupDefaultMocks(): void {
  // 使用 jest.resetAllMocks() 重置所有 mock
}

export default prisma;
