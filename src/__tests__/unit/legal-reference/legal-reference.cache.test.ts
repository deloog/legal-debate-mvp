import { PrismaClient, _LegalReferenceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, afterEach } from '@jest/globals';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

describe('Legal Reference Cache Management', () => {
  let testRefId: string;
  let testUserId: string;

  beforeEach(async () => {
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: 'test-cache@example.com',
        username: 'testcache',
        name: 'Cache Test User',
        role: 'USER',
      },
    });
    testUserId = user.id;

    // 清理测试数据
    await prisma.legalReference.deleteMany({
      where: {
        source: {
          contains: 'cache-test-',
        },
      },
    });
  });

  afterEach(async () => {
    // 清理测试数据
    if (testRefId) {
      await prisma.legalReference.delete({
        where: {
          id: testRefId,
        },
      });
      testRefId = '';
    }

    if (testUserId) {
      await prisma.user.delete({
        where: {
          id: testUserId,
        },
      });
      testUserId = '';
    }
  });

  describe('Cache Creation', () => {
    it('should create legal reference with cache metadata', async () => {
      const now = new Date();
      const expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const refData = {
        source: 'cache-test-《民法典》',
        content: '测试缓存功能的法条内容。',
        lawType: '民法',
        articleNumber: '第1条',
        cacheSource: 'lawstar',
        cacheExpiry: expiryTime,
        hitCount: 0,
        lastAccessed: now,
      };

      const legalRef = await prisma.legalReference.create({
        data: refData,
      });

      testRefId = legalRef.id;

      expect(legalRef.cacheSource).toBe(refData.cacheSource);
      expect(legalRef.cacheExpiry).toEqual(expiryTime);
      expect(legalRef.hitCount).toBe(0);
      expect(legalRef.lastAccessed).toEqual(now);
    });

    it('should support different cache sources', async () => {
      const sources = ['local', 'lawstar', 'manual', 'ai-analysis'];

      for (const source of sources) {
        const refData = {
          source: `cache-test-${source}-《测试法》`,
          content: `来自${source}的法条`,
          lawType: '测试法',
          cacheSource: source,
        };

        const legalRef = await prisma.legalReference.create({
          data: refData,
        });

        expect(legalRef.cacheSource).toBe(source);
      }
    });
  });

  describe('Cache Hit Tracking', () => {
    it('should increment hit count on access', async () => {
      const legalRef = await prisma.legalReference.create({
        data: {
          source: 'cache-test-hit-《测试法》',
          content: '测试命中计数的法条',
          lawType: '测试法',
          hitCount: 10,
        },
      });

      testRefId = legalRef.id;
      expect(legalRef.hitCount).toBe(10);

      // 模拟多次访问
      for (let i = 0; i < 3; i++) {
        await prisma.legalReference.update({
          where: { id: legalRef.id },
          data: {
            hitCount: { increment: 1 },
            lastAccessed: new Date(),
          },
        });
      }

      const updatedRef = await prisma.legalReference.findUnique({
        where: { id: legalRef.id },
      });

      expect(updatedRef?.hitCount).toBe(13);
      expect(updatedRef?.lastAccessed).toBeDefined();
    });

    it('should track access patterns', async () => {
      const legalRef = await prisma.legalReference.create({
        data: {
          source: 'cache-test-pattern-《测试法》',
          content: '测试访问模式的法条',
          lawType: '测试法',
        },
      });

      testRefId = legalRef.id;

      const accessTimes = [];

      // 模拟不同时间的访问
      for (let i = 0; i < 5; i++) {
        const accessTime = new Date(Date.now() + i * 1000);

        await prisma.legalReference.update({
          where: { id: legalRef.id },
          data: {
            hitCount: { increment: 1 },
            lastAccessed: accessTime,
          },
        });

        accessTimes.push(accessTime);
      }

      const finalRef = await prisma.legalReference.findUnique({
        where: { id: legalRef.id },
      });

      expect(finalRef?.hitCount).toBe(5);
      expect(finalRef?.lastAccessed).toEqual(
        accessTimes[accessTimes.length - 1]
      );
    });
  });

  describe('Cache Expiry', () => {
    it('should identify expired cache entries', async () => {
      const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前过期
      const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期

      await prisma.legalReference.createMany({
        data: [
          {
            source: 'cache-test-expired-《过期法条》',
            content: '已过期的法条',
            lawType: '测试法',
            cacheExpiry: pastExpiry,
          },
          {
            source: 'cache-test-valid-《有效法条》',
            content: '仍然有效的法条',
            lawType: '测试法',
            cacheExpiry: futureExpiry,
          },
        ],
      });

      const now = new Date();

      const expiredRefs = await prisma.legalReference.findMany({
        where: {
          cacheExpiry: {
            lte: now,
          },
        },
      });

      const validRefs = await prisma.legalReference.findMany({
        where: {
          cacheExpiry: {
            gt: now,
          },
        },
      });

      expect(expiredRefs).toHaveLength(1);
      expect(expiredRefs[0].source).toContain('过期法条');
      expect(validRefs).toHaveLength(1);
      expect(validRefs[0].source).toContain('有效法条');
    });

    it('should support cache refresh', async () => {
      const originalExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期

      const legalRef = await prisma.legalReference.create({
        data: {
          source: 'cache-test-refresh-《测试法条》',
          content: '需要刷新的法条',
          lawType: '测试法',
          cacheExpiry: originalExpiry,
        },
      });

      testRefId = legalRef.id;

      // 模拟刷新缓存
      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
      const refreshedRef = await prisma.legalReference.update({
        where: { id: legalRef.id },
        data: {
          cacheExpiry: newExpiry,
          hitCount: { increment: 1 },
          lastAccessed: new Date(),
        },
      });

      expect(refreshedRef.cacheExpiry).toEqual(newExpiry);
      expect(refreshedRef.cacheExpiry).not.toEqual(originalExpiry);
    });
  });

  describe('Cache Performance', () => {
    it('should handle high-frequency access efficiently', async () => {
      const legalRef = await prisma.legalReference.create({
        data: {
          source: 'cache-test-perf-《性能测试法条》',
          content: '性能测试的法条',
          lawType: '测试法',
        },
      });

      testRefId = legalRef.id;

      const startTime = Date.now();

      // 模拟高频访问
      for (let i = 0; i < 100; i++) {
        await prisma.legalReference.update({
          where: { id: legalRef.id },
          data: {
            hitCount: { increment: 1 },
            lastAccessed: new Date(),
          },
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 验证性能（每次更新应该在合理时间内完成）
      expect(duration).toBeLessThan(5000); // 5秒内完成100次更新

      const finalRef = await prisma.legalReference.findUnique({
        where: { id: legalRef.id },
      });

      expect(finalRef?.hitCount).toBe(100);
    });

    it('should maintain cache statistics', async () => {
      const _refs = await prisma.legalReference.createMany({
        data: [
          {
            source: 'cache-test-stats-1《统计法条1》',
            content: '统计测试1',
            lawType: '测试法',
            hitCount: 50,
            cacheSource: 'local',
          },
          {
            source: 'cache-test-stats-2《统计法条2》',
            content: '统计测试2',
            lawType: '测试法',
            hitCount: 30,
            cacheSource: 'lawstar',
          },
          {
            source: 'cache-test-stats-3《统计法条3》',
            content: '统计测试3',
            lawType: '测试法',
            hitCount: 20,
            cacheSource: 'manual',
          },
        ],
      });

      // 获取缓存统计，过滤掉null值
      const rawStats = await prisma.legalReference.groupBy({
        by: ['cacheSource'],
        _sum: {
          hitCount: true,
        },
        _count: {
          id: true,
        },
      });

      // 过滤掉null值，只统计有效的缓存源
      const cacheStats = rawStats.filter(stat => stat.cacheSource !== null);

      expect(cacheStats).toHaveLength(3);

      const localStats = cacheStats.find(stat => stat.cacheSource === 'local');
      const lawstarStats = cacheStats.find(
        stat => stat.cacheSource === 'lawstar'
      );
      const manualStats = cacheStats.find(
        stat => stat.cacheSource === 'manual'
      );

      expect(localStats?._sum.hitCount).toBe(50);
      expect(lawstarStats?._sum.hitCount).toBe(30);
      expect(manualStats?._sum.hitCount).toBe(20);
    });
  });
});
