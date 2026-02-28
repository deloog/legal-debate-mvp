// =============================================================================
// 知识图谱质量评分系统 - 评分计算器测试
// =============================================================================

import { ScoreCalculator } from '@/lib/knowledge-graph/quality-score/score-calculator';
import {
  QualityScoreInput,
  QualityLevel,
  ScoreFactors,
} from '@/lib/knowledge-graph/quality-score/types';
import { logger } from '@/lib/logger';

// Mock logger
jest.mock('@/lib/logger');

describe('ScoreCalculator', () => {
  let calculator: ScoreCalculator;

  beforeEach(() => {
    calculator = new ScoreCalculator();
    jest.clearAllMocks();
  });

  describe('calculateQualityScore - 评分计算功能', () => {
    it('正常评分计算 - 所有因子都有值', () => {
      const input: QualityScoreInput = {
        aiConfidence: 0.8,
        verificationCount: 5,
        positiveFeedback: 10,
        negativeFeedback: 2,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result).toBeDefined();
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
      expect(result.qualityLevel).toBeDefined();
      expect(result.factors).toBeDefined();
    });

    it('缺少AI置信度时的默认值处理', () => {
      const input: QualityScoreInput = {
        verificationCount: 3,
        positiveFeedback: 5,
        negativeFeedback: 1,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result).toBeDefined();
      expect(result.factors.aiScore).toBe(0.5); // 默认值
    });

    it('缺少用户反馈时的默认值处理', () => {
      const input: QualityScoreInput = {
        aiConfidence: 0.9,
        verificationCount: 2,
        positiveFeedback: 0,
        negativeFeedback: 0,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result).toBeDefined();
      expect(result.factors.feedbackScore).toBe(0.7); // 默认值
    });

    it('高质量关系评分 (≥90)', () => {
      const input: QualityScoreInput = {
        aiConfidence: 0.95,
        verificationCount: 10,
        positiveFeedback: 20,
        negativeFeedback: 0,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result.qualityScore).toBeGreaterThanOrEqual(90);
      expect(result.qualityLevel).toBe('excellent');
    });

    it('中等质量关系评分 (60-75)', () => {
      const input: QualityScoreInput = {
        aiConfidence: 0.7,
        verificationCount: 5,
        positiveFeedback: 8,
        negativeFeedback: 4,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result.qualityScore).toBeGreaterThanOrEqual(60);
      expect(result.qualityScore).toBeLessThan(75);
      expect(result.qualityLevel).toBe('medium');
    });

    it('低质量关系评分 (<60)', () => {
      const input: QualityScoreInput = {
        aiConfidence: 0.3,
        verificationCount: 0,
        positiveFeedback: 1,
        negativeFeedback: 10,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result.qualityScore).toBeLessThan(60);
      expect(result.qualityLevel).toBe('low');
    });

    it('验证次数饱和处理 (超过10次)', () => {
      const input: QualityScoreInput = {
        aiConfidence: 0.8,
        verificationCount: 20, // 超过10次
        positiveFeedback: 5,
        negativeFeedback: 1,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result).toBeDefined();
      // 验证次数分数应该饱和在1.0
      expect(result.factors.verificationScore).toBeLessThanOrEqual(1);
    });

    it('用户反馈极端情况 - 全正面', () => {
      const input: QualityScoreInput = {
        aiConfidence: 0.8,
        verificationCount: 5,
        positiveFeedback: 10,
        negativeFeedback: 0,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result.factors.feedbackScore).toBe(1.0);
    });

    it('用户反馈极端情况 - 全负面', () => {
      const input: QualityScoreInput = {
        aiConfidence: 0.8,
        verificationCount: 5,
        positiveFeedback: 0,
        negativeFeedback: 10,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result.factors.feedbackScore).toBe(0);
    });
  });

  describe('determineQualityLevel - 质量等级判定', () => {
    it('excellent等级判定 (≥90分)', () => {
      const level = calculator.determineQualityLevel(95);
      expect(level).toBe('excellent');

      const level2 = calculator.determineQualityLevel(90);
      expect(level2).toBe('excellent');
    });

    it('high等级判定 (75-90分)', () => {
      const level = calculator.determineQualityLevel(80);
      expect(level).toBe('high');

      const level2 = calculator.determineQualityLevel(75);
      expect(level2).toBe('high');

      const level3 = calculator.determineQualityLevel(89.9);
      expect(level3).toBe('high');
    });

    it('medium等级判定 (60-75分)', () => {
      const level = calculator.determineQualityLevel(65);
      expect(level).toBe('medium');

      const level2 = calculator.determineQualityLevel(60);
      expect(level2).toBe('medium');

      const level3 = calculator.determineQualityLevel(74.9);
      expect(level3).toBe('medium');
    });

    it('low等级判定 (<60分)', () => {
      const level = calculator.determineQualityLevel(30);
      expect(level).toBe('low');

      const level2 = calculator.determineQualityLevel(0);
      expect(level2).toBe('low');

      const level3 = calculator.determineQualityLevel(59.9);
      expect(level3).toBe('low');
    });
  });

  describe('calculateAIScore - AI置信度分数计算', () => {
    it('正确计算AI置信度分数', () => {
      const score = calculator.calculateAIScore(0.8);
      expect(score).toBe(0.8);

      const score2 = calculator.calculateAIScore(1.0);
      expect(score2).toBe(1.0);

      const score3 = calculator.calculateAIScore(0.5);
      expect(score3).toBe(0.5);
    });

    it('AI置信度为null时返回默认值', () => {
      const score = calculator.calculateAIScore(null);
      expect(score).toBe(0.5);

      const score2 = calculator.calculateAIScore(undefined);
      expect(score2).toBe(0.5);
    });

    it('AI置信度为0时返回0', () => {
      const score = calculator.calculateAIScore(0);
      expect(score).toBe(0);
    });
  });

  describe('calculateVerificationScore - 验证次数分数计算', () => {
    it('正确计算验证次数分数', () => {
      const score = calculator.calculateVerificationScore(5);
      expect(score).toBe(0.5);

      const score2 = calculator.calculateVerificationScore(10);
      expect(score2).toBe(1.0);

      const score3 = calculator.calculateVerificationScore(0);
      expect(score3).toBe(0);
    });

    it('验证次数超过10时饱和处理', () => {
      const score = calculator.calculateVerificationScore(15);
      expect(score).toBe(1.0);

      const score2 = calculator.calculateVerificationScore(100);
      expect(score2).toBe(1.0);
    });

    it('验证次数为负数时返回0', () => {
      const score = calculator.calculateVerificationScore(-5);
      expect(score).toBe(0);
    });
  });

  describe('calculateFeedbackScore - 用户反馈分数计算', () => {
    it('正确计算用户反馈分数', () => {
      const score = calculator.calculateFeedbackScore(8, 2);
      expect(score).toBe(0.8);

      const score2 = calculator.calculateFeedbackScore(5, 5);
      expect(score2).toBe(0.5);

      const score3 = calculator.calculateFeedbackScore(10, 0);
      expect(score3).toBe(1.0);

      const score4 = calculator.calculateFeedbackScore(0, 10);
      expect(score4).toBe(0);
    });

    it('没有反馈时返回默认值', () => {
      const score = calculator.calculateFeedbackScore(0, 0);
      expect(score).toBe(0.7); // 默认值
    });

    it('总反馈数为0时返回默认值', () => {
      const score = calculator.calculateFeedbackScore(0, 0);
      expect(score).toBe(0.7);
    });
  });

  describe('边界情况处理', () => {
    it('所有因子为空时的处理', () => {
      const input: QualityScoreInput = {
        verificationCount: 0,
        positiveFeedback: 0,
        negativeFeedback: 0,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result).toBeDefined();
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.factors.aiScore).toBe(0.5); // 默认值
      expect(result.factors.feedbackScore).toBe(0.7); // 默认值
    });

    it('负值输入处理', () => {
      const input: QualityScoreInput = {
        aiConfidence: -0.5,
        verificationCount: -10,
        positiveFeedback: -5,
        negativeFeedback: -3,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result).toBeDefined();
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('超出范围值处理 - AI置信度大于1', () => {
      const input: QualityScoreInput = {
        aiConfidence: 1.5,
        verificationCount: 5,
        positiveFeedback: 3,
        negativeFeedback: 1,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result).toBeDefined();
      expect(result.factors.aiScore).toBeLessThanOrEqual(1);
    });

    it('超出范围值处理 - AI置信度小于0', () => {
      const input: QualityScoreInput = {
        aiConfidence: -0.2,
        verificationCount: 5,
        positiveFeedback: 3,
        negativeFeedback: 1,
      };

      const result = calculator.calculateQualityScore(input);

      expect(result).toBeDefined();
      expect(result.factors.aiScore).toBeGreaterThanOrEqual(0);
    });
  });
});
