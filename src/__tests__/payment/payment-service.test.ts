/**
 * 统一支付服务单元测试
 * 测试支付服务的统一接口功能
 */

import { PaymentMethod, AlipayProductCode } from '@/types/payment';
import { PaymentService, paymentService } from '@/lib/payment/payment-service';
import { alipay } from '@/lib/payment/alipay';
import { wechatPay } from '@/lib/payment/wechat-pay';
import { alipayRefund } from '@/lib/payment/alipay-refund';

// Mock支付宝模块
jest.mock('@/lib/payment/alipay', () => ({
  alipay: {
    createOrder: jest.fn(),
    queryOrder: jest.fn(),
  },
}));

// Mock微信支付模块
jest.mock('@/lib/payment/wechat-pay', () => ({
  wechatPay: {
    createOrder: jest.fn(),
    queryOrder: jest.fn(),
    refund: jest.fn(),
  },
}));

// Mock支付宝退款模块
jest.mock('@/lib/payment/alipay-refund', () => ({
  alipayRefund: {
    refund: jest.fn(),
  },
}));

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    service = new PaymentService();
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('应该调用支付宝创建订单', async () => {
      const mockAlipayRequest = {
        outTradeNo: 'TEST123',
        totalAmount: 100.5,
        subject: '测试订单',
        productCode: AlipayProductCode.FAST_INSTANT_TRADE_PAY,
      };

      const mockResponse = {
        code: '10000',
        msg: 'Success',
        outTradeNo: 'TEST123',
        qrCode: 'qr-code-test',
      };

      (alipay.createOrder as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.createOrder(
        PaymentMethod.ALIPAY,
        mockAlipayRequest
      );

      expect(alipay.createOrder).toHaveBeenCalledWith(mockAlipayRequest);
      expect(result).toEqual(mockResponse);
    });

    it('应该调用微信支付创建订单', async () => {
      const mockWechatRequest = {
        outTradeNo: 'TEST456',
        description: '测试订单',
        amount: {
          total: 10050,
          currency: 'CNY',
        },
      };

      const mockResponse = {
        prepay_id: 'wx-prepay-test',
        code_url: 'code-url-test',
      };

      (wechatPay.createOrder as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.createOrder(
        PaymentMethod.WECHAT,
        mockWechatRequest
      );

      expect(wechatPay.createOrder).toHaveBeenCalledWith(mockWechatRequest);
      expect(result).toEqual(mockResponse);
    });

    it('应该拒绝不支持的支付方式', async () => {
      const mockRequest = {
        outTradeNo: 'TEST789',
        totalAmount: 100,
        subject: '测试',
        productCode: AlipayProductCode.FAST_INSTANT_TRADE_PAY,
      };

      await expect(
        service.createOrder(PaymentMethod.BALANCE, mockRequest)
      ).rejects.toThrow('不支持的支付方式: BALANCE');
    });
  });

  describe('queryOrder', () => {
    it('应该调用支付宝查询订单', async () => {
      const mockRequest = {
        outTradeNo: 'TEST123',
      };

      const mockResponse = {
        code: '10000',
        msg: 'Success',
        tradeNo: 'ALIPAY123',
        outTradeNo: 'TEST123',
        totalAmount: '100.50',
        tradeStatus: 'TRADE_SUCCESS' as const,
      };

      (alipay.queryOrder as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.queryOrder(
        PaymentMethod.ALIPAY,
        mockRequest
      );

      expect(alipay.queryOrder).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockResponse);
    });

    it('应该调用微信支付查询订单', async () => {
      const mockRequest = {
        out_trade_no: 'TEST456',
        mchid: 'test-mchid',
      };

      const mockResponse = {
        appid: 'wx-test-appid',
        mchid: 'test-mchid',
        out_trade_no: 'TEST456',
        transaction_id: 'WX123',
        trade_state: 'SUCCESS' as const,
      };

      (wechatPay.queryOrder as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.queryOrder(
        PaymentMethod.WECHAT,
        mockRequest
      );

      expect(wechatPay.queryOrder).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockResponse);
    });

    it('应该拒绝不支持的支付方式', async () => {
      const mockRequest = {
        outTradeNo: 'TEST789',
      };

      await expect(
        service.queryOrder(PaymentMethod.BALANCE, mockRequest)
      ).rejects.toThrow('不支持的支付方式: BALANCE');
    });
  });

  describe('refund', () => {
    it('应该调用支付宝退款', async () => {
      const mockRequest = {
        outTradeNo: 'TEST123',
        refundAmount: 50.0,
        refundReason: '测试退款',
      };

      const mockResponse = {
        code: '10000',
        msg: 'Success',
        refundFee: '50.00',
        outRequestNo: 'REFUND123',
      };

      (alipayRefund.refund as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.refund(PaymentMethod.ALIPAY, mockRequest);
      expect(result).toEqual(mockResponse);
    });

    it('应该调用微信支付退款', async () => {
      const mockRequest = {
        out_trade_no: 'TEST456',
        out_refund_no: 'REFUND456',
        reason: '测试退款',
        amount: {
          refund: 5000,
          total: 10000,
          currency: 'CNY',
        },
      };

      const mockResponse = {
        refund_id: 'WX-REFUND123',
        out_refund_no: 'REFUND456',
      };

      (wechatPay.refund as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.refund(PaymentMethod.WECHAT, mockRequest);

      expect(wechatPay.refund).toHaveBeenCalledWith(mockRequest);
      expect(result).toEqual(mockResponse);
    });

    it('应该拒绝不支持的支付方式', async () => {
      const mockRequest = {
        outTradeNo: 'TEST789',
        refundAmount: 50,
        refundReason: '测试退款',
      };

      await expect(
        service.refund(PaymentMethod.BALANCE, mockRequest)
      ).rejects.toThrow('不支持的支付方式: BALANCE');
    });
  });
});

describe('paymentService单例', () => {
  it('应该导出单例实例', () => {
    expect(paymentService).toBeInstanceOf(PaymentService);
    expect(paymentService).toBe(paymentService);
  });
});
