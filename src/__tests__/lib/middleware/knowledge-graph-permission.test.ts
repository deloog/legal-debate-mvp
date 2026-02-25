/**
 * 知识图谱权限中间件单元测试
 * 测试审核日志映射功能的完整性
 * @jest-environment node
 */

import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
  isKnowledgeGraphAdmin,
} from '@/lib/middleware/knowledge-graph-permission';
import { ActionLogType } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    actionLog: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('KnowledgeGraphPermission - mapActionToLogType', () => {
  describe('映射关系验证', () => {
    it('应该正确映射 VIEW_RELATIONS 到 VIEW_KNOWLEDGE_GRAPH', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.actionLog.create.mockResolvedValue({});

      await logKnowledgeGraphAction({
        userId: 'test-user-id',
        action: KnowledgeGraphAction.VIEW_RELATIONS,
        resource: KnowledgeGraphResource.RELATION,
        description: '查看法条关系',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: ActionLogType.VIEW_KNOWLEDGE_GRAPH,
          actionCategory: 'ADMIN',
          userId: 'test-user-id',
          description: '查看法条关系',
          resourceType: 'law_article_relation',
        }),
      });
    });

    it('应该正确映射 VIEW_STATS 到 VIEW_KNOWLEDGE_GRAPH', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.actionLog.create.mockResolvedValue({});

      await logKnowledgeGraphAction({
        userId: 'test-user-id',
        action: KnowledgeGraphAction.VIEW_STATS,
        resource: KnowledgeGraphResource.STATS,
        description: '查看图谱统计',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: ActionLogType.VIEW_KNOWLEDGE_GRAPH,
          actionCategory: 'ADMIN',
          description: '查看图谱统计',
          resourceType: 'knowledge_graph_stats',
        }),
      });
    });

    it('应该正确映射 VERIFY_RELATION 到 VERIFY_RELATION', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.actionLog.create.mockResolvedValue({});

      await logKnowledgeGraphAction({
        userId: 'test-user-id',
        action: KnowledgeGraphAction.VERIFY_RELATION,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: 'relation-1',
        description: '审核关系',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: ActionLogType.VERIFY_RELATION,
          resourceId: 'relation-1',
          description: '审核关系',
        }),
      });
    });

    it('应该正确映射 BATCH_VERIFY 到 BATCH_VERIFY_RELATION', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.actionLog.create.mockResolvedValue({});

      await logKnowledgeGraphAction({
        userId: 'test-user-id',
        action: KnowledgeGraphAction.BATCH_VERIFY,
        resource: KnowledgeGraphResource.RELATION,
        description: '批量审核关系',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: ActionLogType.BATCH_VERIFY_RELATION,
          description: '批量审核关系',
        }),
      });
    });

    it('应该正确映射 EXPORT_DATA 到 EXPORT_DATA', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.actionLog.create.mockResolvedValue({});

      await logKnowledgeGraphAction({
        userId: 'test-user-id',
        action: KnowledgeGraphAction.EXPORT_DATA,
        resource: KnowledgeGraphResource.GRAPH,
        description: '导出图谱数据',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: ActionLogType.EXPORT_DATA,
          description: '导出图谱数据',
        }),
      });
    });

    it('应该正确映射 MANAGE_RELATIONS 到 MANAGE_RELATIONS', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.actionLog.create.mockResolvedValue({});

      await logKnowledgeGraphAction({
        userId: 'test-user-id',
        action: KnowledgeGraphAction.MANAGE_RELATIONS,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: 'relation-1',
        description: '管理关系',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: ActionLogType.MANAGE_RELATIONS,
          resourceId: 'relation-1',
          description: '管理关系',
        }),
      });
    });
  });

  describe('日志记录完整性', () => {
    it('应该正确记录所有日志字段', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.actionLog.create.mockResolvedValue({});

      const logParams = {
        userId: 'test-user-id',
        action: KnowledgeGraphAction.VIEW_RELATIONS,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: 'relation-123',
        description: '查看法条关系完整测试',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Agent',
        metadata: { testKey: 'testValue', testNumber: 123 },
      };

      await logKnowledgeGraphAction(logParams);

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user-id',
          resourceId: 'relation-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Agent',
          metadata: { testKey: 'testValue', testNumber: 123 },
          actionType: ActionLogType.VIEW_KNOWLEDGE_GRAPH,
          description: '查看法条关系完整测试',
          resourceType: 'law_article_relation',
        }),
      });
    });

    it('应该正确处理可选字段为空的情况', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.actionLog.create.mockResolvedValue({});

      await logKnowledgeGraphAction({
        userId: 'test-user-id',
        action: KnowledgeGraphAction.VIEW_RELATIONS,
        resource: KnowledgeGraphResource.RELATION,
        description: '查看法条关系空字段测试',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user-id',
          description: '查看法条关系空字段测试',
          actionType: ActionLogType.VIEW_KNOWLEDGE_GRAPH,
        }),
      });
    });
  });
});

describe('KnowledgeGraphPermission - 权限检查', () => {
  describe('checkKnowledgeGraphPermission', () => {
    it('应该允许管理员执行所有操作', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'ADMIN',
        deletedAt: null,
      });

      const result = await checkKnowledgeGraphPermission(
        'admin-id',
        KnowledgeGraphAction.MANAGE_RELATIONS,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(true);
      expect(result.userRole).toBe('ADMIN');
    });

    it('应该允许超级管理员执行所有操作', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue({
        id: 'super-admin-id',
        role: 'SUPER_ADMIN',
        deletedAt: null,
      });

      const result = await checkKnowledgeGraphPermission(
        'super-admin-id',
        KnowledgeGraphAction.MANAGE_RELATIONS,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(true);
      expect(result.userRole).toBe('SUPER_ADMIN');
    });

    it('应该允许普通用户执行查看操作', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        role: 'USER',
        deletedAt: null,
      });

      const result = await checkKnowledgeGraphPermission(
        'user-id',
        KnowledgeGraphAction.VIEW_RELATIONS,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(true);
    });

    it('应该拒绝普通用户执行管理操作', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        role: 'USER',
        deletedAt: null,
      });

      const result = await checkKnowledgeGraphPermission(
        'user-id',
        KnowledgeGraphAction.MANAGE_RELATIONS,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('需要管理员权限');
    });

    it('应该拒绝已删除的用户', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue({
        id: 'deleted-user-id',
        role: 'ADMIN',
        deletedAt: new Date(),
      });

      const result = await checkKnowledgeGraphPermission(
        'deleted-user-id',
        KnowledgeGraphAction.VIEW_RELATIONS,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户已被删除');
    });

    it('应该拒绝不存在的用户', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await checkKnowledgeGraphPermission(
        'non-existent-user-id',
        KnowledgeGraphAction.VIEW_RELATIONS,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户不存在');
    });

    it('应该拒绝空的用户ID', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await checkKnowledgeGraphPermission(
        '',
        KnowledgeGraphAction.VIEW_RELATIONS,
        KnowledgeGraphResource.RELATION
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户不存在');
    });
  });

  describe('isKnowledgeGraphAdmin', () => {
    it('应该正确识别管理员', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'ADMIN',
        deletedAt: null,
      });

      const isAdmin = await isKnowledgeGraphAdmin('admin-id');
      expect(isAdmin).toBe(true);
    });

    it('应该正确识别超级管理员', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue({
        id: 'super-admin-id',
        role: 'SUPER_ADMIN',
        deletedAt: null,
      });

      const isAdmin = await isKnowledgeGraphAdmin('super-admin-id');
      expect(isAdmin).toBe(true);
    });

    it('应该拒绝普通用户', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        role: 'USER',
        deletedAt: null,
      });

      const isAdmin = await isKnowledgeGraphAdmin('user-id');
      expect(isAdmin).toBe(false);
    });

    it('应该拒绝已删除的用户', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue({
        id: 'deleted-admin-id',
        role: 'ADMIN',
        deletedAt: new Date(),
      });

      const isAdmin = await isKnowledgeGraphAdmin('deleted-admin-id');
      expect(isAdmin).toBe(false);
    });

    it('应该处理不存在的用户', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue(null);

      const isAdmin = await isKnowledgeGraphAdmin('non-existent-id');
      expect(isAdmin).toBe(false);
    });

    it('应该拒绝空的用户ID', async () => {
      const { prisma } = require('@/lib/db/prisma');
      prisma.user.findUnique.mockResolvedValue(null);

      const isAdmin = await isKnowledgeGraphAdmin('');
      expect(isAdmin).toBe(false);
    });
  });
});
