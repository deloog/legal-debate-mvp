/**
 * 支付宝支付工具函数
 * 提供签名、验签、金额转换等工具函数
 */

import { logger } from '@/lib/logger';
import { AlipayNotifyRequest, AlipayReturnParams } from '@/types/payment';
import crypto from 'crypto';

/**
 * 生成随机字符串
 */
export function generateNonceStr(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * 生成时间戳（秒）
 */
export function generateTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 生成订单号
 */
export function generateOrderNo(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `ALI${timestamp}${random}`;
}

/**
 * 计算订单过期时间
 */
export function calculateOrderExpireTime(minutes: number): Date {
  const expiredAt = new Date();
  expiredAt.setMinutes(expiredAt.getMinutes() + minutes);
  return expiredAt;
}

/**
 * 生成退款请求号
 */
export function generateRefundNo(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `REF${timestamp}${random}`;
}

/**
 * 安全解析JSON
 */
export function safeParseJSON<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    logger.error('[AlipayUtils] JSON解析失败:', error);
    return null;
  }
}

/**
 * 安全序列化JSON
 */
export function safeStringifyJSON(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    logger.error('[AlipayUtils] JSON序列化失败:', error);
    return '{}';
  }
}

/**
 * 支付宝RSA签名
 */
export function alipaySign(
  params: Record<string, unknown>,
  privateKey: string
): string {
  try {
    // 1. 参数排序
    const sortedKeys = Object.keys(params).sort();
    const sortedParams: string[] = [];

    // 2. 过滤空值并拼接
    for (const key of sortedKeys) {
      const value = params[key];
      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !Array.isArray(value) // 不签名数组类型
      ) {
        sortedParams.push(`${key}=${String(value)}`);
      }
    }

    // 3. 拼接成字符串
    const signContent = sortedParams.join('&');

    // 4. RSA签名
    const sign = crypto
      .createSign('RSA-SHA256')
      .update(signContent, 'utf8')
      .sign(privateKey, 'base64');

    return sign;
  } catch (error) {
    logger.error('[AlipayUtils] 支付宝签名失败:', error);
    throw new Error(
      `支付宝签名失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 支付宝RSA验签
 */
export function alipayVerify(
  params: Record<string, unknown>,
  publicKey: string,
  sign: string
): boolean {
  try {
    // 1. 移除sign和sign_type参数
    const {
      sign: _sign,
      sign_type: _signType,
      ...filteredParams
    } = params as Record<string, unknown>;
    void _sign; // 标记为有意未使用
    void _signType; // 标记为有意未使用

    // 2. 参数排序
    const sortedKeys = Object.keys(filteredParams).sort();
    const sortedParams: string[] = [];

    // 3. 过滤空值并拼接
    for (const key of sortedKeys) {
      const value = filteredParams[key];
      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !Array.isArray(value) // 不验签数组类型
      ) {
        sortedParams.push(`${key}=${String(value)}`);
      }
    }

    // 4. 拼接成字符串
    const signContent = sortedParams.join('&');

    // 5. RSA验签
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signContent, 'utf8');

    const isValid = verify.verify(publicKey, sign, 'base64');

    return isValid;
  } catch (error) {
    logger.error('[AlipayUtils] 支付宝验签失败:', error);
    return false;
  }
}

/**
 * 将参数转换为表单格式
 */
export function paramsToFormData(params: Record<string, unknown>): string {
  return Object.keys(params)
    .map(key => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(
        String(params[key] ?? '')
      )}`;
    })
    .join('&');
}

/**
 * 支付日志记录
 */
export function logPayment(
  action: string,
  data: Record<string, unknown>,
  error?: Error
): void {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    action,
    data,
    ...(error && {
      error: {
        message: error.message,
        stack: error.stack,
      },
    }),
  };

  logger.info(`[AlipayPayment] ${action}:`, JSON.stringify(logData));
}

/**
 * 验证支付宝回调签名
 */
export function verifyAlipayNotify(
  params: AlipayNotifyRequest,
  publicKey: string
): boolean {
  try {
    // 使用类型断言处理可能缺失的 sign 字段
    const { sign, ...filteredParams } = params as AlipayNotifyRequest & {
      sign?: string;
    };

    if (!sign) {
      logger.error('[AlipayUtils] 回调缺少sign参数');
      return false;
    }

    // 验签
    return alipayVerify(
      filteredParams as Record<string, unknown>,
      publicKey,
      sign
    );
  } catch (error) {
    logger.error('[AlipayUtils] 验证支付宝回调失败:', error);
    return false;
  }
}

/**
 * 验证支付宝同步返回签名
 */
export function verifyAlipayReturn(
  params: AlipayReturnParams,
  publicKey: string
): boolean {
  try {
    // 使用类型断言处理可能缺失的 sign 字段
    const { sign, ...filteredParams } = params as AlipayReturnParams & {
      sign?: string;
    };

    if (!sign) {
      logger.error('[AlipayUtils] 同步返回缺少sign参数');
      return false;
    }

    // 验签
    return alipayVerify(
      filteredParams as Record<string, unknown>,
      publicKey,
      sign
    );
  } catch (error) {
    logger.error('[AlipayUtils] 验证支付宝返回失败:', error);
    return false;
  }
}

/**
 * 构建支付宝API请求参数
 */
export function buildAlipayRequestParams(
  method: string,
  params: Record<string, unknown>,
  appId: string
): Record<string, string> {
  const timestamp = String(generateTimestamp());

  // 基础参数
  const baseParams: Record<string, string> = {
    app_id: appId,
    method,
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp,
    version: '1.0',
  };

  // 合并请求参数
  const allParams = { ...baseParams, ...params, app_id: appId };

  // 签名
  const privateKey = process.env.ALIPAY_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('支付宝私钥未配置');
  }

  const sign = alipaySign(allParams, privateKey);

  return {
    ...baseParams,
    ...params,
    sign,
  };
}

/**
 * 格式化金额（保留两位小数）
 */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * 解析金额（字符串转数字）
 */
export function parseAmount(amount: string | number): number {
  if (typeof amount === 'number') {
    return amount;
  }
  return parseFloat(amount);
}

/**
 * 判断是否为支付成功状态
 */
export function isPaymentSuccess(tradeStatus: string): boolean {
  return tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED';
}

/**
 * 判断是否为支付失败状态
 */
export function isPaymentFailed(tradeStatus: string): boolean {
  return tradeStatus === 'TRADE_CLOSED';
}

/**
 * 支付宝签名验证（简化版）
 * 用于回调通知签名验证
 */
export function alipaySignVerify(
  params: Record<string, string>,
  sign: string,
  publicKey: string,
  signType: string = 'RSA2'
): boolean {
  try {
    // 移除sign和sign_type参数
    const { sign: _sign, sign_type: _signType, ...filteredParams } = params;
    void _sign;
    void _signType;

    // 参数排序
    const sortedKeys = Object.keys(filteredParams).sort();
    const sortedParams: string[] = [];

    // 过滤空值并拼接
    for (const key of sortedKeys) {
      const value = filteredParams[key];
      if (value !== null && value !== undefined && value !== '') {
        sortedParams.push(`${key}=${String(value)}`);
      }
    }

    // 拼接成字符串
    const signContent = sortedParams.join('&');

    // RSA验签
    const verify = crypto.createVerify(
      signType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1'
    );
    verify.update(signContent, 'utf8');

    return verify.verify(publicKey, sign, 'base64');
  } catch (error) {
    logger.error('[AlipayUtils] 签名验证失败:', error);
    return false;
  }
}
