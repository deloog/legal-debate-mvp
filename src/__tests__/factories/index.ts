/**
 * 测试数据工厂
 * 提供类型安全的测试数据生成功能
 *
 * 注意：工厂基于 Prisma schema 定义，只包含实际存在的字段
 */

import type { Case, User, Debate, Order } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * 生成唯一ID的计数器
 */
let idCounter = 1;

/**
 * 生成唯一的UUID
 */
export function generateUUID(): string {
  const id = idCounter++;
  return `${id.toString().padStart(8, '0')}-0000-0000-0000-000000000000`;
}

/**
 * 生成唯一的编号
 */
export function generateNumber(prefix: string): string {
  const id = idCounter++;
  const timestamp = Date.now().toString().slice(-8);
  return `${prefix}${timestamp}${id.toString().padStart(4, '0')}`;
}

/**
 * 生成随机数字
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 随机选择数组中的元素
 */
export function randomChoice<T>(array: T[]): T {
  return array[randomInt(0, array.length - 1)];
}

/**
 * 生成随机日期
 */
export function randomDate(start?: Date, end?: Date): Date {
  const startDate = start || new Date(2024, 0, 1);
  const endDate = end || new Date();
  const timestamp = randomInt(startDate.getTime(), endDate.getTime());
  return new Date(timestamp);
}

/**
 * 创建 Decimal 类型
 */
export function createDecimal(value: number): Decimal {
  return new Decimal(value);
}

/**
 * 用户工厂
 */
export const userFactory = {
  build: (overrides: Partial<User> = {}): User => ({
    id: generateUUID(),
    email: `user${idCounter}@test.com`,
    username: `testuser${idCounter}`,
    name: `测试用户${idCounter}`,
    password: 'hashed_password',
    role: 'LAWYER',
    status: 'ACTIVE',
    permissions: null,
    organizationId: null,
    avatar: null,
    phone: null,
    emailVerified: null,
    bio: null,
    address: null,
    preferences: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    loginCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    deletedAt: null,
    ...overrides,
  }),

  buildMany: (count: number, overrides: Partial<User> = {}): User[] => {
    return Array.from({ length: count }, () => userFactory.build(overrides));
  },

  buildLawyer: (overrides: Partial<User> = {}): User => {
    return userFactory.build({
      role: 'LAWYER',
      ...overrides,
    });
  },

  buildAdmin: (overrides: Partial<User> = {}): User => {
    return userFactory.build({
      role: 'ADMIN',
      ...overrides,
    });
  },
};

/**
 * 案件工厂
 */
export const caseFactory = {
  build: (overrides: Partial<Case> = {}): Case => ({
    id: generateUUID(),
    userId: generateUUID(),
    caseNumber: generateNumber('CASE'),
    title: `测试案件${idCounter}`,
    description: '这是一个测试案件描述',
    type: 'CIVIL',
    status: 'DRAFT',
    ownerType: 'USER',
    sharedWithTeam: false,
    plaintiffName: null,
    defendantName: null,
    court: null,
    amount: null,
    cause: null,
    clientId: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }),

  buildMany: (count: number, overrides: Partial<Case> = {}): Case[] => {
    return Array.from({ length: count }, () => caseFactory.build(overrides));
  },

  buildWithOwner: (userId: string, overrides: Partial<Case> = {}): Case => {
    return caseFactory.build({
      userId,
      ownerType: 'USER',
      ...overrides,
    });
  },

  buildActive: (overrides: Partial<Case> = {}): Case => {
    return caseFactory.build({
      status: 'ACTIVE',
      ...overrides,
    });
  },

  buildCompleted: (overrides: Partial<Case> = {}): Case => {
    return caseFactory.build({
      status: 'COMPLETED',
      ...overrides,
    });
  },
};

/**
 * 辩论工厂
 */
export const debateFactory = {
  build: (overrides: Partial<Debate> = {}): Debate => ({
    id: generateUUID(),
    title: `测试辩论${idCounter}`,
    caseId: generateUUID(),
    userId: generateUUID(),
    status: 'DRAFT',
    currentRound: 0,
    debateConfig: {
      maxRounds: 3,
      timePerRound: 30,
      allowNewEvidence: true,
      debateMode: 'standard',
    },
    summary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }),

  buildMany: (count: number, overrides: Partial<Debate> = {}): Debate[] => {
    return Array.from({ length: count }, () => debateFactory.build(overrides));
  },

  buildForCase: (caseId: string, overrides: Partial<Debate> = {}): Debate => {
    return debateFactory.build({
      caseId,
      ...overrides,
    });
  },

  buildInProgress: (overrides: Partial<Debate> = {}): Debate => {
    return debateFactory.build({
      status: 'IN_PROGRESS',
      currentRound: 1,
      ...overrides,
    });
  },

  buildCompleted: (overrides: Partial<Debate> = {}): Debate => {
    return debateFactory.build({
      status: 'COMPLETED',
      currentRound: 3,
      ...overrides,
    });
  },
};

/**
 * 订单工厂
 */
export const orderFactory = {
  build: (overrides: Partial<Order> = {}): Order => ({
    id: generateUUID(),
    orderNo: generateNumber('ORD'),
    userId: generateUUID(),
    membershipTierId: generateUUID(),
    status: 'PENDING',
    amount: createDecimal(randomInt(100, 10000)),
    currency: 'CNY',
    paymentMethod: 'WECHAT',
    description: '测试订单',
    metadata: null,
    failedReason: null,
    expiredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  buildMany: (count: number, overrides: Partial<Order> = {}): Order[] => {
    return Array.from({ length: count }, () => orderFactory.build(overrides));
  },

  buildForUser: (userId: string, overrides: Partial<Order> = {}): Order => {
    return orderFactory.build({
      userId,
      ...overrides,
    });
  },

  buildPaid: (overrides: Partial<Order> = {}): Order => {
    return orderFactory.build({
      status: 'PAID',
      paymentMethod: 'ALIPAY',
      paidAt: new Date(),
      ...overrides,
    });
  },

  buildCancelled: (overrides: Partial<Order> = {}): Order => {
    return orderFactory.build({
      status: 'CANCELLED',
      ...overrides,
    });
  },

  buildFailed: (overrides: Partial<Order> = {}): Order => {
    return orderFactory.build({
      status: 'FAILED',
      failedReason: '支付失败',
      ...overrides,
    });
  },
};

/**
 * 重置ID计数器（用于测试隔离）
 */
export function resetFactories(): void {
  idCounter = 1;
}

/**
 * 向后兼容的别名
 */
export const mockData = {
  uuid: generateUUID,
  case: caseFactory.build,
  user: userFactory.build,
  debate: debateFactory.build,
  order: orderFactory.build,
};
