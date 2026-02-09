import {
  SuccessRateAnalyzer,
  SuccessRateAnalyzerFactory,
} from '@/lib/ai/case/success-rate-analyzer';
import { CaseResult } from '@prisma/client';
import type {
  SuccessRateAnalysisParams,
  SimilarCaseMatch,
} from '@/types/case-example';

describe('SuccessRateAnalyzer', () => {
  let analyzer: SuccessRateAnalyzer;

  beforeEach(() => {
    analyzer = new SuccessRateAnalyzer({
      minSampleSize: 5,
      confidenceThreshold: 0.7,
      weightBySimilarity: true,
    });
  });

  describe('analyze', () => {
    const mockParams: SuccessRateAnalysisParams = {
      caseId: 'test-case-1',
      minSimilarity: 0.6,
      maxCases: 20,
      includePartial: true,
      includeWithdraw: false,
    };

    it('应该返回完整的胜败率分析结果', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.WIN, 0.85),
        createMockMatch('case-3', CaseResult.WIN, 0.8),
        createMockMatch('case-4', CaseResult.LOSE, 0.75),
        createMockMatch('case-5', CaseResult.LOSE, 0.7),
        createMockMatch('case-6', CaseResult.PARTIAL, 0.65),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result).toBeDefined();
      expect(result.caseId).toBe('test-case-1');
      expect(result.winRate).toBeGreaterThan(0);
      expect(result.winProbability).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.similarCasesCount).toBe(6);
      expect(result.winCasesCount).toBe(3);
      expect(result.loseCasesCount).toBe(2);
      expect(result.partialCasesCount).toBe(1);
      expect(result.withdrawCasesCount).toBe(0);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.trend).toBeDefined();
      expect(result.analysis.recommendation).toBeDefined();
      expect(result.analysis.riskLevel).toBeDefined();
    });

    it('应该过滤相似度低于阈值的案例', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.LOSE, 0.5), // 低于阈值
        createMockMatch('case-3', CaseResult.WIN, 0.85),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.similarCasesCount).toBe(2);
      expect(result.winCasesCount).toBe(2);
    });

    it('应该限制最大案例数量', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.LOSE, 0.85),
        createMockMatch('case-3', CaseResult.WIN, 0.8),
        createMockMatch('case-4', CaseResult.LOSE, 0.75),
        createMockMatch('case-5', CaseResult.WIN, 0.7),
      ];

      const params = { ...mockParams, maxCases: 3 };
      const result = analyzer.analyze(params, mockMatches);

      expect(result.similarCasesCount).toBeLessThanOrEqual(3);
    });

    it('应该正确计算简单胜率', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.WIN, 0.85),
        createMockMatch('case-3', CaseResult.LOSE, 0.8),
        createMockMatch('case-4', CaseResult.LOSE, 0.75),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.winRate).toBeCloseTo(0.5, 2);
    });

    it('应该正确计算包含部分胜诉的胜诉概率', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.WIN, 0.85),
        createMockMatch('case-3', CaseResult.PARTIAL, 0.8),
        createMockMatch('case-4', CaseResult.LOSE, 0.75),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.winProbability).toBeCloseTo(0.625, 2);
    });

    it('应该正确分析上升趋势', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.LOSE, 0.9, '2020-01-01'),
        createMockMatch('case-2', CaseResult.LOSE, 0.85, '2020-06-01'),
        createMockMatch('case-3', CaseResult.WIN, 0.8, '2021-01-01'),
        createMockMatch('case-4', CaseResult.WIN, 0.75, '2021-06-01'),
        createMockMatch('case-5', CaseResult.WIN, 0.7, '2022-01-01'),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.analysis.trend).toBe('increasing');
    });

    it('应该正确分析下降趋势', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9, '2020-01-01'),
        createMockMatch('case-2', CaseResult.WIN, 0.85, '2020-06-01'),
        createMockMatch('case-3', CaseResult.LOSE, 0.8, '2021-01-01'),
        createMockMatch('case-4', CaseResult.LOSE, 0.75, '2021-06-01'),
        createMockMatch('case-5', CaseResult.LOSE, 0.7, '2022-01-01'),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.analysis.trend).toBe('decreasing');
    });

    it('应该正确判断稳定趋势', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9, '2020-01-01'),
        createMockMatch('case-2', CaseResult.LOSE, 0.85, '2020-06-01'),
        createMockMatch('case-3', CaseResult.WIN, 0.8, '2021-01-01'),
        createMockMatch('case-4', CaseResult.LOSE, 0.75, '2021-06-01'),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.analysis.trend).toBe('stable');
    });

    it('应该正确判断低风险', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.WIN, 0.85),
        createMockMatch('case-3', CaseResult.WIN, 0.8),
        createMockMatch('case-4', CaseResult.WIN, 0.75),
        createMockMatch('case-5', CaseResult.WIN, 0.7),
        createMockMatch('case-6', CaseResult.WIN, 0.65),
        createMockMatch('case-7', CaseResult.WIN, 0.6),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.analysis.riskLevel).toBe('low');
    });

    it('应该正确判断高风险', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.LOSE, 0.9),
        createMockMatch('case-2', CaseResult.LOSE, 0.85),
        createMockMatch('case-3', CaseResult.LOSE, 0.8),
        createMockMatch('case-4', CaseResult.LOSE, 0.75),
        createMockMatch('case-5', CaseResult.LOSE, 0.7),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.analysis.riskLevel).toBe('high');
    });

    it('应该正确判断中风险', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.LOSE, 0.85),
        createMockMatch('case-3', CaseResult.WIN, 0.8),
        createMockMatch('case-4', CaseResult.LOSE, 0.75),
        createMockMatch('case-5', CaseResult.WIN, 0.7),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.analysis.riskLevel).toBe('medium');
    });

    it('置信度低时应该返回高风险', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.WIN, 0.85),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.confidence).toBeLessThan(0.7);
      expect(result.analysis.riskLevel).toBe('high');
    });

    it('应该生成合适的建议', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.WIN, 0.85),
        createMockMatch('case-3', CaseResult.WIN, 0.8),
        createMockMatch('case-4', CaseResult.WIN, 0.75),
        createMockMatch('case-5', CaseResult.WIN, 0.7),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.analysis.recommendation).toBeTruthy();
      expect(result.analysis.recommendation).toContain('胜诉概率较高');
    });

    it('应该处理空匹配列表', () => {
      const result = analyzer.analyze(mockParams, []);

      expect(result.similarCasesCount).toBe(0);
      expect(result.winCasesCount).toBe(0);
      expect(result.loseCasesCount).toBe(0);
      expect(result.partialCasesCount).toBe(0);
      expect(result.withdrawCasesCount).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.winProbability).toBe(0);
    });

    it('应该计算包含撤诉的胜率', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.LOSE, 0.85),
        createMockMatch('case-3', CaseResult.WITHDRAW, 0.8),
      ];

      const params = { ...mockParams, includeWithdraw: true };
      const result = analyzer.analyze(params, mockMatches);

      expect(result.withdrawCasesCount).toBe(1);
      expect(result.winProbability).toBeGreaterThan(0);
    });

    it('应该排除撤诉计算胜率', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.LOSE, 0.85),
        createMockMatch('case-3', CaseResult.WITHDRAW, 0.8),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.withdrawCasesCount).toBe(1);
      // 撤诉被排除，只计算胜诉和败诉
      expect(result.winProbability).toBeCloseTo(0.5, 2);
    });

    it('应该正确处理部分胜诉', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.PARTIAL, 0.85),
        createMockMatch('case-3', CaseResult.PARTIAL, 0.8),
      ];

      const params = { ...mockParams, includePartial: true };
      const result = analyzer.analyze(params, mockMatches);

      expect(result.partialCasesCount).toBe(2);
      // 当只有WIN和PARTIAL案例时，PARTIAL不计入计算，结果为WIN案例的胜率
      expect(result.winProbability).toBeCloseTo(1.0, 2);
    });

    it('应该处理案例数量不足的情况', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9),
        createMockMatch('case-2', CaseResult.WIN, 0.85),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.confidence).toBeLessThan(0.7);
      expect(result.analysis.recommendation).toContain('相似案例数量较少');
    });

    it('应该处理置信度低的情况', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.6),
        createMockMatch('case-2', CaseResult.LOSE, 0.55),
        createMockMatch('case-3', CaseResult.WIN, 0.5),
        createMockMatch('case-4', CaseResult.LOSE, 0.45),
        createMockMatch('case-5', CaseResult.WIN, 0.4),
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.confidence).toBeLessThan(0.7);
      expect(result.analysis.recommendation).toContain('置信度较低');
    });

    it('应该按相似度加权计算胜率', () => {
      const mockMatches: SimilarCaseMatch[] = [
        createMockMatch('case-1', CaseResult.WIN, 0.9), // 高相似度
        createMockMatch('case-2', CaseResult.LOSE, 0.5), // 低相似度
      ];

      const result = analyzer.analyze(mockParams, mockMatches);

      expect(result.winRate).toBeGreaterThan(0.5);
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      analyzer.updateConfig({
        minSampleSize: 10,
        confidenceThreshold: 0.8,
        weightBySimilarity: false,
      });

      const config = analyzer.getConfig();
      expect(config.minSampleSize).toBe(10);
      expect(config.confidenceThreshold).toBe(0.8);
      expect(config.weightBySimilarity).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('应该返回配置', () => {
      const config = analyzer.getConfig();
      expect(config).toBeDefined();
      expect(config.minSampleSize).toBe(5);
      expect(config.confidenceThreshold).toBe(0.7);
      expect(config.weightBySimilarity).toBe(true);
    });
  });
});

describe('SuccessRateAnalyzerFactory', () => {
  afterEach(() => {
    SuccessRateAnalyzerFactory.clearAllInstances();
  });

  describe('getInstance', () => {
    it('应该返回单例实例', () => {
      const instance1 = SuccessRateAnalyzerFactory.getInstance('test', {
        minSampleSize: 5,
      });
      const instance2 = SuccessRateAnalyzerFactory.getInstance('test');

      expect(instance1).toBe(instance2);
    });

    it('应该为不同名称创建不同实例', () => {
      const instance1 = SuccessRateAnalyzerFactory.getInstance('test1', {
        minSampleSize: 5,
      });
      const instance2 = SuccessRateAnalyzerFactory.getInstance('test2', {
        minSampleSize: 5,
      });

      expect(instance1).not.toBe(instance2);
    });

    it('应该使用默认名称创建实例', () => {
      const instance = SuccessRateAnalyzerFactory.getInstance();
      expect(instance).toBeDefined();
    });
  });

  describe('removeInstance', () => {
    it('应该移除指定实例', () => {
      SuccessRateAnalyzerFactory.getInstance('test', { minSampleSize: 5 });
      const removed = SuccessRateAnalyzerFactory.removeInstance('test');

      expect(removed).toBe(true);
    });

    it('应该返回false如果实例不存在', () => {
      const removed = SuccessRateAnalyzerFactory.removeInstance('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('getAllInstances', () => {
    it('应该返回所有实例', () => {
      SuccessRateAnalyzerFactory.getInstance('test1');
      SuccessRateAnalyzerFactory.getInstance('test2');

      const instances = SuccessRateAnalyzerFactory.getAllInstances();

      expect(instances.size).toBe(2);
    });
  });

  describe('clearAllInstances', () => {
    it('应该清除所有实例', () => {
      SuccessRateAnalyzerFactory.getInstance('test1');
      SuccessRateAnalyzerFactory.getInstance('test2');
      SuccessRateAnalyzerFactory.clearAllInstances();

      const instances = SuccessRateAnalyzerFactory.getAllInstances();
      expect(instances.size).toBe(0);
    });
  });
});

function createMockMatch(
  id: string,
  result: CaseResult,
  similarity: number,
  judgmentDate: string = '2020-01-01'
): SimilarCaseMatch {
  return {
    caseExample: {
      id,
      title: `Case ${id}`,
      caseNumber: `CN-${id}`,
      court: 'Test Court',
      type: 'CIVIL' as const,
      cause: 'Test Cause',
      facts: 'Test facts',
      judgment: 'Test judgment',
      result,
      judgmentDate: new Date(judgmentDate),
      createdAt: new Date(judgmentDate),
      updatedAt: new Date(judgmentDate),
      embedding: [1, 2, 3],
      metadata: {},
      dataSource: 'cail',
      sourceId: null,
      importedAt: null,
    },
    similarity,
    matchingFactors: [],
  };
}
