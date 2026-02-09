/**
 * ConfidenceEvaluator 单元测试
 * 测试置信度评估功能
 */

import { ConfidenceEvaluator } from '@/lib/agent/doc-analyzer/processors/confidence-evaluator';
import type {
  ExtractedData,
  Party,
  Claim,
} from '@/lib/agent/doc-analyzer/core/types';

describe('ConfidenceEvaluator', () => {
  let evaluator: ConfidenceEvaluator;

  beforeEach(() => {
    evaluator = new ConfidenceEvaluator();
  });

  describe('evaluateAIResult - 整体评估', () => {
    it('应该对高质量数据返回高置信度', () => {
      const data: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
            address: '上海市浦东新区',
          },
          {
            type: 'defendant',
            name: '张大伟',
            role: '被告',
            address: '上海市徐汇区',
          },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '判令被告偿还借款本金100000元',
            amount: 100000,
            currency: 'CNY',
          },
          {
            type: 'PAY_INTEREST',
            content: '判令被告支付利息5000元',
            amount: 5000,
            currency: 'CNY',
          },
        ],
      };

      const fullText = `
        原告：王小红，住上海市浦东新区
        被告：张大伟，住上海市徐汇区
        诉讼请求：
        1. 判令被告偿还借款本金100000元
        2. 判令被告支付利息5000元
      `;

      const result = evaluator.evaluateAIResult(data, fullText);

      expect(result.overall).toBeGreaterThan(0.8);
      expect(result.parties).toBeGreaterThan(0.8);
      expect(result.claims).toBeGreaterThan(0.8);
      expect(result.amount).toBeGreaterThan(0.8);
    });

    it('应该对低质量数据返回低置信度', () => {
      const data: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '', // 空名称
            role: '原告',
          },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '', // 空内容
            amount: -1000, // 负数金额
            currency: 'CNY',
          },
        ],
      };

      const fullText = '原告：被告：';

      const result = evaluator.evaluateAIResult(data, fullText);

      expect(result.overall).toBeLessThan(0.5);
      expect(result.parties).toBeLessThan(0.5);
      expect(result.claims).toBeLessThan(0.5);
    });

    it('应该正确计算加权平均置信度', () => {
      const data: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '判令被告偿还借款本金100000元',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const fullText = '原告：王小红 判令被告偿还借款本金100000元';

      const result = evaluator.evaluateAIResult(data, fullText);

      // overall = parties * 0.3 + claims * 0.4 + amount * 0.3
      const expectedOverall =
        result.parties * 0.3 + result.claims * 0.4 + result.amount * 0.3;

      expect(result.overall).toBeCloseTo(expectedOverall, 2);
    });
  });

  describe('evaluateParties - 当事人评估', () => {
    it('应该对完整的当事人信息返回高分', () => {
      const parties: Party[] = [
        {
          type: 'plaintiff',
          name: '王小红',
          role: '原告',
          address: '上海市浦东新区',
        },
      ];

      const fullText = '原告：王小红，住上海市浦东新区';

      const score = evaluator.evaluateParties(parties, fullText);

      expect(score).toBeGreaterThan(0.8);
    });

    it('应该对空当事人列表返回0分', () => {
      const parties: Party[] = [];
      const fullText = '原告：被告：';

      const score = evaluator.evaluateParties(parties, fullText);

      expect(score).toBe(0);
    });

    it('应该对缺少必填字段的当事人降低分数', () => {
      const parties: Party[] = [
        {
          type: 'plaintiff',
          name: '', // 缺少名称
          role: '原告',
        },
      ];

      const fullText = '原告：';

      const score = evaluator.evaluateParties(parties, fullText);

      expect(score).toBeLessThan(0.5);
    });

    it('应该对姓名过长的当事人降低分数', () => {
      const parties: Party[] = [
        {
          type: 'plaintiff',
          name: '这是一个非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的名字超过了五十个字符的限制',
          role: '原告',
        },
      ];

      const fullText =
        '原告：这是一个非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的名字超过了五十个字符的限制';

      const score = evaluator.evaluateParties(parties, fullText);

      expect(score).toBeLessThanOrEqual(0.7); // 1.0 - 0.3 = 0.7
    });

    it('应该对包含职务描述的姓名降低分数', () => {
      const parties: Party[] = [
        {
          type: 'plaintiff',
          name: '王小红法定代表人',
          role: '原告',
        },
      ];

      const fullText = '原告：王小红法定代表人';

      const score = evaluator.evaluateParties(parties, fullText);

      expect(score).toBeLessThan(0.7);
    });

    it('应该对不在原文中出现的姓名降低分数', () => {
      const parties: Party[] = [
        {
          type: 'plaintiff',
          name: '李四',
          role: '原告',
        },
      ];

      const fullText = '原告：王小红';

      const score = evaluator.evaluateParties(parties, fullText);

      expect(score).toBeLessThan(0.7);
    });

    it('应该正确计算多个当事人的平均分', () => {
      const parties: Party[] = [
        {
          type: 'plaintiff',
          name: '王小红',
          role: '原告',
        },
        {
          type: 'defendant',
          name: '', // 缺少名称
          role: '被告',
        },
      ];

      const fullText = '原告：王小红 被告：';

      const score = evaluator.evaluateParties(parties, fullText);

      // 第一个当事人高分（1.0），第二个当事人低分（0.4），平均 = (1.0 + 0.4) / 2 = 0.7
      expect(score).toBeGreaterThan(0.3);
      expect(score).toBeLessThanOrEqual(0.7);
    });
  });

  describe('evaluateClaims - 诉讼请求评估', () => {
    it('应该对完整的诉讼请求返回高分', () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '判令被告偿还借款本金100000元',
          amount: 100000,
          currency: 'CNY',
        },
      ];

      const fullText = '判令被告偿还借款本金100000元';

      const score = evaluator.evaluateClaims(claims, fullText);

      expect(score).toBeGreaterThan(0.8);
    });

    it('应该对空诉讼请求列表返回0分', () => {
      const claims: Claim[] = [];
      const fullText = '诉讼请求：';

      const score = evaluator.evaluateClaims(claims, fullText);

      expect(score).toBe(0);
    });

    it('应该对缺少类型的诉讼请求降低分数', () => {
      const claims: Claim[] = [
        {
          type: '' as unknown as 'PAY_PRINCIPAL',
          content: '判令被告偿还借款本金100000元',
          amount: 100000,
          currency: 'CNY',
        },
      ];

      const fullText = '判令被告偿还借款本金100000元';

      const score = evaluator.evaluateClaims(claims, fullText);

      expect(score).toBeLessThan(0.7);
    });

    it('应该对缺少描述的诉讼请求降低分数', () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '',
          amount: 100000,
          currency: 'CNY',
        },
      ];

      const fullText = '判令被告偿还借款本金100000元';

      const score = evaluator.evaluateClaims(claims, fullText);

      expect(score).toBeLessThan(0.8);
    });

    it('应该对金额不合理的诉讼请求降低分数', () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '判令被告偿还借款本金-1000元',
          amount: -1000,
          currency: 'CNY',
        },
      ];

      const fullText = '判令被告偿还借款本金-1000元';

      const score = evaluator.evaluateClaims(claims, fullText);

      expect(score).toBeLessThan(0.8);
    });

    it('应该对描述不在原文中的诉讼请求降低分数', () => {
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '判令被告偿还借款本金100000元',
          amount: 100000,
          currency: 'CNY',
        },
      ];

      const fullText = '判令被告支付利息5000元';

      const score = evaluator.evaluateClaims(claims, fullText);

      expect(score).toBeLessThan(0.9);
    });
  });

  describe('evaluateAmount - 金额评估', () => {
    it('应该对合理的金额返回高分', () => {
      const amount = 100000;
      const fullText = '判令被告偿还借款本金100000元';

      const score = evaluator.evaluateAmount(amount, fullText);

      expect(score).toBeGreaterThan(0.8);
    });

    it('应该对未提供金额返回中等分数', () => {
      const amount = undefined;
      const fullText = '判令被告偿还借款本金';

      const score = evaluator.evaluateAmount(amount, fullText);

      expect(score).toBe(0.5);
    });

    it('应该对0或负数金额返回0分', () => {
      const amount1 = 0;
      const amount2 = -1000;
      const fullText = '判令被告偿还借款本金';

      const score1 = evaluator.evaluateAmount(amount1, fullText);
      const score2 = evaluator.evaluateAmount(amount2, fullText);

      expect(score1).toBe(0);
      expect(score2).toBe(0);
    });

    it('应该对超过1000亿的金额降低分数', () => {
      const amount = 200000000000; // 2000亿
      const fullText = '判令被告偿还借款本金200000000000元';

      const score = evaluator.evaluateAmount(amount, fullText);

      expect(score).toBeLessThan(0.8);
    });

    it('应该对小于1元的金额降低分数', () => {
      const amount = 0.5;
      const fullText = '判令被告偿还借款本金0.5元';

      const score = evaluator.evaluateAmount(amount, fullText);

      expect(score).toBeLessThan(0.9);
    });

    it('应该对不在原文中出现的金额降低分数', () => {
      const amount = 100000;
      const fullText = '判令被告偿还借款本金50000元';

      const score = evaluator.evaluateAmount(amount, fullText);

      // 金额不在原文中，应该降低分数
      expect(score).toBeLessThanOrEqual(0.7); // 1.0 - 0.3 = 0.7
    });

    it('应该识别万元格式的金额', () => {
      const amount = 100000;
      const fullText = '判令被告偿还借款本金10万元';

      const score = evaluator.evaluateAmount(amount, fullText);

      expect(score).toBeGreaterThan(0.7);
    });

    it('应该识别亿元格式的金额', () => {
      const amount = 100000000;
      const fullText = '判令被告偿还借款本金1亿元';

      const score = evaluator.evaluateAmount(amount, fullText);

      expect(score).toBeGreaterThan(0.7);
    });
  });

  describe('边界情况', () => {
    it('应该处理空数据', () => {
      const data: ExtractedData = {
        parties: [],
        claims: [],
      };

      const fullText = '';

      const result = evaluator.evaluateAIResult(data, fullText);

      expect(result.overall).toBeDefined();
      expect(result.parties).toBe(0);
      expect(result.claims).toBe(0);
      expect(result.amount).toBe(0.5);
    });

    it('应该处理空文本', () => {
      const data: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
        ],
        claims: [],
      };

      const fullText = '';

      const result = evaluator.evaluateAIResult(data, fullText);

      expect(result.overall).toBeDefined();
      expect(result.parties).toBeLessThan(0.7); // 名称不在原文中
    });

    it('应该处理特殊字符', () => {
      const data: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红@#$%',
            role: '原告',
          },
        ],
        claims: [],
      };

      const fullText = '原告：王小红@#$%';

      const result = evaluator.evaluateAIResult(data, fullText);

      expect(result.overall).toBeDefined();
    });
  });
});
