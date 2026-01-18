/**
 * 通过订单号查询订单API测试
 * 测试 GET /api/orders/by-order-no/[orderNo]
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/orders/by-order-no/[orderNo]/route';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  authOptions: {},
}));

jest.mock('@/lib/order/order-service', () => ({
  getOrderByOrderNo: jest.fn(),
}));

import { getServerSession } from 'next-auth';
import { getOrderByOrderNo } from '@/lib/order/order-service';

describe('GET /api/orders/by-order-no/[orderNo]', () => {
  let mockRequest: unknown;
  let mockParams: { orderNo: string };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {};
    mockParams = { orderNo: 'ORD20250117001' };
  });

  describe('未授权情况', () => {
    it('应该返回401当用户未登录', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const response = await GET(mockRequest as NextRequest, {
        params: mockParams,
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({
        success: false,
        message: '未授权，请先登录',
        error: 'UNAUTHORIZED',
      });
    });
  });

  describe('参数验证', () => {
    it('应该返回400当订单号为空', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123' },
      });

      const response = await GET(mockRequest as NextRequest, {
        params: { orderNo: '' },
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({
        success: false,
        message: '订单号不能为空',
        error: 'MISSING_ORDER_NO',
      });
    });
  });

  describe('订单查询', () => {
    it('应该返回订单详情当订单存在', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNo: 'ORD20250117001',
        userId: 'user-123',
        amount: 299.0,
        currency: 'CNY',
        paymentMethod: 'WECHAT',
        status: 'PAID',
        createdAt: new Date(),
        membershipTier: {
          id: 'tier-123',
          name: 'PROFESSIONAL',
          displayName: '专业版会员',
        },
      };

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123' },
      });
      (getOrderByOrderNo as jest.Mock).mockResolvedValueOnce(mockOrder);

      const response = await GET(mockRequest as NextRequest, {
        params: mockParams,
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('查询成功');
      // 注意：JSON序列化后Date对象会变成字符串
      expect(body.data).toMatchObject({
        ...mockOrder,
        createdAt: mockOrder.createdAt.toISOString(),
      });
      expect(getOrderByOrderNo).toHaveBeenCalledWith('ORD20250117001');
    });

    it('应该返回404当订单不存在', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123' },
      });
      (getOrderByOrderNo as jest.Mock).mockResolvedValueOnce(null);

      const response = await GET(mockRequest as NextRequest, {
        params: mockParams,
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body).toEqual({
        success: false,
        message: '订单不存在',
        error: 'ORDER_NOT_FOUND',
      });
    });
  });

  describe('权限验证', () => {
    it('应该返回403当用户无权访问订单', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNo: 'ORD20250117001',
        userId: 'other-user-id', // 不同的用户ID
        amount: 299.0,
        currency: 'CNY',
        paymentMethod: 'WECHAT',
        status: 'PAID',
        createdAt: new Date(),
      };

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123' },
      });
      (getOrderByOrderNo as jest.Mock).mockResolvedValueOnce(mockOrder);

      const response = await GET(mockRequest as NextRequest, {
        params: mockParams,
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({
        success: false,
        message: '无权访问该订单',
        error: 'FORBIDDEN',
      });
    });
  });

  describe('错误处理', () => {
    it('应该返回500当查询失败', async () => {
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123' },
      });
      (getOrderByOrderNo as jest.Mock).mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await GET(mockRequest as NextRequest, {
        params: mockParams,
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('INTERNAL_ERROR');
    });
  });
});
