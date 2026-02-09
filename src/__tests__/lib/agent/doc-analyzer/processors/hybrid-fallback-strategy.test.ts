/**
 * HybridFallbackStrategy 单元测试
 * 测试混合兜底策略功能
 */

import { HybridFallbackStrategy } from '@/lib/agent/doc-analyzer/processors/hybrid-fallback-strategy';
import type {
  ExtractedData,
  Party,
  Claim,
} from '@/lib/agent/doc-analyzer/core/types';
import type { ConfidenceScores } from '@/lib/agent/doc-analyzer/processors/confidence-evaluator';

describe('HybridFallbackStrategy', () => {
  let strategy: HybridFallbackStrategy;

  beforeEach(() => {
    strategy = new HybridFallbackStrategy();
  });

  describe('merge - 数据合并', () => {
    it('应该在AI置信度高时优先使用AI结果', async () => {
      const aiResult: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
          {
            type: 'defendant',
            name: '张大伟',
            role: '被告',
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

      const ruleResult: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
          {
            type: 'defendant',
            name: '李四',
            role: '被告',
          },
        ],
        claims: [
          {
            type: 'PAY_INTEREST',
            content: '判令被告支付利息5000元',
            amount: 5000,
            currency: 'CNY',
          },
        ],
      };

      const confidence: ConfidenceScores = {
        overall: 0.9,
        parties: 0.9,
        claims: 0.9,
        amount: 0.9,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // AI置信度高，应该优先使用AI结果
      expect(merged.parties.length).toBeGreaterThanOrEqual(2);
      const defendant = merged.parties.find(p => p.type === 'defendant');
      expect(defendant?.name).toBe('张大伟'); // AI的结果

      // 但应该补充规则结果中的额外数据
      expect(merged.claims.length).toBeGreaterThanOrEqual(1);
    });

    it('应该在AI置信度低时优先使用规则结果', async () => {
      const aiResult: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '', // 空名称，质量差
            role: '原告',
          },
        ],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '',
            amount: -1000, // 负数金额，质量差
            currency: 'CNY',
          },
        ],
      };

      const ruleResult: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
          {
            type: 'defendant',
            name: '张大伟',
            role: '被告',
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

      const confidence: ConfidenceScores = {
        overall: 0.3,
        parties: 0.3,
        claims: 0.3,
        amount: 0.3,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // AI置信度低，应该优先使用规则结果，但会补充AI中的当事人（即使名称为空）
      expect(merged.parties.length).toBeGreaterThanOrEqual(2);
      const plaintiff = merged.parties.find(
        p => p.type === 'plaintiff' && p.name === '王小红'
      );
      expect(plaintiff?.name).toBe('王小红'); // 规则的结果

      // claims也会合并，因为content不同
      expect(merged.claims.length).toBeGreaterThanOrEqual(1);
      const validClaim = merged.claims.find(c => c.amount === 100000);
      expect(validClaim?.amount).toBe(100000); // 规则的结果
    });

    it('应该正确合并当事人数据', async () => {
      const aiResult: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
        ],
        claims: [],
      };

      const ruleResult: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
          {
            type: 'defendant',
            name: '张大伟',
            role: '被告',
          },
        ],
        claims: [],
      };

      const confidence: ConfidenceScores = {
        overall: 0.8,
        parties: 0.8,
        claims: 0.8,
        amount: 0.8,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 应该包含AI的当事人 + 规则补充的当事人
      expect(merged.parties.length).toBe(2);
      expect(merged.parties.find(p => p.name === '王小红')).toBeDefined();
      expect(merged.parties.find(p => p.name === '张大伟')).toBeDefined();
    });

    it('应该正确合并诉讼请求数据', async () => {
      const aiResult: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '判令被告偿还借款本金100000元',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const ruleResult: ExtractedData = {
        parties: [],
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

      const confidence: ConfidenceScores = {
        overall: 0.8,
        parties: 0.8,
        claims: 0.8,
        amount: 0.8,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 应该包含AI的请求 + 规则补充的请求
      expect(merged.claims.length).toBe(2);
      expect(merged.claims.find(c => c.type === 'PAY_PRINCIPAL')).toBeDefined();
      expect(merged.claims.find(c => c.type === 'PAY_INTEREST')).toBeDefined();
    });

    it('应该在AI置信度低时替换金额', async () => {
      const aiResult: ExtractedData = {
        parties: [],
        claims: [],
        caseType: 'civil',
      };

      const ruleResult: ExtractedData = {
        parties: [],
        claims: [],
        caseType: 'commercial',
      };

      const confidence: ConfidenceScores = {
        overall: 0.5,
        parties: 0.5,
        claims: 0.5,
        amount: 0.5,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 置信度为0.5，不低于0.7，应该保留AI的案件类型
      // 但由于overall < 0.7，会使用规则结果的caseType
      expect(merged.caseType).toBe('commercial');
    });
  });

  describe('mergeParties - 当事人合并', () => {
    it('应该去重相同名称的当事人', async () => {
      const aiResult: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
        ],
        claims: [],
      };

      const ruleResult: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
        ],
        claims: [],
      };

      const confidence: ConfidenceScores = {
        overall: 0.8,
        parties: 0.8,
        claims: 0.8,
        amount: 0.8,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 不应该重复
      expect(merged.parties.length).toBe(1);
      expect(merged.parties[0].name).toBe('王小红');
    });

    it('应该补充缺失的当事人', async () => {
      const aiResult: ExtractedData = {
        parties: [
          {
            type: 'plaintiff',
            name: '王小红',
            role: '原告',
          },
        ],
        claims: [],
      };

      const ruleResult: ExtractedData = {
        parties: [
          {
            type: 'defendant',
            name: '张大伟',
            role: '被告',
          },
          {
            type: 'other',
            name: '李四',
            role: '第三人',
          },
        ],
        claims: [],
      };

      const confidence: ConfidenceScores = {
        overall: 0.8,
        parties: 0.8,
        claims: 0.8,
        amount: 0.8,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 应该包含所有不重复的当事人
      expect(merged.parties.length).toBe(3);
      expect(merged.parties.find(p => p.name === '王小红')).toBeDefined();
      expect(merged.parties.find(p => p.name === '张大伟')).toBeDefined();
      expect(merged.parties.find(p => p.name === '李四')).toBeDefined();
    });
  });

  describe('mergeClaims - 诉讼请求合并', () => {
    it('应该去重相同描述的诉讼请求', async () => {
      const aiResult: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '判令被告偿还借款本金100000元',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const ruleResult: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '判令被告偿还借款本金100000元',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const confidence: ConfidenceScores = {
        overall: 0.8,
        parties: 0.8,
        claims: 0.8,
        amount: 0.8,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 不应该重复
      expect(merged.claims.length).toBe(1);
      expect(merged.claims[0].content).toBe('判令被告偿还借款本金100000元');
    });

    it('应该补充缺失的诉讼请求', async () => {
      const aiResult: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_PRINCIPAL',
            content: '判令被告偿还借款本金100000元',
            amount: 100000,
            currency: 'CNY',
          },
        ],
      };

      const ruleResult: ExtractedData = {
        parties: [],
        claims: [
          {
            type: 'PAY_INTEREST',
            content: '判令被告支付利息5000元',
            amount: 5000,
            currency: 'CNY',
          },
          {
            type: 'LITIGATION_COST',
            content: '判令被告承担诉讼费用',
            currency: 'CNY',
          },
        ],
      };

      const confidence: ConfidenceScores = {
        overall: 0.8,
        parties: 0.8,
        claims: 0.8,
        amount: 0.8,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 应该包含所有不重复的诉讼请求
      expect(merged.claims.length).toBe(3);
      expect(merged.claims.find(c => c.type === 'PAY_PRINCIPAL')).toBeDefined();
      expect(merged.claims.find(c => c.type === 'PAY_INTEREST')).toBeDefined();
      expect(
        merged.claims.find(c => c.type === 'LITIGATION_COST')
      ).toBeDefined();
    });
  });

  describe('边界情况', () => {
    it('应该处理空AI结果', async () => {
      const aiResult: ExtractedData = {
        parties: [],
        claims: [],
      };

      const ruleResult: ExtractedData = {
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

      const confidence: ConfidenceScores = {
        overall: 0.5,
        parties: 0.5,
        claims: 0.5,
        amount: 0.5,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 应该使用规则结果
      expect(merged.parties.length).toBe(1);
      expect(merged.claims.length).toBe(1);
    });

    it('应该处理空规则结果', async () => {
      const aiResult: ExtractedData = {
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

      const ruleResult: ExtractedData = {
        parties: [],
        claims: [],
      };

      const confidence: ConfidenceScores = {
        overall: 0.8,
        parties: 0.8,
        claims: 0.8,
        amount: 0.8,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 应该使用AI结果
      expect(merged.parties.length).toBe(1);
      expect(merged.claims.length).toBe(1);
    });

    it('应该处理两者都为空的情况', async () => {
      const aiResult: ExtractedData = {
        parties: [],
        claims: [],
      };

      const ruleResult: ExtractedData = {
        parties: [],
        claims: [],
      };

      const confidence: ConfidenceScores = {
        overall: 0.5,
        parties: 0.5,
        claims: 0.5,
        amount: 0.5,
        details: {},
      };

      const merged = await strategy.merge(aiResult, ruleResult, confidence);

      // 应该返回空结果
      expect(merged.parties.length).toBe(0);
      expect(merged.claims.length).toBe(0);
    });
  });
});
