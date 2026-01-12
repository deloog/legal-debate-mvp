/**
 * RuleReviewer单元测试
 */

import { RuleReviewer } from '../../../../lib/agent/doc-analyzer/reviewers/rule-reviewer';
import type { ExtractedData } from '../../../../lib/agent/doc-analyzer/core/types';

describe('RuleReviewer', () => {
  let reviewer: RuleReviewer;

  beforeEach(() => {
    reviewer = new RuleReviewer();
  });

  describe('形式审查', () => {
    test('空当事人名称应该报告ERROR', async () => {
      const data: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '' }],
        claims: [],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.category === 'FORM')).toBe(true);
    });

    test('缺少角色类型应该报告WARNING', async () => {
      const data: ExtractedData = {
        parties: [{ type: undefined, name: '张三' } as any],
        claims: [],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.issues.some(i => i.severity === 'WARNING')).toBe(true);
    });

    test('空诉讼请求应该报告ERROR', async () => {
      const data: ExtractedData = {
        parties: [],
        claims: [
          {
            type: undefined,
            content: '',
            amount: undefined,
            currency: 'CNY',
          } as any,
        ],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.passed).toBe(false);
    });
  });

  describe('逻辑审查', () => {
    test('缺少原告应该报告WARNING', async () => {
      const data: ExtractedData = {
        parties: [{ type: 'defendant', name: '李四' }],
        claims: [],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(
        result.issues.some(
          i => i.category === 'LOGIC' && i.message.includes('缺少原告')
        )
      ).toBe(true);
    });

    test('缺少被告应该报告WARNING', async () => {
      const data: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三' }],
        claims: [],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(
        result.issues.some(
          i => i.category === 'LOGIC' && i.message.includes('缺少被告')
        )
      ).toBe(true);
    });

    test('负数金额应该报告ERROR', async () => {
      const data: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '测试',
            amount: -1000,
            currency: 'CNY',
          },
        ],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.message.includes('负数金额'))).toBe(
        true
      );
    });

    test('多种货币单位应该报告WARNING', async () => {
      const data: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '测试1',
            amount: 1000,
            currency: 'CNY',
          },
          {
            type: 'PAY_INTEREST',
            content: '测试2',
            amount: 100,
            currency: 'USD',
          },
        ],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.issues.some(i => i.message.includes('多种货币单位'))).toBe(
        true
      );
    });
  });

  describe('完整性审查', () => {
    test('当事人数量不足应该报告WARNING', async () => {
      const data: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '测试',
            amount: 1000,
            currency: 'CNY',
          },
        ],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.issues.some(i => i.category === 'COMPLETENESS')).toBe(true);
    });

    test('诉讼请求数量不足应该报告ERROR', async () => {
      const data: ExtractedData = {
        parties: [{ type: 'plaintiff', name: '张三' }],
        claims: [],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.category === 'COMPLETENESS')).toBe(true);
    });

    test('原文提及诉讼费用但未提取应该报告INFO', async () => {
      const data: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '测试',
            amount: 1000,
            currency: 'CNY',
          },
        ],
      };

      const fullText = '请求判令被告偿还本金，诉讼费用由被告承担';

      const result = await reviewer.review(data, fullText, {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(
        result.issues.some(
          i => i.category === 'COMPLETENESS' && i.severity === 'INFO'
        )
      ).toBe(true);
    });
  });

  describe('质量评分', () => {
    test('没有问题应该得1.0分', async () => {
      const data: ExtractedData = {
        parties: [
          { type: 'plaintiff', name: '张三' },
          { type: 'defendant', name: '李四' },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '偿还本金100万元',
            amount: 1000000,
            currency: 'CNY',
          },
        ],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      expect(result.score).toBe(1.0);
      expect(result.passed).toBe(true);
    });

    test('ERROR应该降低更多分数', async () => {
      const data: ExtractedData = {
        parties: [],
        claims: [],
      };

      const result = await reviewer.review(data, '测试文档', {
        enabled: true,
        threshold: 0.8,
        rules: [],
      });

      // ERROR权重更高，分数应该显著降低
      expect(result.score).toBeLessThan(0.7);
    });
  });

  describe('质量评级', () => {
    test('0.9及以上应该得到A级', () => {
      expect(reviewer.getQualityGrade(0.95)).toBe('A');
      expect(reviewer.getQualityGrade(0.9)).toBe('A');
    });

    test('0.8-0.89应该得到B级', () => {
      expect(reviewer.getQualityGrade(0.85)).toBe('B');
      expect(reviewer.getQualityGrade(0.8)).toBe('B');
    });

    test('0.6-0.79应该得到C级', () => {
      expect(reviewer.getQualityGrade(0.7)).toBe('C');
      expect(reviewer.getQualityGrade(0.6)).toBe('C');
    });

    test('低于0.6应该得到D级', () => {
      expect(reviewer.getQualityGrade(0.5)).toBe('D');
      expect(reviewer.getQualityGrade(0.3)).toBe('D');
    });
  });
});
