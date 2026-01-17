/**
 * 微信退款模块单元测试
 */

import { WechatRefund } from '@/lib/payment/wechat-refund';
import { WechatRefundRequest } from '@/types/payment';

// Mock wechatPay
jest.mock('@/lib/payment/wechat-pay', () => ({
  wechatPay: {
    refund: jest.fn(),
  },
}));

import { wechatPay } from '@/lib/payment/wechat-pay';

describe('WechatRefund', () => {
  let wechatRefund: WechatRefund;

  beforeEach(() => {
    wechatRefund = new WechatRefund();
    jest.clearAllMocks();
  });

  describe('refund', () => {
    it('应该成功申请微信退款', async () => {
      // Arrange
      const request: WechatRefundRequest = {
        out_trade_no: 'ORD2025011612345678ABCDEF',
        out_refund_no: 'REF1234567890ABC',
        reason: '用户申请退款',
        amount: {
          total: 10000,
          refund: 10000,
          currency: 'CNY',
        },
        notify_url: 'https://example.com/refund/notify',
      };

      const mockResponse = {
        refund_id: '50000006822024012300001',
        out_refund_no: 'REF1234567890ABC',
        transaction_id: '4200001234567890',
        out_trade_no: 'ORD2025011612345678ABCDEF',
        channel: 'ORIGINAL',
        user_received_account: '招商银行信用卡0403',
        success_time: '2025-01-16T12:00:00+08:00',
        amount: {
          total: 10000,
          refund: 10000,
          payer_total: 10000,
          settlement_refund: 10000,
          settlement_total: 10000,
          currency: 'CNY',
        },
      };

      (wechatPay.refund as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await wechatRefund.refund(
        request as unknown as WechatRefundRequest
      );

      // Assert
      expect(result).toEqual(mockResponse);
      expect(wechatPay.refund).toHaveBeenCalledTimes(1);
      expect(wechatPay.refund).toHaveBeenCalledWith(
        expect.objectContaining({
          out_trade_no: request.out_trade_no,
          out_refund_no: request.out_refund_no,
          reason: request.reason,
          amount: request.amount,
          notify_url: request.notify_url,
        })
      );
    });

    it('应该自动生成退款单号', async () => {
      // Arrange
      const request: Partial<WechatRefundRequest> = {
        out_trade_no: 'ORD2025011612345678ABCDEF',
        out_refund_no: undefined,
        reason: '系统错误',
        amount: {
          total: 10000,
          refund: 10000,
          currency: 'CNY',
        },
      };

      const mockResponse = {
        refund_id: '50000006822024012300002',
        out_refund_no: expect.any(String),
        transaction_id: '4200001234567891',
        out_trade_no: 'ORD2025011612345678ABCDEF',
        channel: 'ORIGINAL',
        user_received_account: '招商银行信用卡0403',
        success_time: '2025-01-16T12:00:00+08:00',
        amount: {
          total: 10000,
          refund: 10000,
          payer_total: 10000,
          settlement_refund: 10000,
          settlement_total: 10000,
          currency: 'CNY',
        },
      };

      (wechatPay.refund as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await wechatRefund.refund(
        request as unknown as WechatRefundRequest
      );

      // Assert
      expect(result).toBeDefined();
      expect(wechatPay.refund).toHaveBeenCalledTimes(1);
      expect(wechatPay.refund).toHaveBeenCalledWith(
        expect.objectContaining({
          out_trade_no: request.out_trade_no,
          out_refund_no: expect.any(String),
          reason: request.reason,
          amount: request.amount,
        })
      );
    });

    it('应该使用默认退款原因', async () => {
      // Arrange
      const request: Partial<WechatRefundRequest> = {
        out_trade_no: 'ORD2025011612345678ABCDEF',
        amount: {
          total: 10000,
          refund: 10000,
          currency: 'CNY',
        },
      };

      const mockResponse = {
        refund_id: '50000006822024012300003',
        out_refund_no: 'REF9876543210XYZ',
        transaction_id: '4200001234567892',
        out_trade_no: 'ORD2025011612345678ABCDEF',
        channel: 'ORIGINAL',
        user_received_account: '招商银行信用卡0403',
        success_time: '2025-01-16T12:00:00+08:00',
        amount: {
          total: 10000,
          refund: 10000,
          payer_total: 10000,
          settlement_refund: 10000,
          settlement_total: 10000,
          currency: 'CNY',
        },
      };

      (wechatPay.refund as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await wechatRefund.refund(
        request as unknown as WechatRefundRequest
      );

      // Assert
      expect(result).toBeDefined();
      expect(wechatPay.refund).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: '用户申请退款',
        })
      );
    });

    it('应该处理退款失败', async () => {
      // Arrange
      const request: Partial<WechatRefundRequest> = {
        out_trade_no: 'ORD2025011612345678ABCDEF',
        amount: {
          total: 10000,
          refund: 10000,
          currency: 'CNY',
        },
      };

      const mockError = new Error('微信退款API调用失败');
      (wechatPay.refund as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        wechatRefund.refund(request as unknown as WechatRefundRequest)
      ).rejects.toThrow('微信退款失败: 微信退款API调用失败');
    });
  });

  describe('queryRefund', () => {
    it('应该成功查询退款信息', async () => {
      // Arrange
      const outTradeNo = 'ORD2025011612345678ABCDEF';
      const outRefundNo = 'REF1234567890ABC';

      const mockResponse = {
        refund_id: '50000006822024012300004',
        out_refund_no: outRefundNo,
        transaction_id: '4200001234567893',
        out_trade_no: outTradeNo,
        channel: 'ORIGINAL',
        user_received_account: '招商银行信用卡0403',
        success_time: '2025-01-16T12:00:00+08:00',
        amount: {
          total: 10000,
          refund: 10000,
          payer_total: 10000,
          settlement_refund: 10000,
          settlement_total: 10000,
          currency: 'CNY',
        },
      };

      (wechatPay.refund as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await wechatRefund.queryRefund(outTradeNo, outRefundNo);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(wechatPay.refund).toHaveBeenCalledTimes(1);
    });

    it('应该自动生成退款单号进行查询', async () => {
      // Arrange
      const outTradeNo = 'ORD2025011612345678ABCDEF';

      const mockResponse = {
        refund_id: '50000006822024012300005',
        out_refund_no: expect.any(String),
        transaction_id: '4200001234567894',
        out_trade_no: outTradeNo,
        channel: 'ORIGINAL',
        user_received_account: '招商银行信用卡0403',
        success_time: '2025-01-16T12:00:00+08:00',
        amount: {
          total: 0,
          refund: 0,
          payer_total: 0,
          settlement_refund: 0,
          settlement_total: 0,
          currency: 'CNY',
        },
      };

      (wechatPay.refund as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await wechatRefund.queryRefund(outTradeNo);

      // Assert
      expect(result).toBeDefined();
      expect(wechatPay.refund).toHaveBeenCalledWith(
        expect.objectContaining({
          out_trade_no: outTradeNo,
          out_refund_no: expect.any(String),
        })
      );
    });

    it('应该处理查询失败', async () => {
      // Arrange
      const outTradeNo = 'ORD2025011612345678ABCDEF';
      const mockError = new Error('微信查询退款API调用失败');
      (wechatPay.refund as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(wechatRefund.queryRefund(outTradeNo)).rejects.toThrow(
        '查询微信退款失败: 微信查询退款API调用失败'
      );
    });
  });
});
