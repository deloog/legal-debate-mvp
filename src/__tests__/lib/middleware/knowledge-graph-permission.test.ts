/**
 * 知识图谱权限控制测试
 * 测试管理员权限验证和审核操作日志记录功能
 */

import { prisma } from '@/lib/db';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import { UserRole } from '@prisma/client';

describe('知识图谱权限控制', () => {
  // 测试用户数据
  const testUsers = {
    superAdmin: {
      id: 'test-super-admin-id',
      email: 'superadmin@test.com',
      role: UserRole.SUPER_ADMIN,
    },
    admin: {
      id: 'test-admin-id',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
    },
    user: {
      id: 'test-user-id',
      email: 'user@test.com',
      role: UserRole.USER,
    },
  };

  beforeEach(async () => {
    // 清理测试数据
    await prisma.actionLog.deleteMany({
      where: {
        userId: {
          in: [testUsers.superAdmin.id, testUsers.admin.id, testUsers.user.id],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testUsers.superAdmin.id, testUsers.admin.id, testUsers.user.id],
        },
      },
    });

    // 创建测试用户
    await prisma.user.createMany({
      data: [
        {
          id: testUsers.superAdmin.id,
          email: testUsers.superAdmin.email,
          role: testUsers.superAdmin.role,
          password: 'hashed-password',
        },
        {
          id: testUsers.admin.id,
          email: testUsers.admin.email,
          role: testUsers.admin.role,
          password: 'hashed-password',
        },
        {
          id: testUsers.user.id,
          email: testUsers.user.email,
          role: testUsers.user.role,
          password: 'hashed-password',
        },
      ],
    });
  });

  afterEach(async () => {
    // 清理测试数据
    await prisma.actionLog.deleteMany({
      where: {
        userId: {
          in: [testUsers.superAdmin.id, testUsers.admin.id, testUsers.user.id],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testUsers.superAdmin.id, testUsers.admin.id, testUsers.user.id],
        },
      },
    });
  });

  describe('checkKnowledgeGraphPermission', () => {
    it('应该允许超级管理员访问所有资源', async () => {
      const result = await checkKnowledgeGraphPermission(
        testUsers.superAdmin.id,
        KnowledgeGraphAction.VERIFY_RELATION,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('应该允许管理员访问所有资源', async () => {
      const result = await checkKnowledgeGraphPermission(
        testUsers.admin.id,
        KnowledgeGraphAction.VERIFY_RELATION,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('应该拒绝普通用户访问管理功能', async () => {
      const result = await checkKnowledgeGraphPermission(
        testUsers.user.id,
        KnowledgeGraphAction.VERIFY_RELATION,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('需要管理员权限');
    });

    it('应该拒绝不存在的用户', async () => {
      const result = await checkKnowledgeGraphPermission(
        'non-existent-user-id',
        KnowledgeGraphAction.VERIFY_RELATION,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户不存在');
    });

    it('应该允许所有用户查看统计数据', async () => {
      const result = await checkKnowledgeGraphPermission(
        testUsers.user.id,
        KnowledgeGraphAction.VIEW_STATS,
        KnowledgeGraphResource.STATS
      );

      expect(result.hasPermission).toBe(true);
    });

    it('应该允许所有用户查看关系列表', async () => {
      const result = await checkKnowledgeGraphPermission(
        testUsers.user.id,
        KnowledgeGraphAction.VIEW_RELATIONS,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(true);
    });

    it('应该拒绝已删除的用户', async () => {
      // 软删除用户
      await prisma.user.update({
        where: { id: testUsers.user.id },
        data: { deletedAt: new Date() },
      });

      const result = await checkKnowledgeGraphPermission(
        testUsers.user.id,
        KnowledgeGraphAction.VIEW_STATS,
        KnowledgeGraphResource.STATS
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户已被删除');
    });
  });

  describe('logKnowledgeGraphAction', () => {
    it('应该成功记录审核操作日志', async () => {
      const relationId = 'test-relation-id';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      await logKnowledgeGraphAction({
        userId: testUsers.admin.id,
        action: KnowledgeGraphAction.VERIFY_RELATION,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: relationId,
        description: '审核通过法条关系',
        ipAddress,
        userAgent,
        metadata: {
          approved: true,
          note: '关系准确',
        },
      });

      // 验证日志是否被创建
      const logs = await prisma.actionLog.findMany({
        where: {
          userId: testUsers.admin.id,
          resourceId: relationId,
        },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].description).toBe('审核通过法条关系');
      expect(logs[0].ipAddress).toBe(ipAddress);
      expect(logs[0].userAgent).toBe(userAgent);
      expect(logs[0].resourceType).toBe(KnowledgeGraphResource.RELATION);
      expect(logs[0].metadata).toEqual({
        approved: true,
        note: '关系准确',
      });
    });

    it('应该记录批量审核操作', async () => {
      await logKnowledgeGraphAction({
        userId: testUsers.admin.id,
        action: KnowledgeGraphAction.BATCH_VERIFY,
        resource: KnowledgeGraphResource.RELATION,
        description: '批量审核10个关系',
        metadata: {
          count: 10,
          approved: 8,
          rejected: 2,
        },
      });

      const logs = await prisma.actionLog.findMany({
        where: {
          userId: testUsers.admin.id,
          actionType: 'UNKNOWN', // 批量操作使用 UNKNOWN 类型
        },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].description).toBe('批量审核10个关系');
      expect(logs[0].metadata).toMatchObject({
        count: 10,
        approved: 8,
        rejected: 2,
      });
    });

    it('应该记录导出操作', async () => {
      await logKnowledgeGraphAction({
        userId: testUsers.admin.id,
        action: KnowledgeGraphAction.EXPORT_DATA,
        resource: KnowledgeGraphResource.RELATION,
        description: '导出关系数据',
        metadata: {
          format: 'csv',
          count: 100,
        },
      });

      const logs = await prisma.actionLog.findMany({
        where: {
          userId: testUsers.admin.id,
          actionType: 'EXPORT_DATA',
        },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].metadata).toMatchObject({
        format: 'csv',
        count: 100,
      });
    });

    it('应该处理没有可选参数的日志记录', async () => {
      await logKnowledgeGraphAction({
        userId: testUsers.admin.id,
        action: KnowledgeGraphAction.VIEW_STATS,
        resource: KnowledgeGraphResource.STATS,
        description: '查看统计数据',
      });

      const logs = await prisma.actionLog.findMany({
        where: {
          userId: testUsers.admin.id,
          actionType: 'UNKNOWN',
        },
      });

      expect(logs.length).toBeGreaterThan(0);
      const log = logs.find(l => l.description === '查看统计数据');
      expect(log).toBeDefined();
      expect(log?.ipAddress).toBeNull();
      expect(log?.userAgent).toBeNull();
    });

    it('应该允许记录不存在用户的操作日志', async () => {
      // ActionLog表的userId不是外键，所以可以记录不存在用户的日志
      await expect(
        logKnowledgeGraphAction({
          userId: 'invalid-user-id-that-does-not-exist',
          action: KnowledgeGraphAction.VERIFY_RELATION,
          resource: KnowledgeGraphResource.RELATION,
          description: '测试不存在用户的日志记录',
        })
      ).resolves.not.toThrow();

      // 验证日志确实被创建
      const logs = await prisma.actionLog.findMany({
        where: {
          userId: 'invalid-user-id-that-does-not-exist',
        },
      });

      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('权限检查性能', () => {
    it('应该在合理时间内完成权限检查', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        await checkKnowledgeGraphPermission(
          testUsers.admin.id,
          KnowledgeGraphAction.VERIFY_RELATION,
          KnowledgeGraphResource.RELATION
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 10次权限检查应该在1秒内完成
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('边界情况', () => {
    it('应该处理空字符串用户ID', async () => {
      const result = await checkKnowledgeGraphPermission(
        '',
        KnowledgeGraphAction.VERIFY_RELATION,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户不存在');
    });

    it('应该处理特殊字符的资源ID', async () => {
      const specialResourceId = 'test-id-with-特殊字符-!@#$%';

      await expect(
        logKnowledgeGraphAction({
          userId: testUsers.admin.id,
          action: KnowledgeGraphAction.VERIFY_RELATION,
          resource: KnowledgeGraphResource.RELATION,
          resourceId: specialResourceId,
          description: '测试特殊字符',
        })
      ).resolves.not.toThrow();

      const logs = await prisma.actionLog.findMany({
        where: {
          resourceId: specialResourceId,
        },
      });

      expect(logs).toHaveLength(1);
    });
  });
});
