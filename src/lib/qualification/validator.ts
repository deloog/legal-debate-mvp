/**
 * 律师资格验证器
 * 提供执业证号、身份证号等基础信息验证功能
 */

import type {
  LicenseNumberValidation,
  BasicInfoValidation,
} from "@/types/qualification";

/**
 * 执业证号正则表达式（17位数字）
 * 格式：XXXXXX-XXXXXXXX-XX（部分省市可能使用连字符）
 * 或者：17位纯数字
 */
const LICENSE_NUMBER_REGEX = /^\d{17}$/;

/**
 * 中国大陆身份证号正则表达式（18位）
 */
const ID_CARD_REGEX =
  /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;

/**
 * 验证执业证号
 * @param licenseNumber 执业证号
 * @returns 验证结果
 */
export function validateLicenseNumber(
  licenseNumber: string,
): LicenseNumberValidation {
  const errors: string[] = [];

  if (!licenseNumber) {
    errors.push("执业证号不能为空");
    return { valid: false, errors };
  }

  // 移除可能的连字符和空格
  const cleaned = licenseNumber.replace(/[-\s]/g, "");

  // 验证格式
  if (!LICENSE_NUMBER_REGEX.test(cleaned)) {
    errors.push("执业证号格式不正确，应为17位数字");
    return { valid: false, errors };
  }

  return { valid: true, errors: [], formatted: cleaned };
}

/**
 * 验证身份证号
 * @param idCardNumber 身份证号
 * @returns 验证结果
 */
export function validateIdCardNumber(idCardNumber: string): boolean {
  if (!idCardNumber) {
    return false;
  }

  // 基础格式验证
  if (!ID_CARD_REGEX.test(idCardNumber)) {
    return false;
  }

  // 校验码验证
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];

  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += parseInt(idCardNumber[i], 10) * weights[i];
  }

  const checkCode = checkCodes[sum % 11];
  const actualCheckCode = idCardNumber[17].toUpperCase();

  return checkCode === actualCheckCode;
}

/**
 * 验证姓名
 * @param fullName 姓名
 * @returns 是否有效
 */
export function validateFullName(fullName: string): boolean {
  if (!fullName) {
    return false;
  }

  // 姓名长度验证（2-50个字符）
  if (fullName.length < 2 || fullName.length > 50) {
    return false;
  }

  // 姓名格式验证（支持中文、英文、少数民族姓名）
  const nameRegex = /^[\u4e00-\u9fa5a-zA-Z\u00b7\u2019·' ]+$/;
  return nameRegex.test(fullName);
}

/**
 * 验证律所名称
 * @param lawFirm 律所名称
 * @returns 是否有效
 */
export function validateLawFirm(lawFirm: string): boolean {
  if (!lawFirm) {
    return false;
  }

  // 律所名称长度验证（4-100个字符）
  if (lawFirm.length < 4 || lawFirm.length > 100) {
    return false;
  }

  // 律所名称格式验证
  const lawFirmRegex = /^[\u4e00-\u9fa5a-zA-Z0-9（）()《》]+$/;
  return lawFirmRegex.test(lawFirm);
}

/**
 * 验证基础信息
 * @param data 提交的资格信息
 * @returns 验证结果
 */
export function validateBasicInfo(data: {
  licenseNumber: string;
  fullName: string;
  idCardNumber: string;
  lawFirm: string;
}): BasicInfoValidation {
  const errors: Record<string, string> = {};

  // 验证执业证号
  const licenseValidation = validateLicenseNumber(data.licenseNumber);
  if (!licenseValidation.valid) {
    errors.licenseNumber = licenseValidation.errors.join(", ");
  }

  // 验证姓名
  if (!validateFullName(data.fullName)) {
    errors.fullName = "姓名格式不正确";
  }

  // 验证身份证号
  if (!validateIdCardNumber(data.idCardNumber)) {
    errors.idCardNumber = "身份证号格式不正确";
  }

  // 验证律所名称
  if (!validateLawFirm(data.lawFirm)) {
    errors.lawFirm = "律所名称格式不正确";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * 检查执业证号是否重复
 * 此函数需要在服务层调用数据库后使用
 * @param existingLicenseNumbers 已存在的执业证号列表
 * @param licenseNumber 待验证的执业证号
 * @returns 是否重复
 */
export function checkLicenseNumberDuplicate(
  existingLicenseNumbers: string[],
  licenseNumber: string,
): boolean {
  const cleaned = licenseNumber.replace(/[-\s]/g, "");
  return existingLicenseNumbers.includes(cleaned);
}
