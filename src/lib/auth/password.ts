/**
 * 密码加密和验证工具函数
 */

import bcrypt from "bcrypt";
import type { PasswordValidationError } from "@/types/auth";

const SALT_ROUNDS = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

/**
 * 加密密码
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * 验证密码复杂度
 * 规则：至少6位，必须包含字母和数字
 */
export function validatePassword(password: string): PasswordValidationError {
  const errors: string[] = [];

  // 检查密码是否存在
  if (!password || typeof password !== "string") {
    errors.push("密码不能为空");
    return {
      valid: false,
      errors,
    };
  }

  // 检查长度
  if (password.length < 6) {
    errors.push("密码长度必须至少6位");
  }

  // 检查是否包含字母
  if (!/[a-zA-Z]/.test(password)) {
    errors.push("密码必须包含字母");
  }

  // 检查是否包含数字
  if (!/[0-9]/.test(password)) {
    errors.push("密码必须包含数字");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 生成随机密码（可选功能）
 */
export function generateRandomPassword(length: number = 12): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = lowercase + uppercase + numbers + special;
  let password = "";

  // 确保至少包含一个小写字母
  password += lowercase[Math.floor(Math.random() * lowercase.length)];

  // 确保至少包含一个大写字母
  password += uppercase[Math.floor(Math.random() * uppercase.length)];

  // 确保至少包含一个数字
  password += numbers[Math.floor(Math.random() * numbers.length)];

  // 确保至少包含一个特殊字符
  password += special[Math.floor(Math.random() * special.length)];

  // 填充剩余长度
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // 打乱字符顺序
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}
