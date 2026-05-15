/**
 * 退款申请API单元测试
 * POST /api/refunds/apply
 */

import { POST } from '@/app/api/refunds/apply/route';
import { NextRequest } from 'next/server';
import { PaymentMethod, RefundReason, RefundStatus } from '@/types/payment';
import { getAuthUser } from '@/lib/middleware/auth';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    refundRecord: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

// Mock payment modules
jest.mock('@/lib/payment/alipay-refund', () => {
  const mockAlipay = { refund: jest.fn() };
  return {
    alipayRefund: mockAlipay,
    getAlipayRefund: jest.fn().mockReturnValue(mockAlipay),
  };
});

jest.mock('@/lib/payment/wechat-refund', () => {
  const mockWechat = { refund: jest.fn() };
  return {
    wechatRefund: mockWechat,
    getWechatRefund: jest.fn().mockReturnValue(mockWechat),
  };
});

jest.mock('@/lib/payment/payment-config', () => ({
  paymentConfig: {
    getWechatConfig: jest.fn(),
    validateWechatConfig: jest.fn(),
    validateAlipayConfig: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';
import { alipayRefund } from '@/lib/payment/alipay-refund';
import { wechatRefund } from '@/lib/payment/wechat-refund';
import { paymentConfig } from '@/lib/payment/payment-config';

describe('POST /api/refunds/apply', () => {
  let mockRequest: NextRequest;
  let mockGetAuthUser: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser = getAuthUser as jest.Mock;
    mockGetAuthUser.mockResolvedValue({ userId: 'user-123' });
    (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
      const tx = {
        refundRecord: {
          update: prisma.refundRecord.update,
        },
        order: {
          update: prisma.order.update,
        },
      };
      return callback(tx);
    });
    mockRequest = {
      json: async () => ({}),
    } as unknown as NextRequest;
  });

  describe('授权和验证', () => {
    it('应该拒绝未授权的请求', async () => {
      // Arrange
      mockGetAuthUser.mockResolvedValue(null);
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
        }),
      } as unknown as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('未授权');
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('应该拒绝缺少订单ID的请求', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({ reason: RefundReason.USER_REQUEST }),
      } as unknown as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('MISSING_ORDER_ID');
    });

    it('应该拒绝无效的退款原因', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({ orderId: 'order-123', reason: 'INVALID_REASON' }),
      } as unknown as NextRequest;

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_REFUND_REASON');
    });
  });

  describe('订单验证', () => {
    it('应该拒绝不存在的订单', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('ORDER_NOT_FOUND');
    });

    it('应该拒绝不属于用户的订单', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-123',
        userId: 'user-456',
        status: 'PAID',
        paymentMethod: PaymentMethod.WECHAT,
        orderNo: 'ORD123',
        amount: '99.00',
        currency: 'CNY',
        paymentRecords: [{ id: 'pay-123' }],
      });

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('FORBIDDEN');
    });

    it('应该拒绝未支付的订单', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: 'PENDING',
        paymentMethod: PaymentMethod.WECHAT,
        orderNo: 'ORD123',
        amount: '99.00',
        currency: 'CNY',
        paymentRecords: [{ id: 'pay-123' }],
      });

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_ORDER_STATUS');
    });
  });

  describe('重复退款检查', () => {
    it('应该拒绝已存在退款记录的订单', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: 'PAID',
        paymentMethod: PaymentMethod.WECHAT,
        orderNo: 'ORD123',
        amount: '99.00',
        currency: 'CNY',
        paymentRecords: [{ id: 'pay-123' }],
      });
      (prisma.refundRecord.findFirst as jest.Mock).mockResolvedValue({
        id: 'refund-123',
        status: RefundStatus.SUCCESS,
      });
      (paymentConfig.validateWechatConfig as jest.Mock).mockReturnValue(true);

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('REFUND_EXISTS');
    });
  });

  describe('微信退款', () => {
    it('应该成功处理微信退款', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
          description: '测试退款',
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: 'PAID',
        paymentMethod: PaymentMethod.WECHAT,
        orderNo: 'ORD123',
        amount: '99.00',
        currency: 'CNY',
        paymentRecords: [{ id: 'pay-123' }],
      });
      (prisma.refundRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (paymentConfig.validateWechatConfig as jest.Mock).mockReturnValue(true);
      (paymentConfig.getWechatConfig as jest.Mock).mockReturnValue({
        refundNotifyUrl: 'https://example.com/refund/notify',
      });
      (wechatRefund.refund as jest.Mock).mockResolvedValue({
        refund_id: 'wx-refund-123',
        out_refund_no: 'REF123',
        amount: { refund: 9900 },
        success_time: '2025-01-16T12:00:00+08:00',
      });
      (prisma.refundRecord.create as jest.Mock).mockResolvedValue({
        id: 'refund-123',
        refundAmount: 99.0,
        status: RefundStatus.SUCCESS,
      });
      (prisma.refundRecord.update as jest.Mock).mockResolvedValue({
        id: 'refund-123',
        refundAmount: 99.0,
        status: RefundStatus.SUCCESS,
      });

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('退款申请成功');
      expect(data.data?.paymentMethod).toBe(PaymentMethod.WECHAT);
      expect(wechatRefund.refund).toHaveBeenCalled();
    });

    it('应该在微信配置无效时返回错误', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: 'PAID',
        paymentMethod: PaymentMethod.WECHAT,
        orderNo: 'ORD123',
        amount: '99.00',
        currency: 'CNY',
        paymentRecords: [{ id: 'pay-123' }],
      });
      (prisma.refundRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (paymentConfig.validateWechatConfig as jest.Mock).mockReturnValue(false);

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('INVALID_CONFIG');
    });
  });

  describe('支付宝退款', () => {
    it('应该成功处理支付宝退款', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
          description: '测试退款',
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: 'PAID',
        paymentMethod: PaymentMethod.ALIPAY,
        orderNo: 'ORD123',
        amount: '99.00',
        currency: 'CNY',
        paymentRecords: [{ id: 'pay-123' }],
      });
      (prisma.refundRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (paymentConfig.validateAlipayConfig as jest.Mock).mockReturnValue(true);
      (alipayRefund.refund as jest.Mock).mockResolvedValue({
        code: '10000',
        msg: 'Success',
        refundFee: '99.00',
        tradeNo: 'ali-trade-123',
        outRequestNo: 'REF123',
        gmtRefundPay: '2025-01-16T12:00:00+08:00',
      });
      (prisma.refundRecord.create as jest.Mock).mockResolvedValue({
        id: 'refund-123',
        refundAmount: 99.0,
        status: RefundStatus.SUCCESS,
      });
      (prisma.refundRecord.update as jest.Mock).mockResolvedValue({
        id: 'refund-123',
        refundAmount: 99.0,
        status: RefundStatus.SUCCESS,
      });

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('退款申请成功');
      expect(data.data?.paymentMethod).toBe(PaymentMethod.ALIPAY);
      expect(alipayRefund.refund).toHaveBeenCalled();
    });

    it('应该在支付宝退款失败时返回错误', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: 'PAID',
        paymentMethod: PaymentMethod.ALIPAY,
        orderNo: 'ORD123',
        amount: '99.00',
        currency: 'CNY',
        paymentRecords: [{ id: 'pay-123' }],
      });
      (prisma.refundRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (paymentConfig.validateAlipayConfig as jest.Mock).mockReturnValue(true);
      (alipayRefund.refund as jest.Mock).mockResolvedValue({
        code: '20000',
        msg: '支付失败',
      });
      (prisma.refundRecord.create as jest.Mock).mockResolvedValue({
        id: 'refund-123',
      });

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('ALIPAY_ERROR');
    });
  });

  describe('错误处理', () => {
    it('应该处理退款失败的情况', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: 'PAID',
        paymentMethod: PaymentMethod.WECHAT,
        orderNo: 'ORD123',
        amount: '99.00',
        currency: 'CNY',
        paymentRecords: [{ id: 'pay-123' }],
      });
      (prisma.refundRecord.findFirst as jest.Mock).mockResolvedValue(null);
      (paymentConfig.validateWechatConfig as jest.Mock).mockReturnValue(true);
      (paymentConfig.getWechatConfig as jest.Mock).mockReturnValue({
        refundNotifyUrl: 'https://example.com/refund/notify',
      });
      (wechatRefund.refund as jest.Mock).mockRejectedValue(
        new Error('微信退款失败')
      );
      (prisma.refundRecord.create as jest.Mock).mockResolvedValue({
        id: 'refund-123',
        status: RefundStatus.PENDING,
      });

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('REFUND_ERROR');
      expect(prisma.refundRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RefundStatus.FAILED,
            rejectedReason: '退款处理失败',
          }),
        })
      );
    });

    it('应该拒绝不支持的支付方式', async () => {
      // Arrange
      mockRequest = {
        json: async () => ({
          orderId: 'order-123',
          reason: RefundReason.USER_REQUEST,
        }),
      } as unknown as NextRequest;
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-123',
        userId: 'user-123',
        status: 'PAID',
        paymentMethod: 'UNSUPPORTED',
        orderNo: 'ORD123',
        amount: '99.00',
        currency: 'CNY',
        paymentRecords: [{ id: 'pay-123' }],
      });
      (prisma.refundRecord.findFirst as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await POST(mockRequest);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNSUPPORTED_PAYMENT_METHOD');
    });
  });
});
