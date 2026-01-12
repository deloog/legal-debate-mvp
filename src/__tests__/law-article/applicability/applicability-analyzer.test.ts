import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import ApplicabilityAnalyzer from '@/lib/law-article/applicability/applicability-analyzer';
import {
  createMockCaseInfo,
  createMockArticles,
  createMixedArticles,
} from './test-data';
import type { ApplicabilityInput } from '@/lib/law-article/applicability/types';

describe('ApplicabilityAnalyzer', () => {
  let analyzer: ApplicabilityAnalyzer;

  beforeAll(async () => {
    analyzer = new ApplicabilityAnalyzer();
    await analyzer.initialize();
  });

  afterAll(async () => {
    await analyzer.destroy();
  });

  beforeEach(() => {
    // 重置任何需要重置的状态
  });

  describe('initialize', () => {
    it('应该成功初始化', async () => {
      const newAnalyzer = new ApplicabilityAnalyzer();
      await expect(newAnalyzer.initialize()).resolves.not.toThrow();
      await newAnalyzer.destroy();
    });

    it('应该能够重复初始化', async () => {
      await expect(analyzer.initialize()).resolves.not.toThrow();
    });
  });

  describe('analyze', () => {
    it('应该分析法条的适用性', async () => {
      const articles = createMockArticles(5);
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
      };

      const result = await analyzer.analyze(input);

      expect(result.analyzedAt).toBeInstanceOf(Date);
      expect(result.totalArticles).toBe(5);
      expect(result.results.length).toBe(5);
      expect(result.statistics.executionTime).toBeGreaterThan(0);
    });

    it('应该正确计算适用和不适用法条数量', async () => {
      const articles = createMixedArticles();
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
      };

      const result = await analyzer.analyze(input);

      expect(result.applicableArticles).toBeGreaterThanOrEqual(0);
      expect(result.notApplicableArticles).toBeGreaterThanOrEqual(0);
      expect(result.applicableArticles + result.notApplicableArticles).toBe(
        result.totalArticles
      );
    });

    it('应该按适用性评分排序结果', async () => {
      const articles = createMockArticles(10);
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
      };

      const result = await analyzer.analyze(input);

      const scores = result.results.map(r => r.score);
      const sortedScores = [...scores].sort((a, b) => b - a);

      expect(scores).toEqual(sortedScores);
    });

    it('应该正确处理自定义配置', async () => {
      const articles = createMockArticles(3);
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
        config: {
          useAI: false,
          useRuleValidation: true,
          useAIReview: false,
          minApplicabilityScore: 0.7,
        },
      };

      const result = await analyzer.analyze(input);

      expect(result.config.useAI).toBe(false);
      expect(result.config.useAIReview).toBe(false);
      expect(result.config.minApplicabilityScore).toBe(0.7);
    });

    it('应该生成详细的适用性原因', async () => {
      const articles = createMockArticles(3);
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
        config: {
          useAIReview: false, // 禁用AI审查以获得确定性的测试结果
        },
      };

      const result = await analyzer.analyze(input);

      result.results.forEach(r => {
        expect(r.reasons).toBeDefined();
        expect(Array.isArray(r.reasons)).toBe(true);
        if (r.warnings.length > 0) {
          expect(r.warnings).toBeDefined();
        }
      });
    });
  });

  describe('性能测试', () => {
    it('应该在2秒内完成10条法条的分析', async () => {
      const articles = createMockArticles(10);
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
        config: {
          useAIReview: false, // 禁用AI审查以确保快速执行
        },
      };

      const startTime = Date.now();
      const result = await analyzer.analyze(input);
      const endTime = Date.now();

      expect(result.totalArticles).toBe(10);
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('应该记录各阶段耗时', async () => {
      const articles = createMockArticles(5);
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
        config: {
          useAI: false, // 禁用AI以确保稳定的测试结果
          useRuleValidation: true, // 启用规则验证
          useAIReview: false, // 禁用AI审查
        },
      };

      const result = await analyzer.analyze(input);

      expect(result.statistics.semanticMatchingTime).toBeGreaterThanOrEqual(0);
      expect(result.statistics.ruleValidationTime).toBeGreaterThanOrEqual(0);
      expect(result.statistics.aiReviewTime).toBeGreaterThanOrEqual(0);
      expect(result.statistics.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('综合评分计算', () => {
    it('应该正确计算最终适用性评分', async () => {
      const articles = createMockArticles(5);
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
        config: {
          useAIReview: false,
        },
      };

      const result = await analyzer.analyze(input);

      result.results.forEach(r => {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
        expect(r.semanticScore).toBeGreaterThanOrEqual(0);
        expect(r.semanticScore).toBeLessThanOrEqual(1);
        expect(r.ruleScore).toBeGreaterThanOrEqual(0);
        expect(r.ruleScore).toBeLessThanOrEqual(1);
      });
    });

    it('应该基于配置的阈值判断是否适用', async () => {
      const articles = createMockArticles(5);
      const caseInfo = createMockCaseInfo();

      const lowThresholdInput: ApplicabilityInput = {
        caseInfo,
        articles,
        config: {
          minApplicabilityScore: 0.3,
          useAIReview: false,
        },
      };

      const highThresholdInput: ApplicabilityInput = {
        caseInfo,
        articles,
        config: {
          minApplicabilityScore: 0.8,
          useAIReview: false,
        },
      };

      const lowThresholdResult = await analyzer.analyze(lowThresholdInput);
      const highThresholdResult = await analyzer.analyze(highThresholdInput);

      const lowApplicableCount = lowThresholdResult.results.filter(
        r => r.applicable
      ).length;
      const highApplicableCount = highThresholdResult.results.filter(
        r => r.applicable
      ).length;

      expect(lowApplicableCount).toBeGreaterThanOrEqual(highApplicableCount);
    });
  });

  describe('统计信息', () => {
    it('应该正确计算统计信息', async () => {
      const articles = createMockArticles(10);
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
        config: {
          useAIReview: false,
        },
      };

      const result = await analyzer.analyze(input);

      expect(result.statistics.averageScore).toBeGreaterThan(0);
      expect(result.statistics.averageScore).toBeLessThanOrEqual(1);
      expect(result.statistics.maxScore).toBeLessThanOrEqual(1);
      expect(result.statistics.minScore).toBeGreaterThanOrEqual(0);
      expect(result.statistics.maxScore).toBeGreaterThanOrEqual(
        result.statistics.minScore
      );
      expect(result.statistics.applicableRatio).toBeGreaterThanOrEqual(0);
      expect(result.statistics.applicableRatio).toBeLessThanOrEqual(1);
    });

    it('应该提供按类型分组的统计', async () => {
      const articles = createMixedArticles();
      const caseInfo = createMockCaseInfo();

      const input: ApplicabilityInput = {
        caseInfo,
        articles,
      };

      const result = await analyzer.analyze(input);

      expect(result.statistics.byType).toBeDefined();
      expect(result.statistics.byCategory).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('应该能够清理资源', async () => {
      const newAnalyzer = new ApplicabilityAnalyzer();
      await newAnalyzer.initialize();
      await expect(newAnalyzer.destroy()).resolves.not.toThrow();
    });
  });
});
