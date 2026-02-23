/**
 * 支付宝退款模块单元测试
 * 测试支付宝退款功能的申请和查询
 */

import { AlipayRefund, alipayRefund } from '@/lib/payment/alipay-refund';
import { paymentConfig } from '@/lib/payment/payment-config';
import { AlipayRefundRequest, _AlipayRefundResponse } from '@/types/payment';
import {
  formatAmount,
  generateTimestamp,
  alipaySign,
  paramsToFormData,
  logPayment,
  safeParseJSON,
  generateRefundNo,
} from '@/lib/payment/alipay-utils';

// Mock配置模块
jest.mock('@/lib/payment/payment-config', () => ({
  paymentConfig: {
    getAlipayConfig: jest.fn(),
    getAlipayPrivateKey: jest.fn(),
    isAlipaySandbox: jest.fn(),
  },
}));

// Mock支付宝工具函数
jest.mock('@/lib/payment/alipay-utils', () => ({
  formatAmount: jest.fn((amount: number) => amount.toFixed(2)),
  generateTimestamp: jest.fn(() => Date.now()),
  alipaySign: jest.fn(),
  paramsToFormData: jest.fn(params => new URLSearchParams(params).toString()),
  logPayment: jest.fn(),
  safeParseJSON: jest.fn(),
  generateRefundNo: jest.fn(() => 'REFUND-TEST-123'),
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('AlipayRefund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('申请退款', () => {
    it('应该成功申请退款', async () => {
      const mockRequest: AlipayRefundRequest = {
        outTradeNo: 'TEST123',
        refundAmount: 50.5,
        refundReason: '测试退款',
      };

      const mockConfig = {
        appId: 'test-app-id',
        merchantId: 'test-merchant-id',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
        environment: 'production' as const,
      };

      (paymentConfig.getAlipayConfig as jest.Mock).mockReturnValue(mockConfig);
      (paymentConfig.getAlipayPrivateKey as jest.Mock).mockReturnValue(
        mockConfig.privateKey
      );
      (paymentConfig.isAlipaySandbox as jest.Mock).mockReturnValue(false);
      (generateRefundNo as jest.Mock).mockReturnValue('REFUND-TEST-123');
      (formatAmount as jest.Mock).mockReturnValue('50.50');
      (alipaySign as jest.Mock).mockReturnValue('test-sign');
      (paramsToFormData as jest.Mock).mockReturnValue('form-data=test');

      const mockResponseData = {
        code: '10000',
        msg: 'Success',
        out_trade_no: 'TEST123',
        refund_fee: '50.50',
        out_request_no: 'REFUND-TEST-123',
      };

      const mockResponse = JSON.stringify({
        alipay_trade_refund_response: mockResponseData,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => mockResponse,
      });

      (safeParseJSON as jest.Mock).mockReturnValue({
        alipay_trade_refund_response: mockResponseData,
      });

      const result = await alipayRefund.refund(mockRequest);

      expect(result).toEqual(mockResponseData);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openapi.alipay.com/gateway.do',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
      expect(logPayment).toHaveBeenCalledWith(
        'refundSuccess',
        expect.objectContaining({
          outTradeNo: 'TEST123',
        })
      );
    });

    it('应该在沙箱环境下使用沙箱URL', async () => {
      const mockRequest: AlipayRefundRequest = {
        outTradeNo: 'TEST456',
        refundAmount: 25.0,
      };

      const mockConfig = {
        appId: 'test-app-id',
        merchantId: 'test-merchant-id',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
        environment: 'sandbox' as const,
      };

      (paymentConfig.getAlipayConfig as jest.Mock).mockReturnValue(mockConfig);
      (paymentConfig.getAlipayPrivateKey as jest.Mock).mockReturnValue(
        mockConfig.privateKey
      );
      (paymentConfig.isAlipaySandbox as jest.Mock).mockReturnValue(true);
      (generateRefundNo as jest.Mock).mockReturnValue('REFUND-TEST-456');
      (formatAmount as jest.Mock).mockReturnValue('25.00');
      (alipaySign as jest.Mock).mockReturnValue('test-sign');
      (paramsToFormData as jest.Mock).mockReturnValue('form-data=test');

      const mockResponseData = {
        code: '10000',
        msg: 'Success',
        out_trade_no: 'TEST456',
        refund_fee: '25.00',
        out_request_no: 'REFUND-TEST-456',
      };

      const mockResponse = JSON.stringify({
        alipay_trade_refund_response: mockResponseData,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => mockResponse,
      });

      (safeParseJSON as jest.Mock).mockReturnValue({
        alipay_trade_refund_response: mockResponseData,
      });

      await alipayRefund.refund(mockRequest);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://openapi.alipaydev.com/gateway.do',
        expect.any(Object)
      );
    });

    it('应该使用自定义退款请求号', async () => {
      const mockRequest: AlipayRefundRequest = {
        outTradeNo: 'TEST789',
        refundAmount: 100.0,
        outRequestNo: 'CUSTOM-REFUND-123',
      };

      const mockConfig = {
        appId: 'test-app-id',
        merchantId: 'test-merchant-id',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
        environment: 'production' as const,
      };

      (paymentConfig.getAlipayConfig as jest.Mock).mockReturnValue(mockConfig);
      (paymentConfig.getAlipayPrivateKey as jest.Mock).mockReturnValue(
        mockConfig.privateKey
      );
      (paymentConfig.isAlipaySandbox as jest.Mock).mockReturnValue(false);
      (formatAmount as jest.Mock).mockReturnValue('100.00');
      (alipaySign as jest.Mock).mockReturnValue('test-sign');
      (paramsToFormData as jest.Mock).mockReturnValue('form-data=test');

      const mockResponseData = {
        code: '10000',
        msg: 'Success',
        outTradeNo: 'TEST789',
        refundAmount: '100.00',
        outRequestNo: 'CUSTOM-REFUND-123',
      };

      const mockResponse = JSON.stringify({
        alipay_trade_refund_response: mockResponseData,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => mockResponse,
      });

      (safeParseJSON as jest.Mock).mockReturnValue({
        alipay_trade_refund_response: mockResponseData,
      });

      const result = await alipayRefund.refund(mockRequest);

      expect(result.outRequestNo).toBe('CUSTOM-REFUND-123');
    });

    it('应该处理退款失败', async () => {
      const mockRequest: AlipayRefundRequest = {
        outTradeNo: 'FAIL123',
        refundAmount: 10.0,
      };

      const mockConfig = {
        appId: 'test-app-id',
        merchantId: 'test-merchant-id',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
        environment: 'production' as const,
      };

      (paymentConfig.getAlipayConfig as jest.Mock).mockReturnValue(mockConfig);
      (paymentConfig.getAlipayPrivateKey as jest.Mock).mockReturnValue(
        mockConfig.privateKey
      );
      (paymentConfig.isAlipaySandbox as jest.Mock).mockReturnValue(false);
      (formatAmount as jest.Mock).mockReturnValue('10.00');
      (alipaySign as jest.Mock).mockReturnValue('test-sign');
      (paramsToFormData as jest.Mock).mockReturnValue('form-data=test');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(alipayRefund.refund(mockRequest)).rejects.toThrow(
        '支付宝退款失败'
      );
    });

    it('应该处理解析响应失败', async () => {
      const mockRequest: AlipayRefundRequest = {
        outTradeNo: 'JSON123',
        refundAmount: 15.0,
      };

      const mockConfig = {
        appId: 'test-app-id',
        merchantId: 'test-merchant-id',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
        notifyUrl: 'https://example.com/notify',
        returnUrl: 'https://example.com/return',
        environment: 'production' as const,
      };

      (paymentConfig.getAlipayConfig as jest.Mock).mockReturnValue(mockConfig);
      (paymentConfig.getAlipayPrivateKey as jest.Mock).mockReturnValue(
        mockConfig.privateKey
      );
      (paymentConfig.isAlipaySandbox as jest.Mock).mockReturnValue(false);
      (formatAmount as jest.Mock).mockReturnValue('15.00');
      (alipaySign as jest.Mock).mockReturnValue('test-sign');
      (paramsToFormData as jest.Mock).mockReturnValue('form-data=test');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => 'invalid json',
      });

      (safeParseJSON as jest.Mock).mockReturnValue(null);

      await expect(alipayRefund.refund(mockRequest)).rejects.toThrow(
        '解析支付宝响应失败'
      );
    });
  });

  describe('导出实例', () => {
    it('应该导出alipayRefund实例', () => {
      expect(alipayRefund).toBeInstanceOf(AlipayRefund);
    });
  });
});
