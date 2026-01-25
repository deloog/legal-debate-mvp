/**
 * 时效计算器单元测试
 */

import {
  StatuteCalculator,
  statuteCalculator,
} from '@/lib/calculation/statute-calculator';
import {
  StatuteType,
  CaseTypeForStatute,
  SpecialCircumstances,
} from '@/types/statute';

describe('StatuteCalculator', () => {
  let calculator: StatuteCalculator;

  beforeEach(() => {
    calculator = new StatuteCalculator();
  });

  describe('calculate - 基础计算', () => {
    it('应该正确计算诉讼时效', () => {
      const result = calculator.calculate({
        caseId: 'case-1',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2024-01-01'),
      });

      expect(result.caseId).toBe('case-1');
      expect(result.statuteType).toBe(StatuteType.LITIGATION);
      expect(result.remainingDays).toBeDefined();
      expect(result.deadlineDate).toBeDefined();
    });

    it('应该正确计算上诉时效', () => {
      const result = calculator.calculate({
        caseId: 'case-2',
        statuteType: StatuteType.APPEAL,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2024-01-01'),
      });

      expect(result.statuteType).toBe(StatuteType.APPEAL);
      expect(result.deadlineDate).toBeDefined();
    });

    it('应该正确计算执行时效', () => {
      const result = calculator.calculate({
        caseId: 'case-3',
        statuteType: StatuteType.ENFORCEMENT,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2024-01-01'),
      });

      expect(result.statuteType).toBe(StatuteType.ENFORCEMENT);
      expect(result.deadlineDate).toBeDefined();
    });
  });

  describe('calculate - 特殊情况处理', () => {
    it('应该正确处理中止情况', () => {
      const result = calculator.calculate({
        caseId: 'case-4',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2023-01-01'),
        specialCircumstances: [SpecialCircumstances.SUSPENSION],
      });

      expect(
        result.calculationMetadata.warnings.some(w => w.includes('中止'))
      ).toBe(true);
      expect(result.calculationMetadata.adjustments.suspensionDays).toBe(30);
    });

    it('应该正确处理中断情况', () => {
      const result = calculator.calculate({
        caseId: 'case-5',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2023-01-01'),
        specialCircumstances: [SpecialCircumstances.INTERRUPTION],
      });

      expect(
        result.calculationMetadata.warnings.some(w => w.includes('中断'))
      ).toBe(true);
      expect(result.calculationMetadata.adjustments.interruptionDays).toBe(0);
    });

    it('应该正确处理限制民事行为能力人', () => {
      const result = calculator.calculate({
        caseId: 'case-6',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2023-01-01'),
        specialCircumstances: [SpecialCircumstances.MINOR],
      });

      expect(
        result.calculationMetadata.warnings.some(w =>
          w.includes('限制民事行为能力')
        )
      ).toBe(true);
      expect(result.calculationMetadata.adjustments.minorProtectionDays).toBe(
        90
      );
    });

    it('应该正确处理无民事行为能力人', () => {
      const result = calculator.calculate({
        caseId: 'case-7',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2023-01-01'),
        specialCircumstances: [SpecialCircumstances.DISABILITY],
      });

      expect(
        result.calculationMetadata.warnings.some(w =>
          w.includes('无民事行为能力')
        )
      ).toBe(true);
      expect(result.calculationMetadata.adjustments.minorProtectionDays).toBe(
        180
      );
    });

    it('应该正确处理多个特殊情况', () => {
      const result = calculator.calculate({
        caseId: 'case-8',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2023-01-01'),
        specialCircumstances: [
          SpecialCircumstances.SUSPENSION,
          SpecialCircumstances.MINOR,
        ],
      });

      expect(result.calculationMetadata.warnings.length).toBeGreaterThan(1);
    });
  });

  describe('calculate - 到期状态判断', () => {
    it('应该正确识别已过期状态', () => {
      const oldDate = new Date('2010-01-01');
      const result = calculator.calculate({
        caseId: 'case-9',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: oldDate,
      });

      expect(result.isExpired).toBe(true);
      expect(result.remainingDays).toBeLessThanOrEqual(0);
    });

    it('应该正确识别即将到期状态', () => {
      // 设置当前日期为2024-12-31
      // 如果起始日期是2024-01-01，那么过了365天
      // 剩余天数 = 1095 - 365 = 730天，不算是即将到期
      // 让我们用另一个案件类型，时效期较短
      // 上诉期只有15天
      const nearExpiryDate = new Date('2024-12-20');
      const result = calculator.calculate({
        caseId: 'case-10',
        statuteType: StatuteType.APPEAL,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: nearExpiryDate,
        endDate: new Date('2024-12-25'), // 只过了5天，剩余10天
      });

      expect(result.isApproaching).toBe(true);
      expect(result.remainingDays).toBeLessThanOrEqual(30);
    });

    it('应该正确识别正常状态', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);

      const result = calculator.calculate({
        caseId: 'case-11',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: recentDate,
      });

      expect(result.isExpired).toBe(false);
      expect(result.remainingDays).toBeGreaterThan(0);
    });
  });

  describe('calculate - 元数据构建', () => {
    it('应该生成警告和建议', () => {
      const result = calculator.calculate({
        caseId: 'case-12',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2023-01-01'),
      });

      expect(result.calculationMetadata.warnings).toBeDefined();
      expect(result.calculationMetadata.recommendations).toBeDefined();
    });

    it('应该计算置信度', () => {
      const result = calculator.calculate({
        caseId: 'case-13',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2024-01-01'),
      });

      expect(result.calculationMetadata.confidence).toBeGreaterThan(0);
      expect(result.calculationMetadata.confidence).toBeLessThanOrEqual(1);
    });

    it('特殊情况应该降低置信度', () => {
      const normalResult = calculator.calculate({
        caseId: 'case-14',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2024-01-01'),
      });

      const specialResult = calculator.calculate({
        caseId: 'case-15',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        startDate: new Date('2024-01-01'),
        specialCircumstances: [SpecialCircumstances.SUSPENSION],
      });

      expect(specialResult.calculationMetadata.confidence).toBeLessThan(
        normalResult.calculationMetadata.confidence
      );
    });
  });

  describe('validateParams - 参数验证', () => {
    it('应该抛出错误当caseId为空', () => {
      expect(() => {
        calculator.calculate({
          caseId: '',
          statuteType: StatuteType.LITIGATION,
          caseType: CaseTypeForStatute.CIVIL,
          startDate: new Date('2024-01-01'),
        });
      }).toThrow('案件ID不能为空');
    });

    it('应该抛出错误当startDate为空', () => {
      expect(() => {
        calculator.calculate({
          caseId: 'case-16',
          statuteType: StatuteType.LITIGATION,
          caseType: CaseTypeForStatute.CIVIL,
          startDate: null as unknown as Date,
        });
      }).toThrow('起始日期不能为空');
    });

    it('应该抛出错误当日期格式无效', () => {
      expect(() => {
        calculator.calculate({
          caseId: 'case-17',
          statuteType: StatuteType.LITIGATION,
          caseType: CaseTypeForStatute.CIVIL,
          startDate: new Date('invalid'),
        });
      }).toThrow('起始日期格式无效');
    });

    it('应该抛出错误当endDate早于startDate', () => {
      expect(() => {
        calculator.calculate({
          caseId: 'case-18',
          statuteType: StatuteType.LITIGATION,
          caseType: CaseTypeForStatute.CIVIL,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2023-01-01'),
        });
      }).toThrow('结束日期不能早于起始日期');
    });
  });

  describe('batchCalculate - 批量计算', () => {
    it('应该正确执行批量计算', () => {
      const paramsList = [
        {
          caseId: 'case-19',
          statuteType: StatuteType.LITIGATION,
          caseType: CaseTypeForStatute.CIVIL,
          startDate: new Date('2024-01-01'),
        },
        {
          caseId: 'case-20',
          statuteType: StatuteType.APPEAL,
          caseType: CaseTypeForStatute.CIVIL,
          startDate: new Date('2024-01-01'),
        },
      ];

      const results = calculator.batchCalculate(paramsList);

      expect(results).toHaveLength(2);
      expect(results[0].caseId).toBe('case-19');
      expect(results[1].caseId).toBe('case-20');
    });

    it('应该处理部分失败的情况', () => {
      const paramsList = [
        {
          caseId: 'case-21',
          statuteType: StatuteType.LITIGATION,
          caseType: CaseTypeForStatute.CIVIL,
          startDate: new Date('2024-01-01'),
        },
        {
          caseId: '',
          statuteType: StatuteType.LITIGATION,
          caseType: CaseTypeForStatute.CIVIL,
          startDate: new Date('2024-01-01'),
        },
      ];

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const results = calculator.batchCalculate(paramsList);

      expect(results).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe('statuteCalculator 单例', () => {
  it('应该导出单例实例', () => {
    expect(statuteCalculator).toBeDefined();
    expect(statuteCalculator).toBeInstanceOf(StatuteCalculator);
  });

  it('单例应该可以执行计算', () => {
    const result = statuteCalculator.calculate({
      caseId: 'case-22',
      statuteType: StatuteType.LITIGATION,
      caseType: CaseTypeForStatute.CIVIL,
      startDate: new Date('2024-01-01'),
    });

    expect(result.caseId).toBe('case-22');
  });
});
