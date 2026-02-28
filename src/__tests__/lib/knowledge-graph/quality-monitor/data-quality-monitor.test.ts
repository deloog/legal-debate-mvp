/**
 * 数据质量监控模块测试
 */

import {
  DataQualityMonitor,
  generateDataQualityReport,
  calculateOverallScore,
  determineQualityLevel,
  identifyQualityIssues,
} from '@/lib/knowledge-graph/quality-monitor/data-quality-monitor';
import { testPrisma } from '@/test-utils/database';
import { VerificationStatus, LawStatus } from '@prisma/client';
import { setupTestDatabase, cleanupTestDatabase } from '@/test-utils/database';

describe('DataQualityMonitor', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('generateDataQualityReport', () => {
    test('应该生成完整的数据质量报告', async () => {
      // 准备测试数据
      const articles = await testPrisma.lawArticle.createMany({
        data: [
          {
            lawName: '民法典',
            articleNumber: '1',
            fullText: '测试内容',
            searchableText: '民法典 1 测试内容',
            lawType: 'LAW',
            category: 'CIVIL',
            keywords: [],
            tags: [],
            issuingAuthority: '全国人大',
            effectiveDate: new Date('2020-01-01'),
          },
          {
            lawName: '民法典',
            articleNumber: '2',
            fullText: '测试内容',
            searchableText: '民法典 2 测试内容',
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
      await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: VerificationStatus.VERIFIED,
          discoveryMethod: 'MANUAL',
        },
      });

      // 执行
      const report = await generateDataQualityReport({});

      // 验证
      expect(report).toBeDefined();
      expect(report.reportTime).toBeInstanceOf(Date);
      expect(report.accuracy).toBeDefined();
      expect(report.coverage).toBeDefined();
      expect(report.timeliness).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(
        report.qualityLevel
      );
      expect(Array.isArray(report.issues)).toBe(true);
    });

    test('应该支持自定义配置', async () => {
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
        ],
      });

      await testPrisma.lawArticleRelation.create({
        data: {
          sourceId: articles[0].id,
          targetId: articles[1].id,
          relationType: 'CITES',
          strength: 0.8,
          confidence: 0.9,
          verificationStatus: VerificationStatus.VERIFIED,
          discoveryMethod: 'MANUAL',
        },
      });

      // 执行
      const report = await generateDataQualityReport({
        coverage: {
          minCoverageRate: 0.5,
          maxOrphanArticles: 50,
        },
      });

      // 验证
      expect(report).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateOverallScore', () => {
    test('应该正确计算总体评分', () => {
      const accuracy = {
        totalRelations: 100,
        verifiedRelations: 80,
        userFeedbackCount: 20,
        positiveFeedbackCount: 15,
        negativeFeedbackCount: 5,
        positiveFeedbackRate: 0.75,
        verificationRate: 0.8,
      };

      const coverage = {
        totalArticles: 100,
        articlesWithRelations: 80,
        coverageRate: 0.8,
        averageRelationsPerArticle: 1.6,
        orphanArticles: 20,
      };

      const timeliness = {
        totalRelations: 100,
        pendingRelations: 10,
        pendingRate: 0.1,
        staleRelations: 5,
        staleRate: 0.05,
        expiredRelations: 0,
        expiredRate: 0,
      };

      const score = calculateOverallScore(accuracy, coverage, timeliness);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('应该处理空数据', () => {
      const accuracy = {
        totalRelations: 0,
        verifiedRelations: 0,
        userFeedbackCount: 0,
        positiveFeedbackCount: 0,
        negativeFeedbackCount: 0,
        positiveFeedbackRate: 0,
        verificationRate: 0,
      };

      const coverage = {
        totalArticles: 0,
        articlesWithRelations: 0,
        coverageRate: 0,
        averageRelationsPerArticle: 0,
        orphanArticles: 0,
      };

      const timeliness = {
        totalRelations: 0,
        pendingRelations: 0,
        pendingRate: 0,
        staleRelations: 0,
        staleRate: 0,
        expiredRelations: 0,
        expiredRate: 0,
      };

      const score = calculateOverallScore(accuracy, coverage, timeliness);

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('determineQualityLevel', () => {
    test('应该根据评分确定质量等级', () => {
      expect(determineQualityLevel(95)).toBe('EXCELLENT');
      expect(determineQualityLevel(85)).toBe('EXCELLENT');
      expect(determineQualityLevel(75)).toBe('GOOD');
      expect(determineQualityLevel(60)).toBe('FAIR');
      expect(determineQualityLevel(40)).toBe('POOR');
    });

    test('应该处理边界情况', () => {
      expect(determineQualityLevel(80)).toBe('EXCELLENT');
      expect(determineQualityLevel(79)).toBe('GOOD');
      expect(determineQualityLevel(50)).toBe('FAIR');
      expect(determineQualityLevel(49)).toBe('POOR');
    });
  });

  describe('identifyQualityIssues', () => {
    test('应该识别准确性问题', () => {
      const accuracy = {
        totalRelations: 100,
        verifiedRelations: 50,
        userFeedbackCount: 20,
        positiveFeedbackCount: 5,
        negativeFeedbackCount: 15,
        positiveFeedbackRate: 0.25,
        verificationRate: 0.5,
      };

      const coverage = {
        totalArticles: 100,
        articlesWithRelations: 80,
        coverageRate: 0.8,
        averageRelationsPerArticle: 1.6,
        orphanArticles: 20,
      };

      const timeliness = {
        totalRelations: 100,
        pendingRelations: 10,
        pendingRate: 0.1,
        staleRelations: 5,
        staleRate: 0.05,
        expiredRelations: 0,
        expiredRate: 0,
      };

      const issues = identifyQualityIssues(accuracy, coverage, timeliness, {
        accuracy: {
          lowQualityThreshold: 0.5,
          minFeedbackCount: 3,
        },
        coverage: {
          minCoverageRate: 0.8,
          maxOrphanArticles: 100,
        },
        timeliness: {
          staleThresholdDays: 90,
          pendingThresholdDays: 30,
        },
      });

      const accuracyIssues = issues.filter(issue => issue.type === 'ACCURACY');
      expect(accuracyIssues.length).toBeGreaterThan(0);
    });

    test('应该识别覆盖率问题', () => {
      const accuracy = {
        totalRelations: 100,
        verifiedRelations: 80,
        userFeedbackCount: 20,
        positiveFeedbackCount: 15,
        negativeFeedbackCount: 5,
        positiveFeedbackRate: 0.75,
        verificationRate: 0.8,
      };

      const coverage = {
        totalArticles: 100,
        articlesWithRelations: 50,
        coverageRate: 0.5,
        averageRelationsPerArticle: 1.0,
        orphanArticles: 50,
      };

      const timeliness = {
        totalRelations: 100,
        pendingRelations: 10,
        pendingRate: 0.1,
        staleRelations: 5,
        staleRate: 0.05,
        expiredRelations: 0,
        expiredRate: 0,
      };

      const issues = identifyQualityIssues(accuracy, coverage, timeliness, {
        accuracy: {
          lowQualityThreshold: 0.5,
          minFeedbackCount: 3,
        },
        coverage: {
          minCoverageRate: 0.8,
          maxOrphanArticles: 100,
        },
        timeliness: {
          staleThresholdDays: 90,
          pendingThresholdDays: 30,
        },
      });

      const coverageIssues = issues.filter(issue => issue.type === 'COVERAGE');
      expect(coverageIssues.length).toBeGreaterThan(0);
    });

    test('应该识别时效性问题', () => {
      const accuracy = {
        totalRelations: 100,
        verifiedRelations: 80,
        userFeedbackCount: 20,
        positiveFeedbackCount: 15,
        negativeFeedbackCount: 5,
        positiveFeedbackRate: 0.75,
        verificationRate: 0.8,
      };

      const coverage = {
        totalArticles: 100,
        articlesWithRelations: 80,
        coverageRate: 0.8,
        averageRelationsPerArticle: 1.6,
        orphanArticles: 20,
      };

      const timeliness = {
        totalRelations: 100,
        pendingRelations: 50,
        pendingRate: 0.5,
        staleRelations: 30,
        staleRate: 0.3,
        expiredRelations: 10,
        expiredRate: 0.1,
      };

      const issues = identifyQualityIssues(accuracy, coverage, timeliness, {
        accuracy: {
          lowQualityThreshold: 0.5,
          minFeedbackCount: 3,
        },
        coverage: {
          minCoverageRate: 0.8,
          maxOrphanArticles: 100,
        },
        timeliness: {
          staleThresholdDays: 90,
          pendingThresholdDays: 30,
        },
      });

      const timelinessIssues = issues.filter(
        issue => issue.type === 'TIMELINESS'
      );
      expect(timelinessIssues.length).toBeGreaterThan(0);
    });
  });

  describe('DataQualityMonitor类', () => {
    test('应该能够初始化', () => {
      const monitor = new DataQualityMonitor();
      expect(monitor).toBeDefined();
    });

    test('应该提供generateReport方法', async () => {
      const monitor = new DataQualityMonitor();
      const report = await monitor.generateReport({});
      expect(report).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
    });
  });
});
