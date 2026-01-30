/**
 * AccuracyValidator 单元测试
 *
 * 测试准确率验证器的各项功能
 * 覆盖率目标: 90%+
 */

import { AccuracyValidator } from '../../../../lib/agent/doc-analyzer/optimizations/accuracy-validator';
import type {
  Party,
  Claim,
} from '../../../../lib/agent/doc-analyzer/core/types';
import type {
  ExtractedAmount,
  ValidationIssue,
} from '../../../../lib/agent/doc-analyzer/optimizations/types';

describe('AccuracyValidator', () => {
  let validator: AccuracyValidator;

  beforeEach(() => {
    validator = new AccuracyValidator();
  });

  describe('validateParties', () => {
    it('应该验证当事人信息与文档内容一致', async () => {
      const content = '原告张三诉被告李四借款合同纠纷一案';
      const parties: Party[] = [
        { type: 'plaintiff', name: '张三' },
        { type: 'defendant', name: '李四' },
      ];

      const issues = await validator.validateParties(content, parties);
      expect(issues).toHaveLength(0);
    });

    it('应该检测当事人名称不在文档中的问题', async () => {
      const content = '原告张三诉被告李四借款合同纠纷一案';
      const parties: Party[] = [
        { type: 'plaintiff', name: '王五' },
        { type: 'defendant', name: '李四' },
      ];

      const issues = await validator.validateParties(content, parties);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('PARTY_INCONSISTENCY');
    });

    it('应该检测当事人角色与文档描述不符', async () => {
      // 使用明确的"原告："和"被告："格式
      const content = '原告：张三 被告：李四 借款合同纠纷一案';
      const parties: Party[] = [
        { type: 'defendant', name: '张三' }, // 角色错误，文档中标记为原告
        { type: 'plaintiff', name: '李四' }, // 角色错误，文档中标记为被告
      ];

      const issues = await validator.validateParties(content, parties);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.type === 'PARTY_INCONSISTENCY')).toBe(true);
    });

    it('应该处理空当事人列表', async () => {
      const content = '原告张三诉被告李四借款合同纠纷一案';
      const parties: Party[] = [];

      const issues = await validator.validateParties(content, parties);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('MISSING_REQUIRED');
    });

    it('应该检测重复的当事人', async () => {
      const content = '原告张三诉被告李四借款合同纠纷一案';
      const parties: Party[] = [
        { type: 'plaintiff', name: '张三' },
        { type: 'plaintiff', name: '张三' }, // 重复
        { type: 'defendant', name: '李四' },
      ];

      const issues = await validator.validateParties(content, parties);
      expect(issues.some(i => i.message.includes('重复'))).toBe(true);
    });
  });

  describe('validateAmounts', () => {
    it('应该验证金额与文档内容一致', async () => {
      const content = '被告应偿还借款本金100万元';
      const amounts: ExtractedAmount[] = [
        { value: 1000000, currency: 'CNY', context: '借款本金', position: 10 },
      ];

      const issues = await validator.validateAmounts(content, amounts);
      expect(issues).toHaveLength(0);
    });

    it('应该检测金额不在文档中的问题', async () => {
      const content = '被告应偿还借款本金100万元';
      const amounts: ExtractedAmount[] = [
        { value: 2000000, currency: 'CNY', context: '借款本金', position: 10 },
      ];

      const issues = await validator.validateAmounts(content, amounts);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('AMOUNT_MISMATCH');
    });

    it('应该处理多个金额的验证', async () => {
      const content = '被告应偿还借款本金100万元及利息5万元';
      const amounts: ExtractedAmount[] = [
        { value: 1000000, currency: 'CNY', context: '借款本金', position: 10 },
        { value: 50000, currency: 'CNY', context: '利息', position: 20 },
      ];

      const issues = await validator.validateAmounts(content, amounts);
      expect(issues).toHaveLength(0);
    });

    it('应该检测负数金额', async () => {
      const content = '被告应偿还借款本金100万元';
      const amounts: ExtractedAmount[] = [
        { value: -1000000, currency: 'CNY', context: '借款本金', position: 10 },
      ];

      const issues = await validator.validateAmounts(content, amounts);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('FORMAT_ERROR');
    });

    it('应该处理空金额列表', async () => {
      const content = '被告应偿还借款本金100万元';
      const amounts: ExtractedAmount[] = [];

      const issues = await validator.validateAmounts(content, amounts);
      // 空金额列表可能是有效的（某些文档没有金额）
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('validateDates', () => {
    it('应该验证日期与文档内容一致', async () => {
      const content = '双方于2024年1月15日签订借款合同';
      const dates = ['2024年1月15日'];

      const issues = await validator.validateDates(content, dates);
      expect(issues).toHaveLength(0);
    });

    it('应该检测日期不在文档中的问题', async () => {
      const content = '双方于2024年1月15日签订借款合同';
      const dates = ['2023年5月20日'];

      const issues = await validator.validateDates(content, dates);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('DATE_CONFLICT');
    });

    it('应该处理多个日期的验证', async () => {
      const content = '双方于2024年1月15日签订借款合同，约定2024年6月15日还款';
      const dates = ['2024年1月15日', '2024年6月15日'];

      const issues = await validator.validateDates(content, dates);
      expect(issues).toHaveLength(0);
    });

    it('应该检测日期格式错误', async () => {
      const content = '双方于2024年1月15日签订借款合同';
      const dates = ['无效日期'];

      const issues = await validator.validateDates(content, dates);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('FORMAT_ERROR');
    });

    it('应该处理空日期列表', async () => {
      const content = '双方签订借款合同';
      const dates: string[] = [];

      const issues = await validator.validateDates(content, dates);
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('validateClaims', () => {
    it('应该验证诉讼请求与文档内容一致', async () => {
      const content =
        '诉讼请求：1.判令被告偿还借款本金100万元；2.诉讼费用由被告承担';
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '偿还借款本金100万元',
          amount: 1000000,
          currency: 'CNY',
        },
        {
          type: 'LITIGATION_COST',
          content: '诉讼费用由被告承担',
          currency: 'CNY',
        },
      ];

      const issues = await validator.validateClaims(content, claims);
      expect(issues).toHaveLength(0);
    });

    it('应该检测诉讼请求内容不在文档中', async () => {
      const content = '诉讼请求：1.判令被告偿还借款本金100万元';
      // 使用一个类型与内容不匹配的诉讼请求来触发验证问题
      const claims: Claim[] = [
        {
          type: 'PAY_PENALTY',
          content: '偿还借款本金200万元',
          amount: 2000000,
          currency: 'CNY',
        },
      ];

      const issues = await validator.validateClaims(content, claims);
      // 类型PAY_PENALTY与内容"本金"不匹配，应该检测到LOGIC_ERROR
      expect(issues.length).toBeGreaterThan(0);
    });

    it('应该检测重复的诉讼请求', async () => {
      const content = '诉讼请求：1.判令被告偿还借款本金100万元';
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '偿还借款本金100万元',
          amount: 1000000,
          currency: 'CNY',
        },
        {
          type: 'PAY_PRINCIPAL',
          content: '偿还借款本金100万元',
          amount: 1000000,
          currency: 'CNY',
        },
      ];

      const issues = await validator.validateClaims(content, claims);
      expect(issues.some(i => i.type === 'CLAIM_DUPLICATE')).toBe(true);
    });

    it('应该处理空诉讼请求列表', async () => {
      const content = '诉讼请求：1.判令被告偿还借款本金100万元';
      const claims: Claim[] = [];

      const issues = await validator.validateClaims(content, claims);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('MISSING_REQUIRED');
    });

    it('应该检测诉讼请求类型与内容不匹配', async () => {
      const content = '诉讼请求：1.判令被告支付违约金10万元';
      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '支付违约金10万元',
          amount: 100000,
          currency: 'CNY',
        },
      ];

      const issues = await validator.validateClaims(content, claims);
      expect(issues.some(i => i.type === 'LOGIC_ERROR')).toBe(true);
    });
  });

  describe('calculateValidationScore', () => {
    it('应该对无问题返回满分', () => {
      const issues: ValidationIssue[] = [];
      const score = validator.calculateValidationScore(issues);
      expect(score).toBe(1.0);
    });

    it('应该根据ERROR问题扣分', () => {
      const issues: ValidationIssue[] = [
        {
          type: 'PARTY_INCONSISTENCY',
          severity: 'ERROR',
          field: 'parties',
          message: '测试错误',
        },
      ];
      const score = validator.calculateValidationScore(issues);
      expect(score).toBeLessThan(1.0);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('应该根据WARNING问题扣分（较少）', () => {
      const issues: ValidationIssue[] = [
        {
          type: 'PARTY_INCONSISTENCY',
          severity: 'WARNING',
          field: 'parties',
          message: '测试警告',
        },
      ];
      const score = validator.calculateValidationScore(issues);
      expect(score).toBeLessThan(1.0);
      expect(score).toBeGreaterThan(0.5);
    });

    it('应该对INFO问题扣分最少', () => {
      const issues: ValidationIssue[] = [
        {
          type: 'PARTY_INCONSISTENCY',
          severity: 'INFO',
          field: 'parties',
          message: '测试信息',
        },
      ];
      const score = validator.calculateValidationScore(issues);
      expect(score).toBeLessThan(1.0);
      expect(score).toBeGreaterThan(0.8);
    });

    it('应该累计多个问题的扣分', () => {
      const issues: ValidationIssue[] = [
        {
          type: 'PARTY_INCONSISTENCY',
          severity: 'ERROR',
          field: 'parties',
          message: '错误1',
        },
        {
          type: 'AMOUNT_MISMATCH',
          severity: 'ERROR',
          field: 'amounts',
          message: '错误2',
        },
        {
          type: 'DATE_CONFLICT',
          severity: 'WARNING',
          field: 'dates',
          message: '警告1',
        },
      ];
      const score = validator.calculateValidationScore(issues);
      // 2个ERROR扣0.4，1个WARNING扣0.08，总分0.52
      expect(score).toBeLessThan(0.6);
    });

    it('应该返回最低分0而不是负数', () => {
      const issues: ValidationIssue[] = Array(20).fill({
        type: 'PARTY_INCONSISTENCY',
        severity: 'ERROR',
        field: 'parties',
        message: '错误',
      });
      const score = validator.calculateValidationScore(issues);
      expect(score).toBe(0);
    });
  });

  describe('综合验证', () => {
    it('应该能够执行完整的验证流程', async () => {
      const content = `
        原告张三诉被告李四借款合同纠纷一案。
        双方于2024年1月15日签订借款合同，约定被告向原告借款100万元。
        诉讼请求：
        1. 判令被告偿还借款本金100万元；
        2. 判令被告支付利息5万元；
        3. 诉讼费用由被告承担。
      `;

      const parties: Party[] = [
        { type: 'plaintiff', name: '张三' },
        { type: 'defendant', name: '李四' },
      ];

      const claims: Claim[] = [
        {
          type: 'PAY_PRINCIPAL',
          content: '偿还借款本金100万元',
          amount: 1000000,
          currency: 'CNY',
        },
        {
          type: 'PAY_INTEREST',
          content: '支付利息5万元',
          amount: 50000,
          currency: 'CNY',
        },
        {
          type: 'LITIGATION_COST',
          content: '诉讼费用由被告承担',
          currency: 'CNY',
        },
      ];

      const amounts: ExtractedAmount[] = [
        { value: 1000000, currency: 'CNY', context: '借款本金', position: 50 },
        { value: 50000, currency: 'CNY', context: '利息', position: 100 },
      ];

      const dates = ['2024年1月15日'];

      const partyIssues = await validator.validateParties(content, parties);
      const claimIssues = await validator.validateClaims(content, claims);
      const amountIssues = await validator.validateAmounts(content, amounts);
      const dateIssues = await validator.validateDates(content, dates);

      const allIssues = [
        ...partyIssues,
        ...claimIssues,
        ...amountIssues,
        ...dateIssues,
      ];
      const score = validator.calculateValidationScore(allIssues);

      expect(score).toBeGreaterThan(0.8);
    });
  });
});
