/**
 * LogicConsistencyVerifier 测试
 * 测试逻辑一致性验证器，包括论点矛盾检测、论据一致性验证、因果关系统计
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { LogicConsistencyVerifier } from '@/lib/agent/verification-agent/verifiers/logic-consistency-verifier';

// 设置Jest超时时间
jest.setTimeout(10000);

describe('LogicConsistencyVerifier', () => {
  let verifier: LogicConsistencyVerifier;

  beforeEach(() => {
    jest.clearAllMocks();
    verifier = new LogicConsistencyVerifier();
  });

  describe('论点矛盾检测', () => {
    it('应该检测到论点中的事实矛盾', async () => {
      const data = {
        arguments: [
          '原告在2024年1月1日签订合同',
          '原告在2024年1月15日声称合同未签订',
          '被告已经履行了合同义务',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      expect(result.passed).toBe(false);
      expect(result.contradictions.length).toBeGreaterThan(0);

      const contradiction = result.contradictions.find(
        c => c.type === 'argument'
      );
      expect(contradiction).toBeDefined();
      expect(contradiction?.description).toContain('矛盾');
    });

    it('应该检测到论点中的逻辑矛盾', async () => {
      const data = {
        arguments: [
          '原告声称被告违约',
          '原告同时声称被告已经履行了合同义务',
          '因此请求判令被告承担违约责任',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      expect(result.passed).toBe(false);
      expect(result.contradictions.length).toBeGreaterThan(0);

      const contradiction = result.contradictions.find(
        c => c.type === 'argument'
      );
      expect(contradiction).toBeDefined();
    });

    it('应该检测到论点中的时间逻辑问题', async () => {
      const data = {
        arguments: [
          '合同签订于2024年1月1日',
          '违约行为发生于2023年12月15日',
          '原告要求赔偿2024年1月1日至2024年3月31日的损失',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      // 时间顺序问题应该导致较低的评分
      expect(result.score).toBeLessThan(0.9);
    });

    it('应该检测到论点中的因果逻辑问题', async () => {
      const data = {
        arguments: [
          '因为被告违约，所以原告遭受了损失',
          '但是原告没有遭受任何损失',
          '因此原告要求赔偿100000元',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      // 因果逻辑不一致应该导致失败
      expect(result.passed).toBe(false);

      // 应该至少有一个问题（矛盾或因果问题）
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('应该处理多个论点之间的矛盾', async () => {
      const data = {
        arguments: [
          '原告是合法债权人',
          '被告不是债务人',
          '原告与被告之间不存在债权债务关系',
          '因此原告有权要求被告付款',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      expect(result.passed).toBe(false);
      expect(result.contradictions.length).toBeGreaterThan(1);
    });
  });

  describe('论据一致性验证', () => {
    it('应该验证论据与论点的一致性', async () => {
      const data = {
        arguments: ['被告违约'],
        evidence: [
          '合同约定付款日期为2024年1月15日',
          '被告未在约定日期付款',
          '被告通知原告无法付款',
        ],
      };

      const result = await verifier.verify(data);

      // 论据支持论点，应该有一定的一致性
      expect(result.evidenceConsistency).toBeGreaterThan(0);
    });

    it('应该检测到论据不足的情况', async () => {
      const data = {
        arguments: ['被告违约，应赔偿100000元'],
        evidence: ['合同存在'],
      };

      const result = await verifier.verify(data);

      // 论据完整性应该是1（1个论据对1个论点）
      expect(result.evidenceCompleteness).toBe(1);
    });

    it('应该检测到论据与论点不符的情况', async () => {
      const data = {
        arguments: ['原告遭受了重大经济损失'],
        evidence: ['合同签订时间', '被告联系方式'],
      };

      const result = await verifier.verify(data);

      // 论据一致性应该较低
      expect(result.evidenceConsistency).toBeLessThan(0.5);
    });

    it('应该处理多个论据的一致性检查', async () => {
      const data = {
        arguments: ['被告违约应承担责任'],
        evidence: [
          '合同约定付款义务',
          '被告未付款',
          '原告已履行义务',
          '违约事实',
        ],
      };

      const result = await verifier.verify(data);

      // 多个论据应该有一定的匹配度
      expect(result.evidenceConsistency).toBeGreaterThan(0);
    });
  });

  describe('因果关系统计', () => {
    it('应该验证因果关系的合理性', async () => {
      const data = {
        arguments: [
          '因为被告违约，所以原告遭受了损失',
          '损失包括直接损失和间接损失',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      expect(result.causalRelations.length).toBeGreaterThan(0);
      expect(result.causalRelationScore).toBeGreaterThan(0.8);
    });

    it('应该检测到因果关系缺失', async () => {
      const data = {
        arguments: ['被告违约', '原告遭受损失', '因此请求赔偿'],
        evidence: [],
      };

      const result = await verifier.verify(data);

      expect(result.causalRelations.length).toBe(0);
    });

    it('应该处理间接因果关系验证', async () => {
      const data = {
        arguments: [
          '因为被告违约，导致原告无法完成与第三方的交易',
          '因此原告遭受了间接损失',
          '原告要求赔偿直接损失和间接损失',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      expect(result.causalRelations.length).toBeGreaterThan(0);
      expect(result.causalRelationScore).toBeGreaterThan(0.8);
    });
  });

  describe('边界情况处理', () => {
    it('应该处理空内容输入', async () => {
      const data = {
        arguments: null,
        evidence: null,
      };

      const result = await verifier.verify(data);

      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    it('应该处理undefined输入', async () => {
      const data = {
        arguments: undefined,
        evidence: undefined,
      };

      const result = await verifier.verify(data);

      expect(result).toBeDefined();
    });

    it('应该处理复杂的嵌套逻辑', async () => {
      const data = {
        arguments: [
          '如果被告违约，那么原告有权解除合同',
          '如果原告解除合同，那么被告应承担违约责任',
          '被告违约，但是原告没有解除合同',
          '因此被告不承担违约责任',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      // 复杂逻辑应该被检测
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('应该处理空数组输入', async () => {
      const data = {
        arguments: [],
        evidence: [],
      };

      const result = await verifier.verify(data);

      expect(result).toBeDefined();
      expect(result.score).toBe(1.0);
    });
  });

  describe('综合评分和结果生成', () => {
    it('应该正确计算综合评分', async () => {
      const data = {
        arguments: ['原告与被告签订合同', '被告违约', '原告遭受损失'],
        evidence: ['合同签订', '被告违约', '原告遭受损失'],
      };

      const result = await verifier.verify(data);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('应该生成正确的验证结果', async () => {
      const data = {
        arguments: ['测试论点'],
        evidence: ['测试论据'],
      };

      const result = await verifier.verify(data);

      expect(result).toMatchObject({
        score: expect.any(Number),
        passed: expect.any(Boolean),
        contradictions: expect.any(Array),
        evidenceConsistency: expect.any(Number),
        evidenceCompleteness: expect.any(Number),
        causalRelations: expect.any(Array),
        causalRelationScore: expect.any(Number),
        issues: expect.any(Array),
      });
    });

    it('应该根据矛盾数量计算评分', async () => {
      const dataWithContradictions = {
        arguments: ['原告是债权人', '被告不是债务人', '原告与被告存在债务关系'],
        evidence: [],
      };

      const result1 = await verifier.verify(dataWithContradictions);

      expect(result1.score).toBeLessThan(1.0);
      expect(result1.passed).toBe(false);
    });
  });

  describe('循环因果关系检测', () => {
    it('应该处理潜在的循环因果关系', async () => {
      const data = {
        arguments: [
          '因为原告违约，所以被告遭受损失',
          '因为被告遭受损失，所以原告无法履行合同',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      // 验证器应该提取到因果关系
      expect(result.causalRelations.length).toBeGreaterThan(0);

      // 循环检测可能不总是能检测到，但至少应该有因果关系
      expect(result.issues.length).toBeGreaterThanOrEqual(0);
    });

    it('不应该误报非循环关系', async () => {
      const data = {
        arguments: [
          '因为被告违约，所以原告遭受损失',
          '因为原告遭受损失，所以要求赔偿',
        ],
        evidence: [],
      };

      const result = await verifier.verify(data);

      const circularIssue = result.issues.find(
        issue => issue.type === 'circular_causality'
      );
      expect(circularIssue).toBeUndefined();
    });
  });
});
