/**
 * 数据加密工具
 *
 * 用于加密敏感数据（如用户邮箱、手机号等）
 * 使用 AES-256-GCM 加密算法
 */

import crypto from 'crypto';

// 从环境变量获取加密密钥
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  'default-encryption-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';

// 确保密钥长度为32字节
function getEncryptionKey(): Buffer {
  const key = ENCRYPTION_KEY;
  if (key.length === 64) {
    // 如果是64位十六进制字符串
    return Buffer.from(key, 'hex');
  }
  // 否则使用SHA-256哈希生成32字节密钥
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * 加密文本
 * @param text 要加密的文本
 * @returns 加密后的文本（格式：iv:authTag:encrypted）
 */
export function encrypt(text: string): string {
  if (!text) return text;

  try {
    const iv = crypto.randomBytes(16);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // 返回格式：iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('加密失败:', error);
    throw new Error('数据加密失败');
  }
}

/**
 * 解密文本
 * @param encryptedText 加密的文本（格式：iv:authTag:encrypted）
 * @returns 解密后的文本
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('加密文本格式错误');
    }

    const [ivHex, authTagHex, encrypted] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('解密失败:', error);
    throw new Error('数据解密失败');
  }
}

/**
 * 加密邮箱（保留域名用于搜索）
 * @param email 邮箱地址
 * @returns 加密后的邮箱
 */
export function encryptEmail(email: string): string {
  if (!email) return email;

  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;

  const encryptedLocal = encrypt(localPart);
  return `${encryptedLocal}@${domain}`;
}

/**
 * 解密邮箱
 * @param encryptedEmail 加密的邮箱
 * @returns 解密后的邮箱
 */
export function decryptEmail(encryptedEmail: string): string {
  if (!encryptedEmail) return encryptedEmail;

  const [encryptedLocal, domain] = encryptedEmail.split('@');
  if (!encryptedLocal || !domain) return encryptedEmail;

  // 检查是否已加密（包含冒号分隔符）
  if (!encryptedLocal.includes(':')) {
    return encryptedEmail; // 未加密，直接返回
  }

  try {
    const localPart = decrypt(encryptedLocal);
    return `${localPart}@${domain}`;
  } catch {
    return encryptedEmail; // 解密失败，返回原值
  }
}

/**
 * 加密手机号（保留前3位和后4位）
 * @param phone 手机号
 * @returns 加密后的手机号
 */
export function encryptPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;

  const prefix = phone.substring(0, 3);
  const suffix = phone.substring(phone.length - 4);
  const middle = phone.substring(3, phone.length - 4);

  const encryptedMiddle = encrypt(middle);
  return `${prefix}:${encryptedMiddle}:${suffix}`;
}

/**
 * 解密手机号
 * @param encryptedPhone 加密的手机号
 * @returns 解密后的手机号
 */
export function decryptPhone(encryptedPhone: string): string {
  if (!encryptedPhone) return encryptedPhone;

  const parts = encryptedPhone.split(':');
  if (parts.length < 5) {
    return encryptedPhone; // 未加密或格式错误
  }

  try {
    const prefix = parts[0];
    const suffix = parts[parts.length - 1];
    const encryptedMiddle = parts.slice(1, -1).join(':');

    const middle = decrypt(encryptedMiddle);
    return `${prefix}${middle}${suffix}`;
  } catch {
    return encryptedPhone; // 解密失败，返回原值
  }
}

/**
 * 哈希密码（用于密码存储）
 * @param password 明文密码
 * @returns 哈希后的密码
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * 验证密码
 * @param password 明文密码
 * @param hashedPassword 哈希后的密码
 * @returns 是否匹配
 */
export function verifyPassword(
  password: string,
  hashedPassword: string
): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return hash === verifyHash;
}

/**
 * 生成随机令牌
 * @param length 令牌长度（字节）
 * @returns 随机令牌
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 生成安全的随机字符串
 * @param length 字符串长度
 * @returns 随机字符串
 */
export function generateSecureString(length: number = 16): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }

  return result;
}
