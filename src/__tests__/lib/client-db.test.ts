/**
 * CRM Client数据库模型测试
 * 验证Client和CommunicationRecord模型的数据库设计
 */

// 使用真实数据库进行集成测试
jest.mock('@/lib/db/prisma', () => {
  const { PrismaClient: RealPrismaClient } = jest.requireActual(
    '@prisma/client'
  ) as typeof import('@prisma/client');
  return { prisma: new RealPrismaClient() };
});

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '@/lib/db/prisma';

describe('CRM Client Database Models', () => {
  let testUserId: string;
  let testClientId: string;

  beforeAll(async () => {
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: `test-client-${Date.now()}@test.com`,
        name: 'Test Client User',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testUserId) {
      await prisma.user.delete({
        where: { id: testUserId },
      });
    }
    await prisma.$disconnect();
  });

  describe('Client Model', () => {
    it('应该能够创建个人客户', async () => {
      const client = await prisma.client.create({
        data: {
          userId: testUserId,
          clientType: 'INDIVIDUAL',
          name: '张三',
          phone: '13800138000',
          email: 'zhangsan@example.com',
          status: 'ACTIVE',
          tags: [],
        },
      });

      expect(client).toBeDefined();
      expect(client.clientType).toBe('INDIVIDUAL');
      expect(client.name).toBe('张三');
      expect(client.phone).toBe('13800138000');
      expect(client.status).toBe('ACTIVE');
      testClientId = client.id;
    });

    it('应该能够创建企业客户', async () => {
      const client = await prisma.client.create({
        data: {
          userId: testUserId,
          clientType: 'ENTERPRISE',
          name: '某某科技有限公司',
          company: '某某科技有限公司',
          creditCode: '91110000000000000X',
          status: 'ACTIVE',
          tags: [],
        },
      });

      expect(client).toBeDefined();
      expect(client.clientType).toBe('ENTERPRISE');
      expect(client.company).toBe('某某科技有限公司');
      expect(client.creditCode).toBe('91110000000000000X');
    });

    it('应该支持客户来源标签', async () => {
      const client = await prisma.client.create({
        data: {
          userId: testUserId,
          clientType: 'POTENTIAL',
          name: '李四',
          source: 'REFERRAL',
          tags: ['潜在客户', '推荐'],
          status: 'ACTIVE',
        },
      });

      expect(client).toBeDefined();
      expect(client.source).toBe('REFERRAL');
      expect(Array.isArray(client.tags)).toBe(true);
      expect(client.tags).toContain('潜在客户');
      expect(client.tags).toContain('推荐');
    });

    it('应该支持客户状态管理', async () => {
      const statuses = ['ACTIVE', 'INACTIVE', 'LOST', 'BLACKLISTED'] as const;

      for (const status of statuses) {
        const client = await prisma.client.create({
          data: {
            userId: testUserId,
            clientType: 'INDIVIDUAL',
            name: `测试-${status}`,
            status,
            tags: [],
          },
        });
        expect(client.status).toBe(status);
      }
    });

    it('应该支持软删除', async () => {
      const client = await prisma.client.create({
        data: {
          userId: testUserId,
          clientType: 'INDIVIDUAL',
          name: '王五',
          status: 'ACTIVE',
          tags: [],
        },
      });

      expect(client.deletedAt).toBeNull();

      // 软删除
      const deleted = await prisma.client.update({
        where: { id: client.id },
        data: { deletedAt: new Date() },
      });

      expect(deleted.deletedAt).not.toBeNull();
    });
  });

  describe('CommunicationRecord Model', () => {
    let clientId: string;

    beforeAll(async () => {
      // 创建测试客户
      const client = await prisma.client.create({
        data: {
          userId: testUserId,
          clientType: 'INDIVIDUAL',
          name: '赵六',
          status: 'ACTIVE',
          tags: [],
        },
      });
      clientId = client.id;
    });

    it('应该能够创建沟通记录', async () => {
      const communication = await prisma.communicationRecord.create({
        data: {
          clientId,
          userId: testUserId,
          type: 'PHONE',
          summary: '电话沟通案件详情',
          content: '客户询问了案件进展，已详细解答',
        },
      });

      expect(communication).toBeDefined();
      expect(communication.type).toBe('PHONE');
      expect(communication.summary).toBe('电话沟通案件详情');
      expect(communication.content).toBe('客户询问了案件进展，已详细解答');
    });

    it('应该支持不同类型的沟通方式', async () => {
      const types = ['PHONE', 'EMAIL', 'MEETING', 'WECHAT', 'OTHER'] as const;

      for (const type of types) {
        await prisma.communicationRecord.create({
          data: {
            clientId,
            userId: testUserId,
            type,
            summary: `${type}测试`,
          },
        });
      }

      const count = await prisma.communicationRecord.count({
        where: { clientId },
      });
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('应该支持设置下次跟进日期', async () => {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 7);

      const comm = await prisma.communicationRecord.create({
        data: {
          clientId,
          userId: testUserId,
          type: 'PHONE',
          summary: '预约下周跟进',
          nextFollowUpDate: nextDate,
        },
      });

      expect(comm.nextFollowUpDate).not.toBeNull();
      expect(comm.nextFollowUpDate).toEqual(nextDate);
    });

    it('应该支持标记重要沟通', async () => {
      const comm = await prisma.communicationRecord.create({
        data: {
          clientId,
          userId: testUserId,
          type: 'MEETING',
          summary: '重要会议',
          isImportant: true,
        },
      });

      expect(comm.isImportant).toBe(true);
    });
  });

  describe('Relationship Tests', () => {
    it('应该能够关联案件到客户', async () => {
      const client = await prisma.client.create({
        data: {
          userId: testUserId,
          clientType: 'INDIVIDUAL',
          name: '客户案件测试',
          status: 'ACTIVE',
          tags: [],
        },
      });

      const caseRecord = await prisma.case.create({
        data: {
          userId: testUserId,
          title: '测试案件',
          description: '测试案件描述',
          type: 'CIVIL',
          status: 'ACTIVE',
          clientId: client.id,
        },
      });

      const caseWithClient = await prisma.case.findUnique({
        where: { id: caseRecord.id },
        include: { client: true },
      });

      expect(caseWithClient?.client?.id).toBe(client.id);
    });

    it('应该能够查询客户的沟通记录', async () => {
      if (!testClientId) {
        // 先创建一个客户和沟通记录
        const client = await prisma.client.create({
          data: {
            userId: testUserId,
            clientType: 'INDIVIDUAL',
            name: '沟通记录测试',
            status: 'ACTIVE',
            tags: [],
          },
        });

        await prisma.communicationRecord.create({
          data: {
            clientId: client.id,
            userId: testUserId,
            type: 'PHONE',
            summary: '测试沟通记录',
          },
        });

        testClientId = client.id;
      }

      const communications = await prisma.communicationRecord.findMany({
        where: { clientId: testClientId },
        orderBy: { createdAt: 'desc' },
      });

      expect(Array.isArray(communications)).toBe(true);
    });

    it('应该级联删除客户的沟通记录', async () => {
      const client = await prisma.client.create({
        data: {
          userId: testUserId,
          clientType: 'INDIVIDUAL',
          name: '级联删除测试',
          status: 'ACTIVE',
          tags: [],
        },
      });

      await prisma.communicationRecord.create({
        data: {
          clientId: client.id,
          userId: testUserId,
          type: 'PHONE',
          summary: '级联删除测试沟通',
        },
      });

      // 删除客户
      await prisma.client.delete({
        where: { id: client.id },
      });

      // 验证沟通记录也被删除
      const remainingComms = await prisma.communicationRecord.count({
        where: { clientId: client.id },
      });

      expect(remainingComms).toBe(0);
    });
  });

  describe('Index and Performance Tests', () => {
    it('应该支持按状态筛选客户', async () => {
      const activeClients = await prisma.client.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      });

      expect(Array.isArray(activeClients)).toBe(true);
    });

    it('应该支持按类型筛选沟通记录', async () => {
      const phoneComms = await prisma.communicationRecord.findMany({
        where: {
          type: 'PHONE',
        },
      });

      expect(Array.isArray(phoneComms)).toBe(true);
    });

    it('应该支持按下次跟进日期筛选', async () => {
      const commsWithFollowUp = await prisma.communicationRecord.findMany({
        where: {
          nextFollowUpDate: { not: null },
        },
      });

      expect(Array.isArray(commsWithFollowUp)).toBe(true);
    });

    it('应该支持分页查询客户', async () => {
      const page = 1;
      const limit = 10;

      const [clients, total] = await Promise.all([
        prisma.client.findMany({
          where: {
            userId: testUserId,
            deletedAt: null,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.client.count({
          where: {
            userId: testUserId,
            deletedAt: null,
          },
        }),
      ]);

      expect(Array.isArray(clients)).toBe(true);
      expect(clients.length).toBeLessThanOrEqual(limit);
      expect(total).toBeGreaterThanOrEqual(0);
    });
  });
});
