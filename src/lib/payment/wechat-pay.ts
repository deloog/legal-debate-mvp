/**
 * 微信支付核心模块
 * 实现微信支付V3 API的核心功能
 */

import https from 'https';
import crypto from 'crypto';
import {
  WechatCreateOrderRequest,
  WechatCreateOrderResponse,
  WechatPayNotification,
  WechatPayResult,
  WechatQueryOrderRequest,
  WechatQueryOrderResponse,
  WechatRefundRequest,
  WechatRefundResponse,
} from '@/types/payment';
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
  private config = paymentConfig.getWechatConfig();

  /**
   * 创建支付订单
   */
  public async createOrder(
    request: WechatCreateOrderRequest
  ): Promise<WechatCreateOrderResponse> {
    try {
      const path = '/v3/pay/transactions/native';
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
      const { ciphertext, nonce } = notification.resource;

      const key = Buffer.from(this.config.apiKeyV3, 'base64');
      const iv = Buffer.from(nonce, 'utf8');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(Buffer.from(ciphertext.slice(-32), 'hex'));

      const encrypted = ciphertext.slice(0, -32);
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64')),
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
      console.error('[WechatPay] 签名失败:', error);
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
export const wechatPay = new WechatPay();
