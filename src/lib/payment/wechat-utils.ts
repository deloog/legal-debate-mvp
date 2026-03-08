/**
 * 微信支付工具函数
 * 提供签名、加密、解密等工具函数
 */

import { logger } from '@/lib/logger';
import crypto from 'crypto';

/**
 * 生成随机字符串
 */
export function generateRandomString(length: number = 32): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成订单号
 */
export function generateOrderNo(prefix: string = 'ORD'): string {
  const timestamp = Date.now().toString();
  const randomStr = generateRandomString(8);
  return `${prefix}${timestamp}${randomStr}`.toUpperCase();
}

/**
 * 生成退款单号
 */
export function generateRefundNo(prefix: string = 'REF'): string {
  const timestamp = Date.now().toString();
  const randomStr = generateRandomString(8);
  return `${prefix}${timestamp}${randomStr}`.toUpperCase();
}

/**
 * HMAC-SHA256签名
 */
export function hmacSha256(message: string, key: string): string {
  return crypto.createHmac('sha256', key).update(message, 'utf8').digest('hex');
}

/**
 * SHA256签名
 */
export function sha256(message: string): string {
  return crypto.createHash('sha256').update(message).digest('hex');
}

/**
 * 生成微信支付签名
 */
export function generateWechatSign(
  data: Record<string, unknown>,
  apiKey: string
): string {
  // 1. 参数按ASCII码从小到大排序
  const sortedKeys = Object.keys(data).sort();

  // 2. 使用URL键值对的格式拼接成字符串
  const stringA = sortedKeys.map(key => `${key}=${data[key]}`).join('&');

  // 3. 在stringA最后拼接上key得到stringSignTemp字符串
  const stringSignTemp = `${stringA}&key=${apiKey}`;

  // 4. 对stringSignTemp进行MD5运算，并将结果字符串所有字符转换为大写
  return crypto
    .createHash('md5')
    .update(stringSignTemp)
    .digest('hex')
    .toUpperCase();
}

/**
 * 验证微信支付签名
 */
export function verifyWechatSign(
  data: Record<string, unknown>,
  sign: string,
  apiKey: string
): boolean {
  const calculatedSign = generateWechatSign(data, apiKey);
  return calculatedSign === sign;
}

/**
 * 生成时间戳
 */
export function generateTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 生成随机数
 */
export function generateNonceStr(length: number = 32): string {
  return generateRandomString(length);
}

/**
 * 转换金额（元转分）
 */
export function convertYuanToFen(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * 转换金额（分转元）
 */
export function convertFenToYuan(amount: number): number {
  return amount / 100;
}

/**
 * 格式化金额
 */
export function formatAmount(amount: number, decimals: number = 2): string {
  return amount.toFixed(decimals);
}

/**
 * 解析XML
 */
export function parseXml<T = Record<string, unknown>>(xml: string): T {
  const result: Record<string, unknown> = {};

  // 简单的XML解析
  const regex = /<(\w+)>([^<]*)<\/\1>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2].trim();
  }

  return result as T;
}

/**
 * 构建XML
 */
export function buildXml(data: Record<string, unknown>): string {
  let xml = '<xml>';
  for (const key of Object.keys(data)) {
    xml += `<${key}>${data[key]}</${key}>`;
  }
  xml += '</xml>';
  return xml;
}

/**
 * 格式化时间
 */
export function formatDate(
  date: Date,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 解析时间
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * 计算订单过期时间（默认2小时）
 */
export function calculateOrderExpireTime(minutes: number = 120): Date {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now;
}

/**
 * 检查订单是否过期
 */
export function isOrderExpired(expiredAt: Date): boolean {
  return new Date() > expiredAt;
}

/**
 * 验证IP地址（可选，用于安全验证）
 */
export function isValidIP(ip: string, allowedIPs: string[]): boolean {
  if (!allowedIPs || allowedIPs.length === 0) {
    return true;
  }
  return allowedIPs.includes(ip);
}

/**
 * 日志辅助函数
 */
export function logPayment(
  action: string,
  data: Record<string, unknown>,
  error?: Error
): void {
  const logData = {
    action,
    timestamp: new Date().toISOString(),
    ...data,
  };

  if (error) {
    logger.error(`[WechatPay] ${action}`, {
      ...logData,
      error: error.message,
      stack: error.stack,
    });
  } else {
    logger.info(`[WechatPay] ${action}`, logData);
  }
}

/**
 * 安全地解析JSON
 */
export function safeParseJSON<T = unknown>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    logger.error('[WechatPay] JSON解析失败', {
      json,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * 安全地序列化JSON
 */
export function safeStringifyJSON(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    logger.error('[WechatPay] JSON序列化失败', {
      data,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return '{}';
  }
}
