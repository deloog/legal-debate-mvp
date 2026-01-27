/**
 * 支付宝退款模块
 * 提供支付宝退款功能
 */

import { paymentConfig } from './payment-config';
import { AlipayRefundRequest, AlipayRefundResponse } from '@/types/payment';
import {
  formatAmount,
  generateTimestamp,
  alipaySign,
  paramsToFormData,
  logPayment,
  safeParseJSON,
  generateRefundNo,
} from './alipay-utils';

/**
 * 支付宝退款类
 */
export class AlipayRefund {
  private static instance: AlipayRefund | null = null;
  private config: unknown | null = null;

  private constructor() {
    // 延迟初始化，避免构建时加载配置
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): AlipayRefund {
    if (!AlipayRefund.instance) {
      AlipayRefund.instance = new AlipayRefund();
    }
    return AlipayRefund.instance;
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
   * 申请退款
   */
  public async refund(
    request: AlipayRefundRequest
  ): Promise<AlipayRefundResponse> {
    this.ensureConfig();
    try {
      logPayment('refund', { request });

      // 生成退款请求号
      const outRequestNo = request.outRequestNo || generateRefundNo();

      // 构建请求参数
      const params: Record<string, string> = {
        out_trade_no: request.outTradeNo,
        refund_amount: formatAmount(request.refundAmount),
        out_request_no: outRequestNo,
      };

      // 可选参数
      if (request.refundReason) {
        params.refund_reason = request.refundReason;
      }

      if (request.refundAmountType) {
        params.refund_amount_type = request.refundAmountType;
      }

      // 将业务参数转换为JSON字符串
      const bizContent = JSON.stringify(params);

      // 获取配置
      const config = paymentConfig.getAlipayConfig();

      // 构建完整的API请求参数
      const requestParams: Record<string, string> = {
        app_id: config.appId,
        method: 'alipay.trade.refund',
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
        alipay_trade_refund_response: AlipayRefundResponse;
      }>(response);

      if (!result || !result.alipay_trade_refund_response) {
        throw new Error('解析支付宝响应失败');
      }

      const refundResponse = result.alipay_trade_refund_response;

      logPayment('refundSuccess', {
        outTradeNo: request.outTradeNo,
        outRequestNo,
        response: refundResponse,
      });

      return refundResponse;
    } catch (error) {
      logPayment('refundFailed', { request }, error as Error);
      throw new Error(
        `支付宝退款失败: ${
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
        `发送支付宝退款请求失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 导出支付宝退款实例
 */
/**
 * 获取支付宝退款实例
 * 使用延迟初始化，避免构建时验证环境变量
 */
export const getAlipayRefund = (): AlipayRefund => {
  return AlipayRefund.getInstance();
};
