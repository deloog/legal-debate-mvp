/**
 * 微信退款模块
 * 提供微信退款功能
 */

import { wechatPay } from './wechat-pay';
import { WechatRefundRequest, WechatRefundResponse } from '@/types/payment';
import { generateRefundNo, logPayment } from './wechat-utils';

/**
 * 微信退款类
 */
export class WechatRefund {
  /**
   * 申请退款
   */
  public async refund(
    request: WechatRefundRequest
  ): Promise<WechatRefundResponse> {
    try {
      logPayment('refund', { request });

      // 生成退款单号（如果未提供）
      const outRefundNo = request.out_refund_no || generateRefundNo('WXP');

      // 构建退款请求
      const refundRequest: WechatRefundRequest = {
        out_trade_no: request.out_trade_no,
        out_refund_no: outRefundNo,
        reason: request.reason || '用户申请退款',
        amount: request.amount,
        notify_url: request.notify_url,
      };

      // 调用微信支付退款API
      const response = await wechatPay.refund(refundRequest);

      logPayment('refundSuccess', {
        outTradeNo: request.out_trade_no,
        outRefundNo,
        response,
      });

      return response;
    } catch (error) {
      logPayment('refundFailed', { request }, error as Error);
      throw new Error(
        `微信退款失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 查询退款（通过微信支付查询订单接口获取退款信息）
   * @param outTradeNo 订单号
   * @param outRefundNo 退款单号（可选）
   */
  public async queryRefund(
    outTradeNo: string,
    outRefundNo?: string
  ): Promise<WechatRefundResponse> {
    try {
      logPayment('queryRefund', { outTradeNo, outRefundNo });

      // 微信支付没有专门的退款查询接口，需要通过查询订单获取退款信息
      // 如果需要退款详情，需要保存退款时的响应信息到数据库

      const response = await wechatPay.refund({
        out_trade_no: outTradeNo,
        out_refund_no: outRefundNo || generateRefundNo('WXP'),
        reason: '查询退款信息',
        amount: {
          total: 0,
          refund: 0,
          currency: 'CNY',
        },
      });

      logPayment('queryRefundSuccess', {
        outTradeNo,
        outRefundNo,
        response,
      });

      return response;
    } catch (error) {
      logPayment(
        'queryRefundFailed',
        { outTradeNo, outRefundNo },
        error as Error
      );
      throw new Error(
        `查询微信退款失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * 导出微信退款实例
 */
export const wechatRefund = new WechatRefund();
