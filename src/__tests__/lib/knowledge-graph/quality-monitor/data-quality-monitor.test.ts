/**
 * 数据质量监控模块测试
 */

// Mock 依赖（必须在 import 前）
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    relationFeedback: {
      findMany: jest.fn(),
    },
    lawArticle: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/test-utils/database', () => ({
  testPrisma: {
    lawArticle: { createMany: jest.fn(), create: jest.fn() },
    lawArticleRelation: { createMany: jest.fn(), create: jest.fn() },
    user: { create: jest.fn() },
  },
  setupTestDatabase: jest.fn().mockResolvedValue(undefined),
  cleanupTestDatabase: jest.fn().mockResolvedValue(undefined),
}));

import {
  DataQualityMonitor,
  generateDataQualityReport,
  calculateOverallScore,
  determineQualityLevel,
  identifyQualityIssues,
} from '@/lib/knowledge-graph/quality-monitor/data-quality-monitor';
import { prisma } from '@/lib/db';

const mockPrisma = prisma as {
  lawArticleRelation: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  relationFeedback: {
    findMany: jest.Mock;
  };
  lawArticle: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
};

function setupDefaultMocks() {
  // accuracy-monitor: lawArticleRelation.count x2, relationFeedback.findMany
  // coverage-monitor: lawArticle.count x2, lawArticleRelation.count x1
  // timeliness-monitor: lawArticleRelation.count x4

  mockPrisma.lawArticleRelation.count
    // accuracy: totalRelations, verifiedRelations
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(1)
    // coverage: totalRelations for relations
    .mockResolvedValueOnce(2)
    // timeliness: total, pending, stale, expired
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0);

  mockPrisma.relationFeedback.findMany.mockResolvedValueOnce([]);

  // coverage: totalArticles, articlesWithRelations
  mockPrisma.lawArticle.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
}

describe('DataQualityMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDataQualityReport', () => {
    test('应该生成完整的数据质量报告', async () => {
      setupDefaultMocks();

      const report = await generateDataQualityReport({});

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
      setupDefaultMocks();

      const report = await generateDataQualityReport({
        coverage: {
          minCoverageRate: 0.5,
          maxOrphanArticles: 50,
        },
      });

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
      expect(determineQualityLevel(80)).toBe('EXCELLENT');
      expect(determineQualityLevel(75)).toBe('GOOD');
      expect(determineQualityLevel(60)).toBe('GOOD'); // >= 60 is GOOD
      expect(determineQualityLevel(50)).toBe('FAIR');
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
      setupDefaultMocks();

      const monitor = new DataQualityMonitor();
      const report = await monitor.generateReport({});
      expect(report).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
    });
  });
});
