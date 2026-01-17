/**
 * 发票工具函数
 * 提供发票验证、编号生成、金额计算等功能
 */

import { InvoiceType } from '@/types/payment';

/**
 * 发票编号前缀
 */
export const INVOICE_PREFIX = 'INV';

/**
 * 发票编号分隔符
 */
export const INVOICE_SEPARATOR = '-';

/**
 * 生成发票编号
 * 格式: INV-YYYYMMDD-XXXXXXXX
 * @returns 发票编号
 */
export function generateInvoiceNo(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${INVOICE_PREFIX}${INVOICE_SEPARATOR}${year}${month}${day}${INVOICE_SEPARATOR}${random}`;
}

/**
 * 验证发票抬头
 * @param title 发票抬头
 * @returns 验证结果
 */
export function validateInvoiceTitle(title: string): {
  valid: boolean;
  error?: string;
} {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: '发票抬头不能为空' };
  }
  if (title.length > 100) {
    return { valid: false, error: '发票抬头长度不能超过100个字符' };
  }
  return { valid: true };
}

/**
 * 验证税号
 * 税号格式：15-20位数字或字母
 * @param taxNumber 税号
 * @returns 验证结果
 */
export function validateTaxNumber(taxNumber: string): {
  valid: boolean;
  error?: string;
} {
  if (!taxNumber || taxNumber.trim().length === 0) {
    return { valid: false, error: '税号不能为空' };
  }
  if (taxNumber.length < 15 || taxNumber.length > 20) {
    return { valid: false, error: '税号格式无效，应为15-20位数字或字母' };
  }
  const regex = /^[0-9A-Za-z]{15,20}$/;
  if (!regex.test(taxNumber)) {
    return { valid: false, error: '税号格式无效，应为15-20位数字或字母' };
  }
  return { valid: true };
}

/**
 * 验证邮箱
 * @param email 邮箱地址
 * @returns 验证结果
 */
export function validateEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: '接收邮箱不能为空' };
  }
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    return { valid: false, error: '邮箱格式无效' };
  }
  if (email.length > 200) {
    return { valid: false, error: '邮箱长度不能超过200个字符' };
  }
  return { valid: true };
}

/**
 * 验证企业发票信息
 * @param title 发票抬头
 * @param taxNumber 税号
 * @param email 接收邮箱
 * @returns 验证结果
 */
export function validateEnterpriseInvoice(
  title: string,
  taxNumber: string,
  email: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const titleResult = validateInvoiceTitle(title);
  if (!titleResult.valid && titleResult.error) {
    errors.push(titleResult.error);
  }
  const taxNumberResult = validateTaxNumber(taxNumber);
  if (!taxNumberResult.valid && taxNumberResult.error) {
    errors.push(taxNumberResult.error);
  }
  const emailResult = validateEmail(email);
  if (!emailResult.valid && emailResult.error) {
    errors.push(emailResult.error);
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证个人发票信息
 * @param email 接收邮箱
 * @returns 验证结果
 */
export function validatePersonalInvoice(email: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const emailResult = validateEmail(email);
  if (!emailResult.valid && emailResult.error) {
    errors.push(emailResult.error);
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证发票类型所需的必填字段
 * @param type 发票类型
 * @param title 发票抬头
 * @param taxNumber 税号
 * @param email 接收邮箱
 * @returns 验证结果
 */
export function validateInvoiceFields(
  type: InvoiceType,
  title: string | undefined,
  taxNumber: string | undefined,
  email: string | undefined
): {
  valid: boolean;
  errors: string[];
} {
  if (type === InvoiceType.ENTERPRISE) {
    if (!title) {
      return { valid: false, errors: ['企业发票需要填写发票抬头'] };
    }
    if (!taxNumber) {
      return { valid: false, errors: ['企业发票需要填写税号'] };
    }
    if (!email) {
      return { valid: false, errors: ['企业发票需要填写接收邮箱'] };
    }
    return validateEnterpriseInvoice(title, taxNumber, email);
  } else {
    if (!email) {
      return { valid: false, errors: ['个人发票需要填写接收邮箱'] };
    }
    return validatePersonalInvoice(email);
  }
}

/**
 * 格式化金额为中文大写
 * @param amount 金额
 * @returns 中文大写金额
 */
export function formatAmountToChinese(amount: number): string {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const largeUnits = ['', '万', '亿'];

  // 处理负数
  if (amount < 0) {
    return '负' + formatAmountToChinese(-amount);
  }

  if (amount === 0) {
    return '零元整';
  }

  const integerPart = Math.floor(amount);
  const amountStr = integerPart.toString();
  const largeUnitParts: string[] = [];

  // 按万、亿分组处理（从右到左）
  const totalGroups = Math.ceil(amountStr.length / 4);
  for (let g = 0; g < totalGroups; g++) {
    // 计算当前组的起始和结束索引（从右到左）
    const startPos = Math.max(0, amountStr.length - (g + 1) * 4);
    const endPos = amountStr.length - g * 4;
    const groupStr = amountStr.substring(startPos, endPos);
    let groupResult = '';
    let hasNonZero = false;

    // 处理组内的每个数字
    for (let i = 0; i < groupStr.length; i++) {
      const digit = parseInt(groupStr[i], 10);
      // 计算在组内从右到左的位置
      const posFromRight = groupStr.length - 1 - i;

      if (digit === 0) {
        // 检查当前组后面是否有非零数字
        let hasNonZeroAfter = false;
        for (let j = i + 1; j < groupStr.length; j++) {
          if (parseInt(groupStr[j], 10) !== 0) {
            hasNonZeroAfter = true;
            break;
          }
        }
        // 只在前面有非零数字且后面也有非零数字时才加零
        if (hasNonZero && hasNonZeroAfter) {
          groupResult += digits[0];
        }
      } else {
        hasNonZero = true;
        groupResult += digits[digit];
        // 添加单位（个位除外，即posFromRight > 0时）
        if (posFromRight > 0) {
          groupResult += units[posFromRight];
        }
      }
    }

    // 只有当组有内容时才添加
    if (groupResult.length > 0) {
      // 添加大单位（第一组不加单位，第二组加万，第三组加亿）
      const largeUnit = g > 0 ? largeUnits[g - 1] : '';
      largeUnitParts.push(groupResult + largeUnit);
    }
  }

  // 反转数组并拼接
  let result = largeUnitParts.reverse().join('');
  result += '元';

  // 处理小数部分
  const decimalPart = Math.round((amount % 1) * 100);
  // 确保decimalPart不超过99
  const safeDecimalPart = decimalPart > 99 ? 99 : decimalPart;
  if (safeDecimalPart > 0) {
    const tens = Math.floor(safeDecimalPart / 10);
    const ones = safeDecimalPart % 10;

    if (tens > 0) {
      result += digits[tens] + '角';
    }
    if (ones > 0) {
      result += digits[ones] + '分';
    }
  } else {
    result += '整';
  }

  return result;
}

/**
 * 格式化发票日期为中文格式
 * @param date 日期
 * @returns 格式化后的日期字符串
 */
export function formatInvoiceDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
