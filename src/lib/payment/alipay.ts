/**
 * 支付宝支付核心模块
 * 提供支付宝支付的创建订单、查询订单、处理回调等核心功能
 */

import { paymentConfig } from './payment-config';
import {
  AlipayConfig,
  AlipayCreateOrderRequest,
  AlipayCreateOrderResponse,
  AlipayQueryOrderRequest,
  AlipayQueryOrderResponse,
} from '@/types/payment';
import {
  formatAmount,
  generateTimestamp,
  alipaySign,
  paramsToFormData,
  logPayment,
  safeParseJSON,
} from './alipay-utils';

/**
 * 支付宝支付类
 */
export class AlipayPayment {
  private static instance: AlipayPayment | null = null;
  private config: AlipayConfig | null = null;

  private constructor() {
    // 延迟初始化，避免构建时加载配置
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): AlipayPayment {
    if (!AlipayPayment.instance) {
      AlipayPayment.instance = new AlipayPayment();
    }
    return AlipayPayment.instance;
  }

  /**
   * 确保配置已加载
   */
  private ensureConfig(): void {
    if (!this.config) {
      this.config = paymentConfig.getAlipayConfig();
    }
  }

  /**
   * 获取支付宝API URL
   */
  private getApiUrl(): string {
    const isSandbox = paymentConfig.isAlipaySandbox();
    return isSandbox
      ? 'https://openapi.alipaydev.com/gateway.do'
      : 'https://openapi.alipay.com/gateway.do';
  }

  /**
   * 获取应用私钥
   */
  private getPrivateKey(): string {
    return paymentConfig.getAlipayPrivateKey();
  }

  /**
   * 获取支付宝公钥
   */
  private __getPublicKey(): string {
    return paymentConfig.getAlipayPublicKey();
  }

  /**
   * 创建支付订单
   */
  public async createOrder(
    request: AlipayCreateOrderRequest
  ): Promise<AlipayCreateOrderResponse> {
    this.ensureConfig();
    try {
      logPayment('createOrder', { request });

      // 构建请求参数
      const params: Record<string, string> = {
        out_trade_no: request.outTradeNo,
        total_amount: formatAmount(request.totalAmount),
        subject: request.subject,
        product_code: request.productCode,
      };

      // 可选参数
      if (request.body) {
        params.body = request.body;
      }

      if (request.timeExpire) {
        const expireDate = new Date(
          Date.now() + request.timeExpire * 60 * 1000
        );
        params.time_expire = expireDate.toISOString().replace(/\.\d+Z$/, 'Z');
      }

      if (request.goodsType) {
        params.goods_type = request.goodsType;
      }

      // 将业务参数转换为JSON字符串
      const bizContent = JSON.stringify(params);

      // 构建完整的API请求参数
      const requestParams: Record<string, string> = {
        app_id: this.config!.appId,
        method: 'alipay.trade.precreate',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: generateTimestamp().toString(),
        version: '1.0',
        biz_content: bizContent,
      };

      // 签名
      const sign = alipaySign(requestParams, this.getPrivateKey());
      requestParams.sign = sign;

      // 发送请求
      const response = await this.postRequest(this.getApiUrl(), requestParams);
      const result = safeParseJSON<{
        alipay_trade_precreate_response: AlipayCreateOrderResponse;
      }>(response);

      if (!result || !result.alipay_trade_precreate_response) {
        throw new Error('解析支付宝响应失败');
      }

      const precreateResponse = result.alipay_trade_precreate_response;

      logPayment('createOrderSuccess', {
        outTradeNo: request.outTradeNo,
        response: precreateResponse,
      });

      return precreateResponse;
    } catch (error) {
      logPayment('createOrderFailed', { request }, error as Error);
      throw new Error(
        `创建支付宝订单失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 查询订单
   */
  public async queryOrder(
    request: AlipayQueryOrderRequest
  ): Promise<AlipayQueryOrderResponse> {
    this.ensureConfig();
    try {
      logPayment('queryOrder', { request });

      // 构建请求参数
      const params: Record<string, string> = {};

      if (request.outTradeNo) {
        params.out_trade_no = request.outTradeNo;
      } else if (request.tradeNo) {
        params.trade_no = request.tradeNo;
      } else {
        throw new Error('必须提供out_trade_no或trade_no参数');
      }

      // 将业务参数转换为JSON字符串
      const bizContent = JSON.stringify(params);

      // 构建完整的API请求参数
      const requestParams: Record<string, string> = {
        app_id: this.config!.appId,
        method: 'alipay.trade.query',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: generateTimestamp().toString(),
        version: '1.0',
        biz_content: bizContent,
      };

      // 签名
      const sign = alipaySign(requestParams, this.getPrivateKey());
      requestParams.sign = sign;

      // 发送请求
      const response = await this.postRequest(this.getApiUrl(), requestParams);
      const result = safeParseJSON<{
        alipay_trade_query_response: AlipayQueryOrderResponse;
      }>(response);

      if (!result || !result.alipay_trade_query_response) {
        throw new Error('解析支付宝响应失败');
      }

      const queryResponse = result.alipay_trade_query_response;

      logPayment('queryOrderSuccess', {
        request,
        response: queryResponse,
      });

      return queryResponse;
    } catch (error) {
      logPayment('queryOrderFailed', { request }, error as Error);
      throw new Error(
        `查询支付宝订单失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 发送POST请求
   */
  private async postRequest(
    url: string,
    params: Record<string, string>
  ): Promise<string> {
    try {
      const formData = paramsToFormData(params);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP请求失败: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      throw new Error(
        `发送支付宝请求失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 获取支付宝支付实例
 * 使用延迟初始化，避免构建时验证环境变量
 */
export const getAlipay = (): AlipayPayment => {
  return AlipayPayment.getInstance();
};

/**
 * 支付宝支付单例实例
 */
export const alipay = AlipayPayment.getInstance();
