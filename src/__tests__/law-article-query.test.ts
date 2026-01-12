import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient, LawCategory, LawType, LawStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 法条查询测试
 * 测试法条数据的导入和查询功能
 */

describe('法条查询测试', () => {
  let testArticleId: string;

  beforeAll(async () => {
    // 确保测试数据已导入
    const count = await prisma.lawArticle.count();
    if (count === 0) {
      console.warn('警告：数据库中没有法条数据，请先运行数据导入脚本');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('基础查询', () => {
    it('应该能够查询所有法条', async () => {
      const articles = await prisma.lawArticle.findMany({
        take: 10,
      });

      expect(Array.isArray(articles)).toBe(true);
      if (articles.length > 0) {
        expect(articles[0]).toHaveProperty('id');
        expect(articles[0]).toHaveProperty('lawName');
        expect(articles[0]).toHaveProperty('articleNumber');
        expect(articles[0]).toHaveProperty('fullText');
      }
    });

    it('应该能够按类别查询法条', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          category: LawCategory.CIVIL,
        },
      });

      expect(Array.isArray(articles)).toBe(true);
      articles.forEach(article => {
        expect(article.category).toBe(LawCategory.CIVIL);
      });
    });

    it('应该能够按法律名称查询法条', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          lawName: '中华人民共和国民法典',
        },
      });

      expect(Array.isArray(articles)).toBe(true);
      articles.forEach(article => {
        expect(article.lawName).toBe('中华人民共和国民法典');
      });
    });

    it('应该能够按法条编号查询法条', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          articleNumber: '第五百零九条',
        },
      });

      expect(Array.isArray(articles)).toBe(true);
      articles.forEach(article => {
        expect(article.articleNumber).toContain('第五百零九条');
      });
    });
  });

  describe('高级查询', () => {
    it('应该能够按多个条件组合查询', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          category: LawCategory.CIVIL,
          status: LawStatus.VALID,
        },
      });

      expect(Array.isArray(articles)).toBe(true);
      articles.forEach(article => {
        expect(article.category).toBe(LawCategory.CIVIL);
        expect(article.status).toBe(LawStatus.VALID);
      });
    });

    it('应该能够按子类别查询法条', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          subCategory: '合同编',
        },
      });

      expect(Array.isArray(articles)).toBe(true);
      articles.forEach(article => {
        expect(article.subCategory).toBe('合同编');
      });
    });

    it('应该能够按关键字查询法条', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          keywords: {
            hasSome: ['合同'],
          },
        },
      });

      expect(Array.isArray(articles)).toBe(true);
    });

    it('应该能够按标签查询法条', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          tags: {
            hasSome: ['合同'],
          },
        },
      });

      expect(Array.isArray(articles)).toBe(true);
    });
  });

  describe('全文搜索', () => {
    it('应该能够在全文文本中搜索关键词', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          fullText: {
            contains: '合同',
          },
        },
        take: 5,
      });

      expect(Array.isArray(articles)).toBe(true);
      articles.forEach(article => {
        expect(article.fullText).toContain('合同');
      });
    });

    it('应该能够在可搜索文本中搜索', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          searchableText: {
            contains: '合同',
          },
        },
        take: 5,
      });

      expect(Array.isArray(articles)).toBe(true);
    });
  });

  describe('统计查询', () => {
    it('应该能够统计各类别法条数量', async () => {
      const results = await prisma.lawArticle.groupBy({
        by: ['category'],
        _count: true,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('_count');
      });
    });

    it('应该能够统计总法条数', async () => {
      const count = await prisma.lawArticle.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('应该能够统计特定类别的法条数', async () => {
      const count = await prisma.lawArticle.count({
        where: {
          category: LawCategory.CIVIL,
        },
      });
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('排序和分页', () => {
    it('应该能够按创建时间排序', async () => {
      const articles = await prisma.lawArticle.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      });

      expect(Array.isArray(articles)).toBe(true);
      if (articles.length > 1) {
        for (let i = 0; i < articles.length - 1; i++) {
          const date1 = new Date(articles[i].createdAt).getTime();
          const date2 = new Date(articles[i + 1].createdAt).getTime();
          expect(date1).toBeGreaterThanOrEqual(date2);
        }
      }
    });

    it('应该能够按浏览次数排序', async () => {
      const articles = await prisma.lawArticle.findMany({
        orderBy: {
          viewCount: 'desc',
        },
        take: 5,
      });

      expect(Array.isArray(articles)).toBe(true);
      if (articles.length > 1) {
        for (let i = 0; i < articles.length - 1; i++) {
          expect(articles[i].viewCount).toBeGreaterThanOrEqual(
            articles[i + 1].viewCount
          );
        }
      }
    });

    it('应该能够支持分页查询', async () => {
      const pageSize = 5;
      const page1 = await prisma.lawArticle.findMany({
        skip: 0,
        take: pageSize,
      });

      const page2 = await prisma.lawArticle.findMany({
        skip: pageSize,
        take: pageSize,
      });

      expect(Array.isArray(page1)).toBe(true);
      expect(Array.isArray(page2)).toBe(true);
      expect(page1.length).toBeLessThanOrEqual(pageSize);
      expect(page2.length).toBeLessThanOrEqual(pageSize);
    });
  });

  describe('关联查询', () => {
    it('应该能够查询法条的父子层级关系', async () => {
      const articles = await prisma.lawArticle.findMany({
        where: {
          parentId: { not: null },
        },
        include: {
          parent: true,
        },
      });

      expect(Array.isArray(articles)).toBe(true);
    });

    it('应该能够查询法条的子法条', async () => {
      const articles = await prisma.lawArticle.findMany({
        include: {
          children: true,
        },
        take: 3,
      });

      expect(Array.isArray(articles)).toBe(true);
    });
  });

  describe('数据验证', () => {
    it('导入的法条应该包含所有必要字段', async () => {
      const articles = await prisma.lawArticle.findMany({
        take: 10,
      });

      articles.forEach(article => {
        expect(article.lawName).toBeTruthy();
        expect(article.articleNumber).toBeTruthy();
        expect(article.fullText).toBeTruthy();
        expect(article.category).toBeTruthy();
        expect(article.lawType).toBeTruthy();
        expect(article.status).toBeTruthy();
        expect(article.effectiveDate).toBeTruthy();
        expect(article.searchableText).toBeTruthy();
      });
    });

    it('导入的法条应该有正确的枚举值', async () => {
      const articles = await prisma.lawArticle.findMany({
        take: 10,
      });

      articles.forEach(article => {
        expect(Object.values(LawCategory)).toContain(article.category);
        expect(Object.values(LawType)).toContain(article.lawType);
        expect(Object.values(LawStatus)).toContain(article.status);
      });
    });
  });
});
