/**
 * 企业信息验证器
 */

import type {
  EnterpriseNameValidationError,
  CreditCodeValidationError,
  LegalPersonValidationError,
} from '@/types/enterprise';

// =============================================================================
// 企业名称验证
// =============================================================================

/**
 * 验证企业名称
 * @param name 企业名称
 * @returns 验证结果
 */
export function validateEnterpriseName(
  name: string
): EnterpriseNameValidationError {
  const errors: string[] = [];

  if (!name || name.trim() === '') {
    errors.push('企业名称不能为空');
  } else {
    // 企业名称长度限制
    if (name.length < 2) {
      errors.push('企业名称至少包含2个字符');
    }
    if (name.length > 100) {
      errors.push('企业名称不能超过100个字符');
    }

    // 企业名称格式验证
    const trimmedName = name.trim();
    if (!/^[a-zA-Z0-9\u4e00-\u9fa5（）()\-., ]+$/.test(trimmedName)) {
      errors.push('企业名称只能包含中文、英文、数字和括号');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// 统一社会信用代码验证
// =============================================================================

/**
 * 验证统一社会信用代码（18位）
 * @param creditCode 统一社会信用代码
 * @returns 验证结果
 */
export function validateCreditCode(
  creditCode: string
): CreditCodeValidationError {
  const errors: string[] = [];

  if (!creditCode || creditCode.trim() === '') {
    errors.push('统一社会信用代码不能为空');
  } else {
    const trimmedCode = creditCode.trim().toUpperCase();

    // 长度验证
    if (trimmedCode.length !== 18) {
      errors.push('统一社会信用代码必须为18位');
    }

    // 格式验证：18位，前17位为数字或大写字母，第18位为数字或字母
    if (!/^[0-9A-HJ-NPQ-Z]{17}[0-9A-HJ-NPQ-Z]$/.test(trimmedCode)) {
      errors.push('统一社会信用代码格式不正确');
    }

    // 校验码验证（第18位）
    // 注意：校验码验证比较复杂，暂时只做格式验证
    // 如果需要严格的校验码验证，可以使用第三方API验证
    if (trimmedCode.length === 18) {
      const chars = '0123456789ABCDEFGHJKLMNPQRTUWXY';
      for (let i = 0; i < 18; i++) {
        const value = chars.indexOf(trimmedCode[i]);
        if (value === -1) {
          errors.push('统一社会信用代码包含非法字符');
          break;
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// 法人代表验证
// =============================================================================

/**
 * 验证法人代表姓名
 * @param name 法人代表姓名
 * @returns 验证结果
 */
export function validateLegalPerson(name: string): LegalPersonValidationError {
  const errors: string[] = [];

  if (!name || name.trim() === '') {
    errors.push('法人代表姓名不能为空');
  } else {
    // 姓名长度限制
    if (name.length < 2) {
      errors.push('法人代表姓名至少包含2个字符');
    }
    if (name.length > 50) {
      errors.push('法人代表姓名不能超过50个字符');
    }

    // 姓名格式验证
    const trimmedName = name.trim();
    if (!/^[\u4e00-\u9fa5]{2,10}$/.test(trimmedName)) {
      errors.push('法人代表姓名只能为中文，2-10个字符');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// 行业类型验证
// =============================================================================

/**
 * 验证行业类型
 * @param industryType 行业类型
 * @returns 验证结果
 */
export function validateIndustryType(industryType: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!industryType || industryType.trim() === '') {
    errors.push('行业类型不能为空');
  } else if (industryType.length > 50) {
    errors.push('行业类型不能超过50个字符');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// 综合验证
// =============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 验证企业注册信息
 * @param data 企业注册数据
 * @returns 验证结果
 */
export function validateEnterpriseRegistration(data: {
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
}): ValidationResult {
  const errors: string[] = [];

  // 验证企业名称
  const nameValidation = validateEnterpriseName(data.enterpriseName);
  if (!nameValidation.valid) {
    errors.push(...nameValidation.errors);
  }

  // 验证统一社会信用代码
  const creditCodeValidation = validateCreditCode(data.creditCode);
  if (!creditCodeValidation.valid) {
    errors.push(...creditCodeValidation.errors);
  }

  // 验证法人代表
  const legalPersonValidation = validateLegalPerson(data.legalPerson);
  if (!legalPersonValidation.valid) {
    errors.push(...legalPersonValidation.errors);
  }

  // 验证行业类型
  const industryTypeValidation = validateIndustryType(data.industryType);
  if (!industryTypeValidation.valid) {
    errors.push(...industryTypeValidation.errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
