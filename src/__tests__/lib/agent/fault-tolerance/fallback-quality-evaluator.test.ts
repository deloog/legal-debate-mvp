/**
 * FallbackQualityEvaluator 测试
 * 测试降级质量评估器的各项功能
 */

import { describe, it, expect } from '@jest/globals';
import type { ExtractedData } from '@/lib/agent/doc-analyzer/core/types';

// 导入待测试的类（稍后实现）
import { FallbackQualityEvaluator } from '@/lib/agent/fault-tolerance/fallback-quality-evaluator';

describe('FallbackQualityEvaluator', () => {
  let evaluator: FallbackQualityEvaluator;

  beforeEach(() => {
    evaluator = new FallbackQualityEvaluator();
  });

  describe('evaluate - 总体评估', () => {
    it('应该正确评估规则降级结果（高质量）', () => {
      const result: ExtractedData = {
        parties: [
          { type: 'plaintiff', name: '张三', role: '原告' },
          { type: 'defendant', name: '李四', role: '被告' },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款10万元',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');

      expect(evaluation.quality).toBe('high');
      expect(evaluation.score).toBeGreaterThan(0.8);
      expect(evaluation.shouldRetry).toBe(false);
      expect(evaluation.warnings).toHaveLength(0);
    });

    it('应该正确评估规则降级结果（中等质量）', () => {
      const result: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');

      expect(evaluation.quality).toBe('medium');
      expect(evaluation.score).toBeGreaterThan(0.5);
      expect(evaluation.score).toBeLessThanOrEqual(0.8);
      expect(evaluation.shouldRetry).toBe(false);
      expect(evaluation.warnings.length).toBeGreaterThan(0);
    });

    it('应该正确评估规则降级结果（低质量）', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');

      expect(evaluation.quality).toBe('low');
      expect(evaluation.score).toBeLessThan(0.5);
      expect(evaluation.shouldRetry).toBe(true);
      expect(evaluation.warnings.length).toBeGreaterThan(0);
    });

    it('应该正确评估缓存降级结果', () => {
      const result: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 50000,
            currency: 'CNY',
          },
        ],
      };

      const evaluation = evaluator.evaluate(result, 'CACHED');

      expect(evaluation.quality).toBe('high');
      expect(evaluation.score).toBeGreaterThanOrEqual(0.9);
      expect(evaluation.shouldRetry).toBe(false);
    });

    it('应该正确评估模板降级结果', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'TEMPLATE');

      expect(evaluation.quality).toBe('medium');
      expect(evaluation.score).toBe(0.5);
      expect(evaluation.shouldRetry).toBe(false);
      expect(evaluation.warnings).toContain('使用模板降级，结果可能不准确');
    });

    it('应该处理空结果', () => {
      const evaluation = evaluator.evaluate(null, 'RULE_BASED');

      expect(evaluation.quality).toBe('low');
      expect(evaluation.score).toBe(0);
      expect(evaluation.shouldRetry).toBe(true);
      expect(evaluation.warnings).toContain('规则降级返回空结果');
    });

    it('应该处理未定义结果', () => {
      const evaluation = evaluator.evaluate(undefined, 'CACHED');

      expect(evaluation.quality).toBe('low');
      expect(evaluation.score).toBe(0);
      expect(evaluation.shouldRetry).toBe(true);
      expect(evaluation.warnings).toContain('缓存降级返回空结果');
    });
  });

  describe('evaluateRuleBasedResult - 规则降级评估', () => {
    it('应该对完整的规则结果给予高分', () => {
      const result: ExtractedData = {
        parties: [
          { type: 'plaintiff', name: '张三', role: '原告' },
          { type: 'defendant', name: '李四', role: '被告' },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款10万元',
            amount: 100000,
            currency: 'CNY',
          },
          {
            type: 'PAY_INTEREST',
            content: '支付利息',
            amount: 5000,
            currency: 'CNY',
          },
        ],
      };

      const warnings: string[] = [];
      const score = evaluator['evaluateRuleBasedResult'](result, warnings);

      expect(score).toBe(1.0);
      expect(warnings).toHaveLength(0);
    });

    it('应该对缺少当事人的结果扣分', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const warnings: string[] = [];
      const score = evaluator['evaluateRuleBasedResult'](result, warnings);

      expect(score).toBeCloseTo(0.55, 2);
      expect(warnings).toContain('规则降级未提取到当事人');
    });

    it('应该对缺少诉讼请求的结果扣分', () => {
      const result: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      };

      const warnings: string[] = [];
      const score = evaluator['evaluateRuleBasedResult'](result, warnings);

      expect(score).toBeCloseTo(0.55, 2);
      expect(warnings).toContain('规则降级未提取到诉讼请求');
    });

    it('应该对同时缺少当事人和诉讼请求的结果给予低分', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [],
      };

      const warnings: string[] = [];
      const score = evaluator['evaluateRuleBasedResult'](result, warnings);

      expect(score).toBeCloseTo(0.4, 1);
      expect(warnings).toHaveLength(2);
    });

    it('应该处理空结果', () => {
      const warnings: string[] = [];
      const score = evaluator['evaluateRuleBasedResult'](null, warnings);

      expect(score).toBe(0);
      expect(warnings).toContain('规则降级返回空结果');
    });
  });

  describe('evaluateCachedResult - 缓存降级评估', () => {
    it('应该对缓存结果给予高分', () => {
      const result: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      };

      const warnings: string[] = [];
      const score = evaluator['evaluateCachedResult'](result, warnings);

      expect(score).toBe(0.9);
      expect(warnings).toHaveLength(0);
    });

    it('应该处理空缓存结果', () => {
      const warnings: string[] = [];
      const score = evaluator['evaluateCachedResult'](null, warnings);

      expect(score).toBe(0);
      expect(warnings).toContain('缓存降级返回空结果');
    });
  });

  describe('evaluateTemplateResult - 模板降级评估', () => {
    it('应该对模板结果给予中等分数', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [],
      };

      const warnings: string[] = [];
      const score = evaluator['evaluateTemplateResult'](result, warnings);

      expect(score).toBe(0.5);
      expect(warnings).toContain('使用模板降级，结果可能不准确');
    });

    it('应该处理空模板结果', () => {
      const warnings: string[] = [];
      const score = evaluator['evaluateTemplateResult'](null, warnings);

      expect(score).toBe(0);
      expect(warnings).toContain('模板降级返回空结果');
    });
  });

  describe('质量等级判断', () => {
    it('应该正确判断高质量（score > 0.8）', () => {
      const result: ExtractedData = {
        parties: [
          { type: 'plaintiff', name: '张三', role: '原告' },
          { type: 'defendant', name: '李四', role: '被告' },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');
      expect(evaluation.quality).toBe('high');
    });

    it('应该正确判断中等质量（0.5 < score <= 0.8）', () => {
      const result: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');
      expect(evaluation.quality).toBe('medium');
    });

    it('应该正确判断低质量（score <= 0.5）', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');
      expect(evaluation.quality).toBe('low');
    });
  });

  describe('shouldRetry 判断', () => {
    it('应该在低质量时建议重试', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');
      expect(evaluation.shouldRetry).toBe(true);
    });

    it('应该在中等质量时不建议重试', () => {
      const result: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');
      expect(evaluation.shouldRetry).toBe(false);
    });

    it('应该在高质量时不建议重试', () => {
      const result: ExtractedData = {
        parties: [
          { type: 'plaintiff', name: '张三', role: '原告' },
          { type: 'defendant', name: '李四', role: '被告' },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');
      expect(evaluation.shouldRetry).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理未知降级类型', () => {
      const result: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三', role: '原告' }],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'UNKNOWN' as any);

      expect(evaluation.score).toBe(0.5);
      expect(evaluation.quality).toBe('medium');
    });

    it('应该处理包含大量数据的结果', () => {
      const parties = Array.from({ length: 10 }, (_, i) => ({
        type: 'plaintiff' as const,
        name: `当事人${i + 1}`,
        role: '原告',
      }));

      const claims = Array.from({ length: 20 }, (_, i) => ({
        type: 'PAY_PRINCIPAL' as const,
        content: `诉讼请求${i + 1}`,
        amount: 10000 * (i + 1),
        currency: 'CNY',
      }));

      const result: ExtractedData = {
        parties,
        claims,
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');

      expect(evaluation.quality).toBe('high');
      expect(evaluation.score).toBeGreaterThan(0.8);
    });

    it('应该处理只有当事人没有诉讼请求的情况', () => {
      const result: ExtractedData = {
        parties: [
          { type: 'plaintiff', name: '张三', role: '原告' },
          { type: 'defendant', name: '李四', role: '被告' },
          { type: 'other', name: '王五', role: '第三人' },
        ],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');

      expect(evaluation.quality).toBe('medium');
      expect(evaluation.warnings).toContain('规则降级未提取到诉讼请求');
    });

    it('应该处理只有诉讼请求没有当事人的情况', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '支付货款',
            amount: 100000,
            currency: 'CNY',
          },
          {
            type: 'PAY_INTEREST',
            content: '支付利息',
            amount: 5000,
            currency: 'CNY',
          },
        ],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');

      expect(evaluation.quality).toBe('medium');
      expect(evaluation.warnings).toContain('规则降级未提取到当事人');
    });
  });

  describe('警告信息', () => {
    it('应该在缺少关键数据时提供警告', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'RULE_BASED');

      expect(evaluation.warnings).toContain('规则降级未提取到当事人');
      expect(evaluation.warnings).toContain('规则降级未提取到诉讼请求');
    });

    it('应该在使用模板降级时提供警告', () => {
      const result: ExtractedData = {
        parties: [],
        claims: [],
      };

      const evaluation = evaluator.evaluate(result, 'TEMPLATE');

      expect(evaluation.warnings).toContain('使用模板降级，结果可能不准确');
    });

    it('应该在结果为空时提供警告', () => {
      const evaluation = evaluator.evaluate(null, 'RULE_BASED');

      expect(evaluation.warnings).toContain('规则降级返回空结果');
    });
  });
});
