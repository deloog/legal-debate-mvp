/**
 * 数据库查询优化测试套件
 * 测试数据库查询性能和索引优化效果
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/db/prisma';
import {
  buildPaginationOptions,
  buildOrderBy,
  analyzeQueryOptimization,
} from '@/lib/db/query-optimizer';

/**
 * 数据库查询优化测试套件
 */
describe('数据库查询优化测试', () => {
  beforeEach(async () => {
    // 清理测试数据
    await prisma.debate.deleteMany({});
    await prisma.case.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterEach(async () => {
    // 清理测试数据
    await prisma.debate.deleteMany({});
    await prisma.case.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('分页查询优化', () => {
    it('应该正确构建分页选项', () => {
      const options1 = buildPaginationOptions({ page: 1, limit: 20 });
      expect(options1).toEqual({ skip: 0, take: 20 });

      const options2 = buildPaginationOptions({ page: 2, limit: 20 });
      expect(options2).toEqual({ skip: 20, take: 20 });

      const options3 = buildPaginationOptions({ page: 1, limit: 150 });
      expect(options3).toEqual({ skip: 0, take: 100 }); // 限制最大100条
    });

    it('应该限制最大查询数量', () => {
      const options1 = buildPaginationOptions({ page: 1, limit: 50 });
      expect(options1.take).toBeLessThanOrEqual(100);

      const options2 = buildPaginationOptions({ page: 1, limit: 1000 });
      expect(options2.take).toBe(100);
    });
  });

  describe('排序查询优化', () => {
    it('应该正确构建排序选项', () => {
      const validFields = ['createdAt', 'updatedAt', 'title', 'status'];

      // 有效的排序字段
      const orderBy1 = buildOrderBy('createdAt', 'desc', validFields);
      expect(orderBy1).toEqual({ createdAt: 'desc' });

      // 无效的排序字段（使用默认）
      const orderBy2 = buildOrderBy('invalidField', 'asc', validFields);
      expect(orderBy2).toEqual({ createdAt: 'desc' });
    });

    it('应该支持多种排序顺序', () => {
      const validFields = ['createdAt', 'updatedAt', 'title'];

      const orderByAsc = buildOrderBy('createdAt', 'asc', validFields);
      expect(orderByAsc).toEqual({ createdAt: 'asc' });

      const orderByDesc = buildOrderBy('createdAt', 'desc', validFields);
      expect(orderByDesc).toEqual({ createdAt: 'desc' });
    });
  });

  describe('案件查询性能测试', () => {
    beforeEach(async () => {
      // 创建测试用户
      const userId = 'test-user-id';
      await prisma.user.create({
        data: {
          id: userId,
          email: 'test-user@example.com',
          username: 'test-user',
          password: 'hashed-password',
        },
      });

      const caseType = 'CIVIL';
      const status = 'ACTIVE';

      // 创建50个测试案件
      const cases = Array.from({ length: 50 }, (_, i) => ({
        userId,
        title: `测试案件${i + 1}`,
        description: `测试案件描述${i + 1}`,
        type: caseType as 'CIVIL',
        status: status as 'ACTIVE',
        createdAt: new Date(Date.now() - i * 1000 * 60), // 每个间隔1分钟
      }));

      await prisma.case.createMany({ data: cases, skipDuplicates: true });
    });

    it('分页查询应该在合理时间内完成', async () => {
      const startTime = Date.now();
      const options = buildPaginationOptions({ page: 1, limit: 20 });
      const cases = await prisma.case.findMany({
        where: { deletedAt: null },
        ...options,
        orderBy: { createdAt: 'desc' },
      });
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(cases).toHaveLength(20);
      expect(queryTime).toBeLessThan(500); // 应该在500ms内完成
    });

    it('复合索引查询应该更快', async () => {
      const startTime = Date.now();
      const cases = await prisma.case.findMany({
        where: {
          userId: 'test-user-id',
          status: 'ACTIVE',
          deletedAt: null,
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(cases).toBeDefined();
      expect(queryTime).toBeLessThan(300); // 复合索引应该更快
    });

    it('带搜索条件的查询应该高效', async () => {
      const startTime = Date.now();
      const cases = await prisma.case.findMany({
        where: {
          deletedAt: null,
          title: { contains: '测试', mode: 'insensitive' },
        },
        take: 20,
      });
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(cases).toBeDefined();
      expect(queryTime).toBeLessThan(1000);
    });
  });

  describe('辩论查询性能测试', () => {
    beforeEach(async () => {
      // 创建测试用户
      const userId = 'test-user-id';
      const caseId = 'test-case-id';
      await prisma.user.create({
        data: {
          id: userId,
          email: 'test-user@example.com',
          username: 'test-user',
          password: 'hashed-password',
        },
      });

      // 先创建一个案件
      await prisma.case.create({
        data: {
          id: caseId,
          userId,
          title: '测试案件',
          description: '测试案件描述',
          type: 'CIVIL',
          status: 'ACTIVE',
        },
      });

      // 创建30个测试辩论
      const debates = Array.from({ length: 30 }, (_, i) => ({
        caseId,
        userId,
        title: `测试辩论${i + 1}`,
        status: 'DRAFT' as const,
        createdAt: new Date(Date.now() - i * 1000 * 60),
      }));

      await prisma.debate.createMany({
        data: debates,
        skipDuplicates: true,
      });
    });

    it('辩论分页查询应该高效', async () => {
      const startTime = Date.now();
      const debates = await prisma.debate.findMany({
        where: {
          caseId: 'test-case-id',
          deletedAt: null,
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(debates).toBeDefined();
      expect(queryTime).toBeLessThan(500);
    });

    it('带关联数据的查询应该优化', async () => {
      const startTime = Date.now();
      const debates = await prisma.debate.findMany({
        where: {
          caseId: 'test-case-id',
          deletedAt: null,
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          case: {
            select: {
              id: true,
              title: true,
              type: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(debates).toBeDefined();
      // 关联查询可能稍慢，但仍应该在合理时间内
      expect(queryTime).toBeLessThan(1000);
    });
  });

  describe('并发查询测试', () => {
    beforeEach(async () => {
      // 创建测试用户
      const userId = 'test-user-id';
      await prisma.user.create({
        data: {
          id: userId,
          email: 'test-user@example.com',
          username: 'test-user',
          password: 'hashed-password',
        },
      });

      const cases = Array.from({ length: 100 }, (_, i) => ({
        userId,
        title: `并发测试案件${i + 1}`,
        description: `并发测试描述${i + 1}`,
        type: 'CIVIL' as const,
        status: 'ACTIVE' as const,
      }));

      await prisma.case.createMany({ data: cases, skipDuplicates: true });
    });

    it('多个并发查询应该正常处理', async () => {
      const startTime = Date.now();
      const queries = Array.from({ length: 5 }, (_, i) =>
        prisma.case.findMany({
          where: { deletedAt: null },
          take: 20,
          skip: i * 20,
        })
      );

      const results = await Promise.all(queries);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // 并发查询应该在合理时间内完成
      expect(totalTime).toBeLessThan(2000);
    });
  });

  describe('查询优化建议测试', () => {
    it('应该识别慢查询', () => {
      const suggestions = analyzeQueryOptimization('case-list', {
        executionTime: 1500,
        resultCount: 50,
        hasIncludes: true,
        hasJoins: true,
      });

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.type === 'inefficient-join')).toBe(true);
    });

    it('应该识别大数据集', () => {
      const suggestions = analyzeQueryOptimization('case-list', {
        executionTime: 500,
        resultCount: 150,
        hasIncludes: false,
        hasJoins: false,
      });

      expect(suggestions).toBeDefined();
      expect(suggestions.some(s => s.type === 'large-result-set')).toBe(true);
    });
  });
});
