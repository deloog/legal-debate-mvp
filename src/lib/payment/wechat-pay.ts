/**
 * 微信支付核心模块
 * 实现微信支付V3 API的核心功能
 */

import { logger } from '@/lib/logger';
import {
  WechatCreateOrderRequest,
  WechatCreateOrderResponse,
  WechatPayConfig,
  WechatPayNotification,
  WechatPayResult,
  WechatQueryOrderRequest,
  WechatQueryOrderResponse,
  WechatRefundRequest,
  WechatRefundResponse,
} from '@/types/payment';
import crypto from 'crypto';
import https from 'https';
import { paymentConfig } from './payment-config';
import {
  generateNonceStr,
  generateTimestamp,
  logPayment,
  safeParseJSON,
  safeStringifyJSON,
} from './wechat-utils';

/**
 * 微信支付API基础URL
 */
const WECHAT_PAY_API = 'api.mch.weixin.qq.com';

/**
 * 微信支付类
 */
export class WechatPay {
  private static instance: WechatPay | null = null;
  private config: WechatPayConfig | null = null;

  private constructor() {
    // 延迟初始化，避免构建时加载配置
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): WechatPay {
    if (!WechatPay.instance) {
      WechatPay.instance = new WechatPay();
    }
    return WechatPay.instance;
  }

  /**
   * 确保配置已加载
   */
  private ensureConfig(): void {
    if (!this.config) {
      this.config = paymentConfig.getWechatConfig();
    }
  }

  /**
   * 创建支付订单
   */
  public async createOrder(
    request: WechatCreateOrderRequest
  ): Promise<WechatCreateOrderResponse> {
    this.ensureConfig();
    try {
      const path = '/v3/pay/transactions/native';
      const method = 'POST';
      const timestamp = generateTimestamp();
      const nonceStr = generateNonceStr();

      // 构建符合微信支付V3规范的请求体：appid/mchid/notify_url 必须在请求体顶层
      const wechatBody: Record<string, unknown> = {
        appid: this.config!.appId,
        mchid: this.config!.mchId,
        description: request.description,
        out_trade_no: request.outTradeNo,
        notify_url: this.config!.notifyUrl,
        amount: request.amount,
      };
      if (request.attach) wechatBody.attach = request.attach;
      if (request.time_expire) wechatBody.time_expire = request.time_expire;
      if (request.payer) wechatBody.payer = request.payer;
      if (request.detail) wechatBody.detail = request.detail;
      if (request.scene_info) wechatBody.scene_info = request.scene_info;
      if (request.settle_info) wechatBody.settle_info = request.settle_info;
      const body = safeStringifyJSON(wechatBody);

      const authorization = this.generateAuthorization(
        method,
        path,
        timestamp,
        nonceStr,
        body
      );

      const response = await this.request({
        hostname: WECHAT_PAY_API,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authorization,
        },
        body,
      });

      const result = safeParseJSON<WechatCreateOrderResponse>(response);
      if (!result) {
        throw new Error('解析微信支付响应失败');
      }

      logPayment('createOrder', {
        outTradeNo: request.outTradeNo,
        amount: request.amount.total,
        response: result,
      });

      return result;
    } catch (error) {
      logPayment('createOrder', { request }, error as Error);
      throw error;
    }
  }

  /**
   * 查询订单
   */
  public async queryOrder(
    request: WechatQueryOrderRequest
  ): Promise<WechatQueryOrderResponse> {
    this.ensureConfig();
    try {
      const outTradeNo = request.out_trade_no;
      const transactionId = request.transaction_id;
      const mchid = request.mchid;

      if (!outTradeNo && !transactionId) {
        throw new Error('必须提供out_trade_no或transaction_id');
      }

      const query = outTradeNo
        ? `out_trade_no=${outTradeNo}&mchid=${mchid}`
        : `transaction_id=${transactionId}&mchid=${mchid}`;

      const path = `/v3/pay/transactions/${outTradeNo || transactionId}?${query}`;
      const method = 'GET';
      const timestamp = generateTimestamp();
      const nonceStr = generateNonceStr();

      const authorization = this.generateAuthorization(
        method,
        path,
        timestamp,
        nonceStr,
        ''
      );

      const response = await this.request({
        hostname: WECHAT_PAY_API,
        path,
        method,
        headers: {
          Accept: 'application/json',
          Authorization: authorization,
        },
      });

      const result = safeParseJSON<WechatQueryOrderResponse>(response);
      if (!result) {
        throw new Error('解析微信支付查询响应失败');
      }

      logPayment('queryOrder', {
        outTradeNo,
        transactionId,
        response: result,
      });

      return result;
    } catch (error) {
      logPayment('queryOrder', { request }, error as Error);
      throw error;
    }
  }

  /**
   * 申请退款
   */
  public async refund(
    request: WechatRefundRequest
  ): Promise<WechatRefundResponse> {
    this.ensureConfig();
    try {
      const path = '/v3/refund/domestic/refunds';
      const method = 'POST';
      const timestamp = generateTimestamp();
      const nonceStr = generateNonceStr();
      const body = safeStringifyJSON(request);

      const authorization = this.generateAuthorization(
        method,
        path,
        timestamp,
        nonceStr,
        body
      );

      const response = await this.request({
        hostname: WECHAT_PAY_API,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authorization,
        },
        body,
      });

      const result = safeParseJSON<WechatRefundResponse>(response);
      if (!result) {
        throw new Error('解析微信支付退款响应失败');
      }

      logPayment('refund', {
        outRefundNo: request.out_refund_no,
        amount: request.amount.refund,
        response: result,
      });

      return result;
    } catch (error) {
      logPayment('refund', { request }, error as Error);
      throw error;
    }
  }

  /**
   * 解密回调通知
   */
  public decryptNotification(
    notification: WechatPayNotification
  ): WechatPayResult | null {
    try {
      this.ensureConfig();
      if (!this.config) {
        return null;
      }

      const { ciphertext, nonce, associated_data } = notification.resource;

      // apiKeyV3 是 32 字节 ASCII 字符串（非 Base64），微信文档明确说明
      const key = Buffer.from(this.config.apiKeyV3, 'utf8');
      const iv = Buffer.from(nonce, 'utf8');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

      // AES-GCM 需要设置 associated_data 才能正确验证 tag
      if (associated_data) {
        decipher.setAAD(Buffer.from(associated_data, 'utf8'));
      }

      // 微信规范：ciphertext 是 Base64，最后 16 字节（Base64 解码后）是 auth tag
      const ciphertextBuf = Buffer.from(ciphertext, 'base64');
      const authTag = ciphertextBuf.slice(-16);
      const encrypted = ciphertextBuf.slice(0, -16);

      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      const resultStr = decrypted.toString('utf8');
      const result = safeParseJSON<WechatPayResult>(resultStr);

      logPayment('decryptNotification', {
        eventType: notification.event_type,
        result,
      });

      return result;
    } catch (error) {
      logPayment('decryptNotification', { notification }, error as Error);
      return null;
    }
  }

  /**
   * 生成授权头
   */
  private generateAuthorization(
    method: string,
    path: string,
    timestamp: number,
    nonceStr: string,
    body: string
  ): string {
    this.ensureConfig();
    if (!this.config) {
      throw new Error('微信支付配置未初始化');
    }

    const schema = 'WECHATPAY2-SHA256-RSA2048';
    const nonce = nonceStr;
    const timestampStr = String(timestamp);
    const bodyStr = body;

    const message = `${method}\n${path}\n${timestampStr}\n${nonce}\n${bodyStr}\n`;
    const signature = this.signMessage(message);

    return `${schema} mchid="${this.config.mchId}",nonce_str="${nonce}",timestamp="${timestampStr}",serial_no="${this.config.certSerialNo}",signature="${signature}"`;
  }

  /**
   * 签名消息
   */
  private signMessage(message: string): string {
    try {
      // 获取私钥内容
      const privateKey = paymentConfig.getWechatPrivateKey();

      // 使用SHA256和RSA2048进行签名
      const sign = crypto.createSign('SHA256');
      sign.update(message);
      sign.end();

      const signature = sign.sign(privateKey, 'base64');

      return signature;
    } catch (error) {
      logger.error('[WechatPay] 签名失败:', error);
      throw new Error(
        `签名失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 发送HTTPS请求
   */
  private request(options: {
    hostname: string;
    path: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          ...options,
        },
        res => {
          let data = '';
          res.on('data', chunk => {
            data += chunk;
          });
          res.on('end', () => {
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          });
        }
      );

      req.on('error', error => {
        reject(error);
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }
}

// 导出单例
/**
 * 获取微信支付实例
 * 使用延迟初始化，避免构建时验证环境变量
 */
export const getWechatPay = (): WechatPay => {
  return WechatPay.getInstance();
};

/**
 * 微信支付单例实例
 */
export const wechatPay = WechatPay.getInstance();
