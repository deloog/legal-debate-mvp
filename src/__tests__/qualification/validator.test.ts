/**
 * 律师资格验证器单元测试
 */

import {
  validateLicenseNumber,
  validateIdCardNumber,
  validateFullName,
  validateLawFirm,
  validateBasicInfo,
  checkLicenseNumberDuplicate,
} from '@/lib/qualification/validator';

describe('validateLicenseNumber', () => {
  it('应该验证有效的17位执业证号', () => {
    const result = validateLicenseNumber('12345678901234567');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('12345678901234567');
    expect(result.errors).toEqual([]);
  });

  it('应该接受带连字符的执业证号', () => {
    const result = validateLicenseNumber('12345678-901234567');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('12345678901234567');
  });

  it('应该接受带空格的执业证号', () => {
    const result = validateLicenseNumber('12345678 901234567');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('12345678901234567');
  });

  it('应该拒绝空值', () => {
    const result = validateLicenseNumber('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('执业证号不能为空');
  });

  it('应该拒绝非17位数字', () => {
    const result = validateLicenseNumber('1234567890');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('执业证号格式不正确，应为17位数字');
  });

  it('应该拒绝包含字母的执业证号', () => {
    const result = validateLicenseNumber('1234567890123456A');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('执业证号格式不正确，应为17位数字');
  });
});

describe('validateIdCardNumber', () => {
  it('应该验证有效的18位身份证号', () => {
    // 使用正确的校验码：110101199003076528
    expect(validateIdCardNumber('110101199003076528')).toBe(true);
  });

  it('应该拒绝空值', () => {
    expect(validateIdCardNumber('')).toBe(false);
  });

  it('应该拒绝非18位身份证号', () => {
    expect(validateIdCardNumber('123456789012345')).toBe(false);
  });

  it('应该拒绝格式错误的身份证号', () => {
    expect(validateIdCardNumber('12345678901234567X')).toBe(false);
  });

  it('应该拒绝校验码错误的身份证号', () => {
    // 有效身份证号是110101199003076528，修改最后一位应该失败
    expect(validateIdCardNumber('110101199003076521')).toBe(false);
  });
});

describe('validateFullName', () => {
  it('应该验证有效的中文姓名', () => {
    expect(validateFullName('张三')).toBe(true);
  });

  it('应该验证有效的英文名', () => {
    expect(validateFullName('John Smith')).toBe(true);
  });

  it('应该拒绝空值', () => {
    expect(validateFullName('')).toBe(false);
  });

  it('应该拒绝过短的姓名', () => {
    expect(validateFullName('张')).toBe(false);
  });

  it('应该拒绝过长的姓名', () => {
    const longName = '张'.repeat(51);
    expect(validateFullName(longName)).toBe(false);
  });

  it('应该拒绝包含特殊字符的姓名', () => {
    expect(validateFullName('张三@')).toBe(false);
  });
});

describe('validateLawFirm', () => {
  it('应该验证有效的律所名称', () => {
    expect(validateLawFirm('北京市律师事务所')).toBe(true);
    expect(validateLawFirm('北京某某律师事务所')).toBe(true);
  });

  it('应该拒绝空值', () => {
    expect(validateLawFirm('')).toBe(false);
  });

  it('应该拒绝过短的律所名称', () => {
    expect(validateLawFirm('律所')).toBe(false);
  });

  it('应该拒绝过长的律所名称', () => {
    const longName = '律所名称'.repeat(30);
    expect(validateLawFirm(longName)).toBe(false);
  });

  it('应该拒绝包含特殊字符的律所名称', () => {
    expect(validateLawFirm('北京市@律师事务所')).toBe(false);
  });
});

describe('validateBasicInfo', () => {
  it('应该验证完整的有效信息', () => {
    const result = validateBasicInfo({
      licenseNumber: '12345678901234567',
      fullName: '张三',
      idCardNumber: '110101199003076528',
      lawFirm: '北京市律师事务所',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('应该返回所有验证错误', () => {
    const result = validateBasicInfo({
      licenseNumber: '123',
      fullName: '张',
      idCardNumber: '123456',
      lawFirm: '律所',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.licenseNumber).toBeDefined();
    expect(result.errors.fullName).toBeDefined();
    expect(result.errors.idCardNumber).toBeDefined();
    expect(result.errors.lawFirm).toBeDefined();
  });

  it('应该返回部分验证错误', () => {
    const result = validateBasicInfo({
      licenseNumber: '12345678901234567',
      fullName: '张三',
      idCardNumber: '110101199003076528',
      lawFirm: '律所',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.licenseNumber).toBeUndefined();
    expect(result.errors.fullName).toBeUndefined();
    expect(result.errors.idCardNumber).toBeUndefined();
    expect(result.errors.lawFirm).toBeDefined();
  });
});

describe('checkLicenseNumberDuplicate', () => {
  it('应该检测重复的执业证号', () => {
    const existingNumbers = ['12345678901234567', '23456789012345678'];
    const result = checkLicenseNumberDuplicate(
      existingNumbers,
      '12345678901234567'
    );
    expect(result).toBe(true);
  });

  it('应该接受不重复的执业证号', () => {
    const existingNumbers = ['12345678901234567', '23456789012345678'];
    const result = checkLicenseNumberDuplicate(
      existingNumbers,
      '34567890123456789'
    );
    expect(result).toBe(false);
  });

  it('应该处理带连字符的执业证号', () => {
    const existingNumbers = ['12345678901234567'];
    const result = checkLicenseNumberDuplicate(
      existingNumbers,
      '12345678-901234567'
    );
    expect(result).toBe(true);
  });

  it('应该处理带空格的执业证号', () => {
    const existingNumbers = ['12345678901234567'];
    const result = checkLicenseNumberDuplicate(
      existingNumbers,
      '12345678 901234567'
    );
    expect(result).toBe(true);
  });
});
