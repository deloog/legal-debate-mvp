/**
 * 发票工具函数单元测试
 * 测试发票工具函数的验证、格式化等功能
 */

import { InvoiceType } from '@/types/payment';
import {
  validateInvoiceFields,
  generateInvoiceNo,
  formatAmountToChinese,
  formatInvoiceDate,
} from '@/lib/invoice/invoice-utils';

describe('validateInvoiceFields', () => {
  describe('个人发票验证', () => {
    it('应该验证有效的个人发票', () => {
      const result = validateInvoiceFields(
        InvoiceType.PERSONAL,
        undefined,
        undefined,
        'test@example.com'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该接受邮箱', () => {
      const result = validateInvoiceFields(
        InvoiceType.PERSONAL,
        undefined,
        undefined,
        'user@company.com'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的邮箱格式', () => {
      const result = validateInvoiceFields(
        InvoiceType.PERSONAL,
        undefined,
        undefined,
        'invalid-email'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('邮箱格式无效');
    });

    it('个人发票不应该需要公司抬头和税号', () => {
      const result = validateInvoiceFields(
        InvoiceType.PERSONAL,
        undefined,
        undefined,
        'test@example.com'
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('企业发票验证', () => {
    it('应该验证有效的企业发票', () => {
      const result = validateInvoiceFields(
        InvoiceType.ENTERPRISE,
        '测试公司',
        '91110000MA00000000',
        'company@example.com'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝缺失的公司抬头', () => {
      const result = validateInvoiceFields(
        InvoiceType.ENTERPRISE,
        '',
        '91110000MA00000000',
        'company@example.com'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('企业发票需要填写发票抬头');
    });

    it('应该拒绝缺失的税号', () => {
      const result = validateInvoiceFields(
        InvoiceType.ENTERPRISE,
        '测试公司',
        '',
        'company@example.com'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('企业发票需要填写税号');
    });

    it('应该拒绝格式错误的税号 - 长度不足', () => {
      const result = validateInvoiceFields(
        InvoiceType.ENTERPRISE,
        '测试公司',
        '123',
        'company@example.com'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('税号格式无效，应为15-20位数字或字母');
    });

    it('应该拒绝格式错误的税号 - 长度过长', () => {
      const result = validateInvoiceFields(
        InvoiceType.ENTERPRISE,
        '测试公司',
        '123456789012345678901',
        'company@example.com'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('税号格式无效，应为15-20位数字或字母');
    });

    it('应该拒绝格式错误的税号 - 包含非法字符', () => {
      const result = validateInvoiceFields(
        InvoiceType.ENTERPRISE,
        '测试公司',
        '91110000MA0000@000',
        'company@example.com'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('税号格式无效，应为15-20位数字或字母');
    });

    it('应该接受18位统一社会信用代码', () => {
      const result = validateInvoiceFields(
        InvoiceType.ENTERPRISE,
        '测试公司',
        '91110000MA0000X000',
        'company@example.com'
      );

      expect(result.valid).toBe(true);
    });

    it('应该接受15位纳税人识别号', () => {
      const result = validateInvoiceFields(
        InvoiceType.ENTERPRISE,
        '测试公司',
        '110000000000001',
        'company@example.com'
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('公司抬头长度验证', () => {
    it('应该拒绝过长的公司抬头', () => {
      const longTitle = '测试公司'.repeat(30);

      const result = validateInvoiceFields(
        InvoiceType.ENTERPRISE,
        longTitle,
        '91110000MA0000X000',
        'company@example.com'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('发票抬头长度不能超过100个字符');
    });
  });

  describe('邮箱长度验证', () => {
    it('应该拒绝过长的邮箱', () => {
      const longEmail = `${'a'.repeat(200)}@example.com`;

      const result = validateInvoiceFields(
        InvoiceType.PERSONAL,
        undefined,
        undefined,
        longEmail
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('邮箱长度不能超过200个字符');
    });
  });
});

describe('generateInvoiceNo', () => {
  it('应该生成有效的发票号', () => {
    const invoiceNo = generateInvoiceNo();

    expect(invoiceNo).toBeDefined();
    expect(typeof invoiceNo).toBe('string');
  });

  it('生成的发票号应该以INV开头', () => {
    const invoiceNo = generateInvoiceNo();

    expect(invoiceNo).toMatch(/^INV/);
  });

  it('生成的发票号应该是唯一的', () => {
    const invoiceNo1 = generateInvoiceNo();
    const invoiceNo2 = generateInvoiceNo();

    expect(invoiceNo1).not.toBe(invoiceNo2);
  });

  it('生成的发票号应该包含日期信息', () => {
    const invoiceNo = generateInvoiceNo();
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    expect(invoiceNo).toContain(dateStr);
  });
});

describe('formatAmountToChinese', () => {
  it('应该格式化整数金额', () => {
    const result = formatAmountToChinese(100);

    expect(result).toBe('壹佰元整');
  });

  it('应该格式化小数金额', () => {
    const result = formatAmountToChinese(100.5);

    expect(result).toBe('壹佰元伍角');
  });

  it('应该格式化分', () => {
    const result = formatAmountToChinese(100.55);

    expect(result).toBe('壹佰元伍角伍分');
  });

  it('应该格式化零元', () => {
    const result = formatAmountToChinese(0);

    expect(result).toBe('零元整');
  });

  it('应该格式化小数金额 - 只角', () => {
    const result = formatAmountToChinese(100.5);

    expect(result).toBe('壹佰元伍角');
  });

  it('应该格式化大额数字', () => {
    const result = formatAmountToChinese(1234567.89);

    expect(result).toContain('壹佰');
  });

  it('应该处理负数', () => {
    const result = formatAmountToChinese(-100);

    expect(result).toBe('负壹佰元整');
  });

  it('应该四舍五入小数', () => {
    const result = formatAmountToChinese(100.999);

    expect(result).toContain('壹佰元');
  });
});

describe('formatInvoiceDate', () => {
  it('应该格式化日期为中文格式', () => {
    const date = new Date('2025-01-16');
    const result = formatInvoiceDate(date);

    expect(result).toBe('2025年1月16日');
  });

  it('应该格式化包含时间的日期', () => {
    const date = new Date('2025-01-16T12:30:00');
    const result = formatInvoiceDate(date);

    expect(result).toBe('2025年1月16日');
  });

  it('应该处理闰年日期', () => {
    const date = new Date('2024-02-29');
    const result = formatInvoiceDate(date);

    expect(result).toBe('2024年2月29日');
  });

  it('应该处理12月31日', () => {
    const date = new Date('2025-12-31');
    const result = formatInvoiceDate(date);

    expect(result).toBe('2025年12月31日');
  });

  it('应该处理1月1日', () => {
    const date = new Date('2025-01-01');
    const result = formatInvoiceDate(date);

    expect(result).toBe('2025年1月1日');
  });
});
