import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient, LawType, LawCategory, LawStatus } from '@prisma/client';

const prisma = new PrismaClient();

describe('LawArticle索引性能测试', () => {
  const TOTAL_ARTICLES = 1000;
  const testArticleIds: string[] = [];

  beforeAll(async () => {
    // 清理现有数据
    await prisma.lawArticle.deleteMany({});

    // 准备测试数据
    const lawTypes = [LawType.LAW, LawType.ADMINISTRATIVE_REGULATION, LawType.JUDICIAL_INTERPRETATION];
    const categories = [LawCategory.CIVIL, LawCategory.CRIMINAL, LawCategory.ADMINISTRATIVE];
    const statuses = [LawStatus.VALID, LawStatus.AMENDED, LawStatus.EXPIRED];

    // 批量创建测试数据
    const batchSize = 100;
    for (let i = 0; i < TOTAL_ARTICLES; i += batchSize) {
      const articles = [];
      for (let j = 0; j < batchSize && i + j < TOTAL_ARTICLES; j++) {
        const index = i + j;
        articles.push({
          lawName: `测试法律_${Math.floor(index / 100)}`,
          articleNumber: `第${index}条`,
          fullText: `这是第${index}条法条的完整内容，用于测试索引性能。`,
          lawType: lawTypes[index % lawTypes.length],
          category: categories[index % categories.length],
          subCategory: index % 10 === 0 ? `子分类_${Math.floor(index / 10)}` : null,
          tags: index % 5 === 0 ? [`标签_${index % 10}`, `标签_${(index + 1) % 10}`] : [],
          keywords: index % 3 === 0 ? [`关键词_${index % 20}`] : [],
          version: `${Math.floor(index / 100) + 1}.0`,
          effectiveDate: new Date(2020 + (index % 5), index % 12, 1),
          status: statuses[index % statuses.length],
          issuingAuthority: '测试机构',
          searchableText: `法条${index}内容用于测试搜索性能`,
          level: index % 3,
        });
      }

      const created = await prisma.lawArticle.createMany({ data: articles });
      
      // 获取创建的ID用于后续测试
      const createdArticles = await prisma.lawArticle.findMany({
        where: {
          articleNumber: {
            in: articles.slice(0, created.count).map(a => a.articleNumber),
          },
        },
        select: { id: true },
        orderBy: { articleNumber: 'asc' },
      });
      testArticleIds.push(...createdArticles.map(a => a.id));
    }

    console.log(`已创建 ${TOTAL_ARTICLES} 条测试数据`);
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.lawArticle.deleteMany({});
    await prisma.$disconnect();
  });

  describe('基础索引测试', () => {
    it('应该通过lawType索引快速查询', async () => {
      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        where: { lawType: LawType.LAW },
        select: { id: true, lawType: true },
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // 查询应在100ms内完成
      console.log(`lawType索引查询耗时: ${duration}ms, 返回${results.length}条记录`);
    });

    it('应该通过category索引快速查询', async () => {
      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        where: { category: LawCategory.CIVIL },
        select: { id: true, category: true },
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
      console.log(`category索引查询耗时: ${duration}ms, 返回${results.length}条记录`);
    });

    it('应该通过status索引快速查询', async () => {
      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        where: { status: LawStatus.VALID },
        select: { id: true, status: true },
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
      console.log(`status索引查询耗时: ${duration}ms, 返回${results.length}条记录`);
    });

    it('应该通过effectiveDate索引快速查询', async () => {
      const startDate = new Date('2022-01-01');
      const endDate = new Date('2023-12-31');

      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        where: {
          effectiveDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { id: true, effectiveDate: true },
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
      console.log(`effectiveDate索引查询耗时: ${duration}ms, 返回${results.length}条记录`);
    });
  });

  describe('复合查询性能测试', () => {
    it('应该高效执行多条件查询', async () => {
      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        where: {
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          status: LawStatus.VALID,
        },
        select: { id: true, lawType: true, category: true, status: true },
        take: 50,
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
      console.log(`复合条件查询耗时: ${duration}ms, 返回${results.length}条记录`);
    });

    it('应该支持带排序的查询', async () => {
      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        where: { category: LawCategory.CIVIL },
        orderBy: { effectiveDate: 'desc' },
        take: 100,
        select: { id: true, effectiveDate: true },
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      // 验证排序正确
      for (let i = 1; i < results.length; i++) {
        expect(results[i].effectiveDate.getTime()).toBeLessThanOrEqual(
          results[i - 1].effectiveDate.getTime(),
        );
      }
      expect(duration).toBeLessThan(100);
      console.log(`带排序查询耗时: ${duration}ms, 返回${results.length}条记录`);
    });
  });

  describe('统计查询性能测试', () => {
    it('应该快速统计各类型法条数量', async () => {
      const startTime = Date.now();
      const lawTypeCounts = await prisma.lawArticle.groupBy({
        by: ['lawType'],
        _count: { id: true },
      });
      const duration = Date.now() - startTime;

      expect(lawTypeCounts.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(200);
      console.log(`分组统计查询耗时: ${duration}ms, 返回${lawTypeCounts.length}个分组`);
      console.log('各类型法条数量:', lawTypeCounts.map(g => `${g.lawType}: ${g._count.id}`));
    });

    it('应该快速计算总数', async () => {
      const startTime = Date.now();
      const totalCount = await prisma.lawArticle.count();
      const duration = Date.now() - startTime;

      expect(totalCount).toBe(TOTAL_ARTICLES);
      expect(duration).toBeLessThan(50);
      console.log(`总数查询耗时: ${duration}ms, 总数: ${totalCount}`);
    });

    it('应该快速计算条件过滤后的数量', async () => {
      const startTime = Date.now();
      const filteredCount = await prisma.lawArticle.count({
        where: {
          status: LawStatus.VALID,
          category: LawCategory.CIVIL,
        },
      });
      const duration = Date.now() - startTime;

      expect(filteredCount).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
      console.log(`条件过滤计数耗时: ${duration}ms, 数量: ${filteredCount}`);
    });
  });

  describe('搜索性能测试', () => {
    it('应该通过articleNumber索引快速查找', async () => {
      const targetNumber = '第100条';
      const startTime = Date.now();
      const result = await prisma.lawArticle.findFirst({
        where: { articleNumber: targetNumber },
        select: { id: true, articleNumber: true },
      });
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result?.articleNumber).toBe(targetNumber);
      expect(duration).toBeLessThan(50);
      console.log(`articleNumber精确查询耗时: ${duration}ms`);
    });

    it('应该通过lawName索引快速查询', async () => {
      const targetLawName = '测试法律_0';
      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        where: { lawName: targetLawName },
        select: { id: true, lawName: true },
        take: 50,
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].lawName).toBe(targetLawName);
      expect(duration).toBeLessThan(100);
      console.log(`lawName查询耗时: ${duration}ms, 返回${results.length}条记录`);
    });

    it('应该通过tags索引快速筛选', async () => {
      const targetTag = '标签_0';
      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        where: { tags: { has: targetTag } },
        select: { id: true, tags: true },
        take: 50,
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].tags).toContain(targetTag);
      expect(duration).toBeLessThan(100);
      console.log(`tags数组查询耗时: ${duration}ms, 返回${results.length}条记录`);
    });
  });

  describe('分页查询性能测试', () => {
    it('应该高效执行分页查询', async () => {
      const pageSize = 50;
      const page = 5;
      const skip = (page - 1) * pageSize;

      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        where: { category: LawCategory.CIVIL },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true },
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeLessThanOrEqual(pageSize);
      expect(duration).toBeLessThan(100);
      console.log(`分页查询耗时: ${duration}ms, 第${page}页, 返回${results.length}条记录`);
    });

    it('应该高效执行游标分页查询', async () => {
      const pageSize = 50;
      const cursorId = testArticleIds[99]; // 使用第100条记录的ID作为游标

      const startTime = Date.now();
      const results = await prisma.lawArticle.findMany({
        take: pageSize,
        cursor: { id: cursorId },
        skip: 1,
        select: { id: true, articleNumber: true },
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBeLessThanOrEqual(pageSize);
      expect(duration).toBeLessThan(100);
      console.log(`游标分页查询耗时: ${duration}ms, 返回${results.length}条记录`);
    });
  });

  describe('更新和删除性能测试', () => {
    it('应该通过索引快速更新单条记录', async () => {
      const targetId = testArticleIds[0];
      const startTime = Date.now();
      const updated = await prisma.lawArticle.update({
        where: { id: targetId },
        data: { viewCount: { increment: 1 } },
        select: { id: true, viewCount: true },
      });
      const duration = Date.now() - startTime;

      expect(updated.viewCount).toBe(1);
      expect(duration).toBeLessThan(50);
      console.log(`单条记录更新耗时: ${duration}ms`);
    });

    it('应该高效执行批量更新', async () => {
      const targetIds = testArticleIds.slice(0, 100);
      const startTime = Date.now();
      
      // 分批更新避免单次事务过大
      const batchSize = 10;
      for (let i = 0; i < targetIds.length; i += batchSize) {
        const batch = targetIds.slice(i, i + batchSize);
        await prisma.lawArticle.updateMany({
          where: { id: { in: batch } },
          data: { referenceCount: { increment: 1 } },
        });
      }

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // 100条记录应在500ms内更新完成
      console.log(`批量更新耗时: ${duration}ms, 更新了${targetIds.length}条记录`);
    });

    it('应该通过索引快速删除单条记录', async () => {
      // 创建一条临时记录用于删除测试
      const tempArticle = await prisma.lawArticle.create({
        data: {
          lawName: '临时测试法律',
          articleNumber: '临时条',
          fullText: '临时内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: ['临时'],
          keywords: ['临时'],
          effectiveDate: new Date(),
          issuingAuthority: '测试机构',
          searchableText: '临时内容',
        },
      });

      const startTime = Date.now();
      await prisma.lawArticle.delete({ where: { id: tempArticle.id } });
      const duration = Date.now() - startTime;

      const deleted = await prisma.lawArticle.findUnique({
        where: { id: tempArticle.id },
      });
      expect(deleted).toBeNull();
      expect(duration).toBeLessThan(50);
      console.log(`单条记录删除耗时: ${duration}ms`);
    });
  });
});
