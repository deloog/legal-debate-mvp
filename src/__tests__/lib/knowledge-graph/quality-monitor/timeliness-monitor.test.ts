/**
 * 时效性监控模块测试
 */

import {
  TimelinessMonitor,
  calculateTimelinessMetrics,
  identifyExpiredRelations,
  identifyStaleRelations,
} from '@/lib/knowledge-graph/quality-monitor/timeliness-monitor';
import { testPrisma } from '@/test-utils/database';
import { VerificationStatus, LawStatus } from '@prisma/client';
import { setupTestDatabase, cleanupTestDatabase } from '@/test-utils/database';

describe('TimelinessMonitor', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('calculateTimelinessMetrics', () => {
    test('应该正确计算时效性指标', async () => {
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
          },
          {
            lawName: '民法典',
            articleNumber: '702',
            fullText: '测试内容',
            searchableText: '民法典 702 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      // 创建关系
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      await testPrisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: articles[0].id,
            targetId: articles[1].id,
            relationType: 'CITES',
            strength: 0.8,
            confidence: 0.9,
            verificationStatus: VerificationStatus.PENDING,
            discoveryMethod: 'MANUAL',
            createdAt: ninetyDaysAgo,
            updatedAt: ninetyDaysAgo,
          },
          {
            sourceId: articles[1].id,
            targetId: articles[0].id,
            relationType: 'CITED_BY',
            strength: 0.7,
            confidence: 0.85,
            verificationStatus: VerificationStatus.VERIFIED,
            discoveryMethod: 'MANUAL',
          },
        ],
      });

      // 执行
      const metrics = await calculateTimelinessMetrics({
        staleThresholdDays: 60,
        pendingThresholdDays: 30,
      });

      // 验证
      expect(metrics.totalRelations).toBe(2);
      expect(metrics.pendingRelations).toBe(1);
      expect(metrics.staleRelations).toBe(1);
      expect(metrics.expiredRelations).toBe(0);
    });

    test('应该正确计算待审核率', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '801',
            fullText: '测试内容',
            searchableText: '民法典 801 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '802',
            fullText: '测试内容',
            searchableText: '民法典 802 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      await testPrisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: articles[0].id,
            targetId: articles[1].id,
            relationType: 'CITES',
            strength: 0.8,
            confidence: 0.9,
            verificationStatus: VerificationStatus.PENDING,
            discoveryMethod: 'MANUAL',
          },
          {
            sourceId: articles[1].id,
            targetId: articles[0].id,
            relationType: 'CITED_BY',
            strength: 0.7,
            confidence: 0.85,
            verificationStatus: VerificationStatus.PENDING,
            discoveryMethod: 'MANUAL',
          },
        ],
      });

      // 执行
      const metrics = await calculateTimelinessMetrics({});

      // 验证
      expect(metrics.totalRelations).toBe(2);
      expect(metrics.pendingRate).toBe(1);
    });
  });

  describe('identifyExpiredRelations', () => {
    test('应该识别失效关系（法条已失效）', async () => {
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
            lawName: '旧法',
            articleNumber: '902',
            fullText: '测试内容',
            searchableText: '旧法 902 测试内容',
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

      const relation = await testPrisma.lawArticleRelation.create({
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
      const expiredRelations = await identifyExpiredRelations();

      // 验证
      expect(expiredRelations).toHaveLength(1);
      expect(expiredRelations[0].relationId).toBe(relation.id);
    });

    test('应该返回空列表（无失效关系）', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '1001',
            fullText: '测试内容',
            searchableText: '民法典 1001 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '1002',
            fullText: '测试内容',
            searchableText: '民法典 1002 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

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
      const expiredRelations = await identifyExpiredRelations();

      // 验证
      expect(expiredRelations).toHaveLength(0);
    });
  });

  describe('identifyStaleRelations', () => {
    test('应该识别过期关系', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '1101',
            fullText: '测试内容',
            searchableText: '民法典 1101 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '1102',
            fullText: '测试内容',
            searchableText: '民法典 1102 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const relation = await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: VerificationStatus.PENDING,
          discoveryMethod: 'MANUAL',
          createdAt: ninetyDaysAgo,
          updatedAt: ninetyDaysAgo,
        },
      });

      // 执行
      const staleRelations = await identifyStaleRelations(60);

      // 验证
      expect(staleRelations).toHaveLength(1);
      expect(staleRelations[0].relationId).toBe(relation.id);
      expect(staleRelations[0].daysSinceCreation).toBeGreaterThan(60);
    });

    test('应该支持不同的阈值', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '1201',
            fullText: '测试内容',
            searchableText: '民法典 1201 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '1202',
            fullText: '测试内容',
            searchableText: '民法典 1202 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
        ],
      });

      const now = new Date();
      const fortyFiveDaysAgo = new Date(
        now.getTime() - 45 * 24 * 60 * 60 * 1000
      );

      await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: VerificationStatus.PENDING,
          discoveryMethod: 'MANUAL',
          createdAt: fortyFiveDaysAgo,
          updatedAt: fortyFiveDaysAgo,
        },
      });

      // 阈值60天
      const staleRelations1 = await identifyStaleRelations(60);
      expect(staleRelations1).toHaveLength(0);

      // 阈值30天
      const staleRelations2 = await identifyStaleRelations(30);
      expect(staleRelations2).toHaveLength(1);
    });
  });

  describe('TimelinessMonitor类', () => {
    test('应该能够初始化', () => {
      const monitor = new TimelinessMonitor();
      expect(monitor).toBeDefined();
    });

    test('应该提供calculateTimelinessMetrics方法', async () => {
      const monitor = new TimelinessMonitor();
      const metrics = await monitor.calculateMetrics({});
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalRelations).toBe('number');
    });
  });
});
