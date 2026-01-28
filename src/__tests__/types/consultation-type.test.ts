/**
 * 咨询类型定义测试
 */
import {
  ConsultationType,
  ConsultStatus,
  CONSULTATION_TYPE_LABELS,
  CONSULT_STATUS_LABELS,
  CONSULT_STATUS_COLORS,
  isValidConsultationType,
  isValidConsultStatus,
  getConsultationTypeLabel,
  getConsultStatusLabel,
  getConsultStatusColor,
  generateConsultNumber,
  calculateConversionRate,
} from '../../types/consultation';

describe('ConsultationType 枚举', () => {
  test('应该包含所有咨询类型', () => {
    expect(ConsultationType.PHONE).toBe('PHONE');
    expect(ConsultationType.VISIT).toBe('VISIT');
    expect(ConsultationType.ONLINE).toBe('ONLINE');
    expect(ConsultationType.REFERRAL).toBe('REFERRAL');
  });

  test('应该包含所有咨询类型标签', () => {
    expect(CONSULTATION_TYPE_LABELS[ConsultationType.PHONE]).toBe('电话咨询');
    expect(CONSULTATION_TYPE_LABELS[ConsultationType.VISIT]).toBe('来访咨询');
    expect(CONSULTATION_TYPE_LABELS[ConsultationType.ONLINE]).toBe('在线咨询');
    expect(CONSULTATION_TYPE_LABELS[ConsultationType.REFERRAL]).toBe('转介绍');
  });
});

describe('ConsultStatus 枚举', () => {
  test('应该包含所有咨询状态', () => {
    expect(ConsultStatus.PENDING).toBe('PENDING');
    expect(ConsultStatus.FOLLOWING).toBe('FOLLOWING');
    expect(ConsultStatus.CONVERTED).toBe('CONVERTED');
    expect(ConsultStatus.CLOSED).toBe('CLOSED');
    expect(ConsultStatus.ARCHIVED).toBe('ARCHIVED');
  });

  test('应该包含所有咨询状态标签', () => {
    expect(CONSULT_STATUS_LABELS[ConsultStatus.PENDING]).toBe('待跟进');
    expect(CONSULT_STATUS_LABELS[ConsultStatus.FOLLOWING]).toBe('跟进中');
    expect(CONSULT_STATUS_LABELS[ConsultStatus.CONVERTED]).toBe('已转化');
    expect(CONSULT_STATUS_LABELS[ConsultStatus.CLOSED]).toBe('已关闭');
    expect(CONSULT_STATUS_LABELS[ConsultStatus.ARCHIVED]).toBe('已归档');
  });

  test('应该包含所有咨询状态颜色', () => {
    expect(CONSULT_STATUS_COLORS[ConsultStatus.PENDING]).toBe('gray');
    expect(CONSULT_STATUS_COLORS[ConsultStatus.FOLLOWING]).toBe('blue');
    expect(CONSULT_STATUS_COLORS[ConsultStatus.CONVERTED]).toBe('green');
    expect(CONSULT_STATUS_COLORS[ConsultStatus.CLOSED]).toBe('red');
    expect(CONSULT_STATUS_COLORS[ConsultStatus.ARCHIVED]).toBe('gray');
  });
});

describe('类型守卫函数', () => {
  describe('isValidConsultationType', () => {
    test('应该验证有效的咨询类型', () => {
      expect(isValidConsultationType('PHONE')).toBe(true);
      expect(isValidConsultationType('VISIT')).toBe(true);
      expect(isValidConsultationType('ONLINE')).toBe(true);
      expect(isValidConsultationType('REFERRAL')).toBe(true);
    });

    test('应该拒绝无效的咨询类型', () => {
      expect(isValidConsultationType('INVALID')).toBe(false);
      expect(isValidConsultationType('')).toBe(false);
      expect(isValidConsultationType('phone')).toBe(false);
    });

    test('应该拒绝 undefined 和 null', () => {
      expect(isValidConsultationType('' as unknown as string)).toBe(false);
      expect(isValidConsultationType(undefined as unknown as string)).toBe(
        false
      );
    });
  });

  describe('isValidConsultStatus', () => {
    test('应该验证有效的咨询状态', () => {
      expect(isValidConsultStatus('PENDING')).toBe(true);
      expect(isValidConsultStatus('FOLLOWING')).toBe(true);
      expect(isValidConsultStatus('CONVERTED')).toBe(true);
      expect(isValidConsultStatus('CLOSED')).toBe(true);
      expect(isValidConsultStatus('ARCHIVED')).toBe(true);
    });

    test('应该拒绝无效的咨询状态', () => {
      expect(isValidConsultStatus('INVALID')).toBe(false);
      expect(isValidConsultStatus('')).toBe(false);
      expect(isValidConsultStatus('pending')).toBe(false);
    });

    test('应该拒绝 undefined 和 null', () => {
      expect(isValidConsultStatus('' as unknown as string)).toBe(false);
      expect(isValidConsultStatus(undefined as unknown as string)).toBe(false);
    });
  });
});

describe('获取标签和颜色函数', () => {
  describe('getConsultationTypeLabel', () => {
    test('应该返回正确的咨询类型标签', () => {
      expect(getConsultationTypeLabel(ConsultationType.PHONE)).toBe('电话咨询');
      expect(getConsultationTypeLabel(ConsultationType.VISIT)).toBe('来访咨询');
      expect(getConsultationTypeLabel(ConsultationType.ONLINE)).toBe(
        '在线咨询'
      );
      expect(getConsultationTypeLabel(ConsultationType.REFERRAL)).toBe(
        '转介绍'
      );
    });
  });

  describe('getConsultStatusLabel', () => {
    test('应该返回正确的咨询状态标签', () => {
      expect(getConsultStatusLabel(ConsultStatus.PENDING)).toBe('待跟进');
      expect(getConsultStatusLabel(ConsultStatus.FOLLOWING)).toBe('跟进中');
      expect(getConsultStatusLabel(ConsultStatus.CONVERTED)).toBe('已转化');
      expect(getConsultStatusLabel(ConsultStatus.CLOSED)).toBe('已关闭');
      expect(getConsultStatusLabel(ConsultStatus.ARCHIVED)).toBe('已归档');
    });
  });

  describe('getConsultStatusColor', () => {
    test('应该返回正确的咨询状态颜色', () => {
      expect(getConsultStatusColor(ConsultStatus.PENDING)).toBe('gray');
      expect(getConsultStatusColor(ConsultStatus.FOLLOWING)).toBe('blue');
      expect(getConsultStatusColor(ConsultStatus.CONVERTED)).toBe('green');
      expect(getConsultStatusColor(ConsultStatus.CLOSED)).toBe('red');
      expect(getConsultStatusColor(ConsultStatus.ARCHIVED)).toBe('gray');
    });
  });
});

describe('生成咨询编号', () => {
  test('应该生成正确格式的咨询编号', () => {
    const date = new Date('2026-01-28');
    const consultNumber = generateConsultNumber(date, 1);
    expect(consultNumber).toBe('ZX20260128001');
  });

  test('应该使用当前日期如果未提供日期', () => {
    const consultNumber = generateConsultNumber(undefined, 1);
    expect(consultNumber).toMatch(/^ZX\d{8}\d{3}$/);
  });

  test('应该使用默认序号1如果未提供序号', () => {
    const date = new Date('2026-01-28');
    const consultNumber = generateConsultNumber(date);
    expect(consultNumber).toBe('ZX20260128001');
  });

  test('应该正确处理多位序号', () => {
    const date = new Date('2026-01-28');
    expect(generateConsultNumber(date, 1)).toBe('ZX20260128001');
    expect(generateConsultNumber(date, 99)).toBe('ZX20260128099');
    expect(generateConsultNumber(date, 100)).toBe('ZX20260128100');
    expect(generateConsultNumber(date, 999)).toBe('ZX20260128999');
  });

  test('应该正确格式化月份和日期', () => {
    expect(generateConsultNumber(new Date('2026-01-01'), 1)).toBe(
      'ZX20260101001'
    );
    expect(generateConsultNumber(new Date('2026-12-31'), 1)).toBe(
      'ZX20261231001'
    );
  });
});

describe('计算转化率', () => {
  test('应该正确计算转化率', () => {
    expect(calculateConversionRate(100, 20)).toBe(20);
    expect(calculateConversionRate(100, 50)).toBe(50);
    expect(calculateConversionRate(100, 100)).toBe(100);
  });

  test('应该处理小数结果', () => {
    expect(calculateConversionRate(3, 1)).toBeCloseTo(33.3333, 4);
    expect(calculateConversionRate(7, 3)).toBeCloseTo(42.8571, 4);
  });

  test('应该返回0如果总数为0', () => {
    expect(calculateConversionRate(0, 0)).toBe(0);
  });

  test('应该处理边界值', () => {
    expect(calculateConversionRate(1, 0)).toBe(0);
    expect(calculateConversionRate(1, 1)).toBe(100);
  });
});
