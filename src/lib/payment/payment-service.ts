/**
 * 统一支付服务
 * 提供统一的支付接口，支持支付宝和微信支付
 */

import { PaymentMethod } from '@/types/payment';
import { getAlipay } from './alipay';
import { getAlipayRefund } from './alipay-refund';
import { getWechatPay } from './wechat-pay';
import {
  AlipayCreateOrderRequest,
  AlipayCreateOrderResponse,
  AlipayQueryOrderRequest,
  AlipayQueryOrderResponse,
  WechatCreateOrderRequest,
  WechatCreateOrderResponse,
  WechatQueryOrderRequest,
  WechatQueryOrderResponse,
  AlipayRefundRequest,
  AlipayRefundResponse,
  WechatRefundRequest,
  WechatRefundResponse,
} from '@/types/payment';

/**
 * 支付服务类
 */
export class PaymentService {
  /**
   * 创建支付订单
   */
  public async createOrder(
    paymentMethod: PaymentMethod,
    request: AlipayCreateOrderRequest | WechatCreateOrderRequest
  ): Promise<AlipayCreateOrderResponse | WechatCreateOrderResponse> {
    switch (paymentMethod) {
      case PaymentMethod.ALIPAY:
        return await getAlipay().createOrder(
          request as AlipayCreateOrderRequest
        );
      case PaymentMethod.WECHAT:
        return await getWechatPay().createOrder(
          request as WechatCreateOrderRequest
        );
      default:
        throw new Error(`不支持的支付方式: ${paymentMethod}`);
    }
  }

  /**
   * 查询订单
   */
  public async queryOrder(
    paymentMethod: PaymentMethod,
    request: AlipayQueryOrderRequest | WechatQueryOrderRequest
  ): Promise<AlipayQueryOrderResponse | WechatQueryOrderResponse> {
    switch (paymentMethod) {
      case PaymentMethod.ALIPAY:
        return await getAlipay().queryOrder(request as AlipayQueryOrderRequest);
      case PaymentMethod.WECHAT:
        return await getWechatPay().queryOrder(
          request as WechatQueryOrderRequest
        );
      default:
        throw new Error(`不支持的支付方式: ${paymentMethod}`);
    }
  }

  /**
   * 申请退款
   */
  public async refund(
    paymentMethod: PaymentMethod,
    request: AlipayRefundRequest | WechatRefundRequest
  ): Promise<AlipayRefundResponse | WechatRefundResponse> {
    switch (paymentMethod) {
      case PaymentMethod.ALIPAY:
        return await getAlipayRefund().refund(request as AlipayRefundRequest);
      case PaymentMethod.WECHAT:
        return await getWechatPay().refund(request as WechatRefundRequest);
      default:
        throw new Error(`不支持的支付方式: ${paymentMethod}`);
    }
  }
}

/**
 * 导出支付服务单例
 */
export const paymentService = new PaymentService();
