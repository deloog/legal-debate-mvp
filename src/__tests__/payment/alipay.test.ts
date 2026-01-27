/**
 * 支付宝支付核心模块单元测试（第一部分）
 * 测试支付宝支付的创建订单、查询订单功能
 */

import { alipay, AlipayPayment } from '@/lib/payment/alipay';
import { paymentConfig } from '@/lib/payment/payment-config';
import {
  AlipayCreateOrderRequest,
  AlipayQueryOrderRequest,
  AlipayProductCode,
} from '@/types/payment';
import {
  formatAmount,
  generateTimestamp,
  alipaySign,
  paramsToFormData,
  logPayment,
  safeParseJSON,
} from '@/lib/payment/alipay-utils';

// Mock配置模块
jest.mock('@/lib/payment/payment-config', () => ({
  paymentConfig: {
    getAlipayConfig: jest.fn(),
    getAlipayPrivateKey: jest.fn(),
    getAlipayPublicKey: jest.fn(),
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
}));

// Mock fetch
global.fetch = jest.fn();

describe('AlipayPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('创建支付订单', () => {
    it('应该成功创建支付宝订单', async () => {
      const mockRequest: AlipayCreateOrderRequest = {
        outTradeNo: 'TEST123',
        totalAmount: 100.5,
        subject: '测试订单',
        productCode: AlipayProductCode.FAST_INSTANT_TRADE_PAY,
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
      (paymentConfig.getAlipayPublicKey as jest.Mock).mockReturnValue(
        mockConfig.publicKey
      );
      (paymentConfig.getAlipayPrivateKey as jest.Mock).mockReturnValue(
        mockConfig.privateKey
      );
      (paymentConfig.isAlipaySandbox as jest.Mock).mockReturnValue(false);

      const alipayPayment = alipay;
      const mockResponse = {
        alipay_trade_precreate_response: {
          code: '10000',
          msg: 'Success',
          out_trade_no: 'TEST123',
          qr_code: 'qr-code-test',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      (safeParseJSON as jest.Mock).mockReturnValue(mockResponse);

      const result = await alipayPayment.createOrder(mockRequest);

      expect(result).toEqual(mockResponse.alipay_trade_precreate_response);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('应该处理订单创建失败', async () => {
      const request: AlipayCreateOrderRequest = {
        outTradeNo: 'TEST456',
        totalAmount: 50.0,
        subject: '测试订单',
        productCode: AlipayProductCode.FAST_INSTANT_TRADE_PAY,
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

      const alipayPayment = alipay;
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => 'invalid json',
      });

      (safeParseJSON as jest.Mock).mockReturnValue(null);

      await expect(alipayPayment.createOrder(request)).rejects.toThrow(
        '解析支付宝响应失败'
      );
    });
  });

  describe('查询订单', () => {
    it('应该通过outTradeNo查询订单', async () => {
      const mockRequest: AlipayQueryOrderRequest = {
        outTradeNo: 'TEST123',
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

      const alipayPayment = alipay;
      const mockResponse = {
        alipay_trade_query_response: {
          code: '10000',
          msg: 'Success',
          trade_no: 'ALIPAY123',
          out_trade_no: 'TEST123',
          total_amount: '100.50',
          trade_status: 'TRADE_SUCCESS',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      (safeParseJSON as jest.Mock).mockReturnValue(mockResponse);

      const result = await alipayPayment.queryOrder(mockRequest);

      expect(result).toEqual(mockResponse.alipay_trade_query_response);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('应该通过tradeNo查询订单', async () => {
      const mockRequest: AlipayQueryOrderRequest = {
        tradeNo: 'ALIPAY123',
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

      const alipayPayment = alipay;
      const mockResponse = {
        alipay_trade_query_response: {
          code: '10000',
          msg: 'Success',
          trade_no: 'ALIPAY123',
          out_trade_no: 'TEST123',
          total_amount: '100.50',
          trade_status: 'TRADE_SUCCESS',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      (safeParseJSON as jest.Mock).mockReturnValue(mockResponse);

      const result = await alipayPayment.queryOrder(mockRequest);

      expect(result).toEqual(mockResponse.alipay_trade_query_response);
    });

    it('应该拒绝缺少参数的查询请求', async () => {
      const mockRequest: AlipayQueryOrderRequest = {};

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

      const alipayPayment = alipay;

      await expect(alipayPayment.queryOrder(mockRequest)).rejects.toThrow(
        '必须提供out_trade_no或trade_no参数'
      );
    });
  });
});
