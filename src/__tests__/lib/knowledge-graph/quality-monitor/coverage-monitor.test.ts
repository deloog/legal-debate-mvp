/**
 * 覆盖率监控模块测试
 */

import {
  CoverageMonitor,
  calculateCoverageMetrics,
  identifyOrphanArticles,
} from '@/lib/knowledge-graph/quality-monitor/coverage-monitor';
import { testPrisma } from '@/test-utils/database';
import { LawStatus, LawType } from '@prisma/client';
import { setupTestDatabase, cleanupTestDatabase } from '@/test-utils/database';

describe('CoverageMonitor', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('calculateCoverageMetrics', () => {
    test('应该正确计算覆盖率指标', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '101',
            fullText: '测试内容',
            searchableText: '民法典 101 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '102',
            fullText: '测试内容',
            searchableText: '民法典 102 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '103',
            fullText: '测试内容',
            searchableText: '民法典 103 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      // 创建关系（101 -> 102, 102 -> 103）
      await testPrisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: articles[0].id,
            targetId: articles[1].id,
            relationType: 'CITES',
            strength: 0.8,
            confidence: 0.9,
            verificationStatus: 'VERIFIED',
            discoveryMethod: 'MANUAL',
          },
          {
            sourceId: articles[1].id,
            targetId: articles[2].id,
            relationType: 'CITED_BY',
            strength: 0.7,
            confidence: 0.85,
            verificationStatus: 'VERIFIED',
            discoveryMethod: 'MANUAL',
          },
        ],
      });

      // 执行
      const metrics = await calculateCoverageMetrics({});

      // 验证
      expect(metrics.totalArticles).toBe(3);
      expect(metrics.articlesWithRelations).toBe(3); // 3个法条都有关系
      expect(metrics.coverageRate).toBe(1);
      expect(metrics.orphanArticles).toBe(0);
    });

    test('应该正确计算孤立法条', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '201',
            fullText: '测试内容',
            searchableText: '民法典 201 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '202',
            fullText: '测试内容',
            searchableText: '民法典 202 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '203',
            fullText: '测试内容',
            searchableText: '民法典 203 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      // 只为201和202创建关系，203孤立
      await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: 'VERIFIED',
          discoveryMethod: 'MANUAL',
        },
      });

      // 执行
      const metrics = await calculateCoverageMetrics({});

      // 验证
      expect(metrics.totalArticles).toBe(3);
      expect(metrics.articlesWithRelations).toBe(2);
      expect(metrics.coverageRate).toBeCloseTo(2 / 3);
      expect(metrics.orphanArticles).toBe(1);
    });

    test('应该支持按法条类型过滤', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '301',
            fullText: '测试内容',
            searchableText: '民法典 301 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '刑法',
            articleNumber: '401',
            fullText: '测试内容',
            searchableText: '刑法 401 测试内容',
            lawType: 'LAW',
            category: 'CRIMINAL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      // 只为民法典创建关系
      await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: 'VERIFIED',
          discoveryMethod: 'MANUAL',
        },
      });

      // 执行 - 只查询CIVIL类别
      const metrics = await calculateCoverageMetrics({
        category: 'CIVIL',
      });

      // 验证 - 只有1个法条属于CIVIL类别
      expect(metrics.totalArticles).toBe(1);
    });

    test('应该计算平均每个法条的关系数', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '501',
            fullText: '测试内容',
            searchableText: '民法典 501 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '502',
            fullText: '测试内容',
            searchableText: '民法典 502 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      // 创建3个关系
      await testPrisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: articles[0].id,
            targetId: articles[1].id,
            relationType: 'CITES',
            strength: 0.8,
            confidence: 0.9,
            verificationStatus: 'VERIFIED',
            discoveryMethod: 'MANUAL',
          },
          {
            sourceId: articles[1].id,
            targetId: articles[0].id,
            relationType: 'CITED_BY',
            strength: 0.7,
            confidence: 0.85,
            verificationStatus: 'VERIFIED',
            discoveryMethod: 'MANUAL',
          },
          {
            sourceId: articles[0].id,
            targetId: articles[1].id,
            relationType: 'CONFLICTS',
            strength: 0.6,
            confidence: 0.7,
            verificationStatus: 'VERIFIED',
            discoveryMethod: 'MANUAL',
          },
        ],
      });

      // 执行
      const metrics = await calculateCoverageMetrics({});

      // 验证 - 2个法条，3个关系，平均1.5个关系/法条
      expect(metrics.totalArticles).toBe(2);
      expect(metrics.averageRelationsPerArticle).toBeCloseTo(1.5);
    });
  });

  describe('identifyOrphanArticles', () => {
    test('应该识别孤立法条', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '601',
            fullText: '测试内容',
            searchableText: '民法典 601 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '602',
            fullText: '测试内容',
            searchableText: '民法典 602 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      // 只为601创建关系
      await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: 'VERIFIED',
          discoveryMethod: 'MANUAL',
        },
      });

      // 执行
      const orphanArticles = await identifyOrphanArticles({});

      // 验证
      expect(orphanArticles).toHaveLength(1);
      expect(orphanArticles[0].articleNumber).toBe('602');
    });

    test('应该支持按法条状态过滤', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '701',
            fullText: '测试内容',
            searchableText: '民法典 701 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
            status: LawStatus.VALID,
          },
          {
            lawName: '旧法',
            articleNumber: '801',
            fullText: '测试内容',
            searchableText: '旧法 801 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('1990-01-01'),
            expiryDate: new Date('2020-01-01'),
            status: LawStatus.EXPIRED,
          },
        ],
      });

      // 执行 - 只查询VALID状态的法条
      const orphanArticles = await identifyOrphanArticles({
        status: LawStatus.VALID,
      });

      // 验证 - 只有VALID状态的法条
      expect(orphanArticles).toHaveLength(1);
      expect(orphanArticles[0].status).toBe(LawStatus.VALID);
    });

    test('应该返回空的孤立法条列表（所有法条都有关系）', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '901',
            fullText: '测试内容',
            searchableText: '民法典 901 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '902',
            fullText: '测试内容',
            searchableText: '民法典 902 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      // 为所有法条创建关系
      await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: 'VERIFIED',
          discoveryMethod: 'MANUAL',
        },
      });

      // 执行
      const orphanArticles = await identifyOrphanArticles({});

      // 验证
      expect(orphanArticles).toHaveLength(0);
    });
  });

  describe('CoverageMonitor类', () => {
    test('应该能够初始化', () => {
      const monitor = new CoverageMonitor();
      expect(monitor).toBeDefined();
    });

    test('应该提供calculateCoverageMetrics方法', async () => {
      const monitor = new CoverageMonitor();
      const metrics = await monitor.calculateMetrics({});
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalArticles).toBe('number');
    });

    test('应该提供identifyOrphanArticles方法', async () => {
      const monitor = new CoverageMonitor();
      const orphanArticles = await monitor.identifyOrphanArticles({});
      expect(Array.isArray(orphanArticles)).toBe(true);
    });
  });
});
