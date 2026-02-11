/**
 * 支付成功页面测试
 * 测试支付成功页面的各种场景
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import PaymentSuccessPage from '@/app/payment/success/page';

// 设置jsdom环境
import '@testing-library/jest-dom';

// Mock Next.js hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('PaymentSuccessPage', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('正常情况', () => {
    it('应该显示订单信息当订单存在且已支付', async () => {
      // Mock URL参数
      const mockSearchParams = new URLSearchParams();
      mockSearchParams.set('orderId', 'order-123');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      // Mock fetch响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'order-123',
            orderNo: 'ORD20250117001',
            userId: 'user-123',
            amount: 299.0,
            currency: 'CNY',
            paymentMethod: 'WECHAT',
            status: 'PAID',
            paidAt: new Date('2025-01-17T10:00:00Z'),
            createdAt: new Date('2025-01-17T10:00:00Z'),
            membershipTier: {
              id: 'tier-123',
              name: 'PROFESSIONAL',
              displayName: '专业版会员',
            },
          },
        }),
      });

      render(<PaymentSuccessPage />);

      // 等待加载完成
      await waitFor(() => {
        expect(screen.queryByText('加载订单信息...')).not.toBeInTheDocument();
      });

      // 验证订单信息显示
      expect(screen.getByText('支付成功')).toBeInTheDocument();
      expect(screen.getByText('ORD20250117001')).toBeInTheDocument();
      expect(screen.getByText('¥ 299.00')).toBeInTheDocument();
      expect(screen.getByText('微信支付')).toBeInTheDocument();
      expect(screen.getByText('专业版会员')).toBeInTheDocument();
    });

    it('应该通过订单号获取订单', async () => {
      // Mock URL参数
      const mockSearchParams = new URLSearchParams();
      mockSearchParams.set('orderNo', 'ORD20250117001');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      // Mock fetch响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'order-123',
            orderNo: 'ORD20250117001',
            userId: 'user-123',
            amount: 299.0,
            currency: 'CNY',
            paymentMethod: 'WECHAT',
            status: 'PAID',
            paidAt: new Date('2025-01-17T10:00:00Z'),
            createdAt: new Date('2025-01-17T10:00:00Z'),
            membershipTier: {
              id: 'tier-123',
              name: 'PROFESSIONAL',
              displayName: '专业版会员',
            },
          },
        }),
      });

      render(<PaymentSuccessPage />);

      // 验证API调用
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/orders/by-order-no/ORD20250117001'
      );

      // 等待加载完成
      await waitFor(() => {
        expect(screen.queryByText('加载订单信息...')).not.toBeInTheDocument();
      });

      // 验证订单信息显示
      expect(screen.getByText('ORD20250117001')).toBeInTheDocument();
    });
  });

  describe('异常情况', () => {
    it('应该显示错误提示当缺少订单参数', async () => {
      // Mock URL参数 - 没有orderId和orderNo
      const mockSearchParams = new URLSearchParams();
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      render(<PaymentSuccessPage />);

      // 验证错误提示
      await waitFor(() => {
        expect(screen.getByText('获取订单信息失败')).toBeInTheDocument();
        expect(screen.getByText('缺少订单参数')).toBeInTheDocument();
      });
    });

    it('应该显示错误提示当订单不存在', async () => {
      // Mock URL参数
      const mockSearchParams = new URLSearchParams();
      mockSearchParams.set('orderId', 'order-999');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      // Mock fetch响应 - 404错误
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: '订单不存在',
          error: 'ORDER_NOT_FOUND',
        }),
      });

      render(<PaymentSuccessPage />);

      // 验证错误提示
      await waitFor(() => {
        expect(screen.getByText('获取订单信息失败')).toBeInTheDocument();
        expect(screen.getByText('订单不存在')).toBeInTheDocument();
      });
    });

    it('应该显示错误提示当订单状态不是已支付', async () => {
      // Mock URL参数
      const mockSearchParams = new URLSearchParams();
      mockSearchParams.set('orderId', 'order-123');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      // Mock fetch响应 - 订单状态不是PAID
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'order-123',
            orderNo: 'ORD20250117001',
            userId: 'user-123',
            amount: 299.0,
            currency: 'CNY',
            paymentMethod: 'WECHAT',
            status: 'PENDING',
            createdAt: new Date('2025-01-17T10:00:00Z'),
          },
        }),
      });

      render(<PaymentSuccessPage />);

      // 验证错误提示
      await waitFor(() => {
        expect(screen.getByText('获取订单信息失败')).toBeInTheDocument();
        expect(screen.getByText(/订单状态不正确/)).toBeInTheDocument();
      });
    });

    it('应该显示错误提示当网络请求失败', async () => {
      // Mock URL参数
      const mockSearchParams = new URLSearchParams();
      mockSearchParams.set('orderId', 'order-123');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      // Mock fetch - 网络错误
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('网络错误'));

      render(<PaymentSuccessPage />);

      // 验证错误提示
      await waitFor(() => {
        expect(screen.getByText('获取订单信息失败')).toBeInTheDocument();
      });
    });

    it('应该显示加载状态', () => {
      // Mock URL参数
      const mockSearchParams = new URLSearchParams();
      mockSearchParams.set('orderId', 'order-123');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      // Mock fetch - 延迟响应
      (global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise(() => {
            // 永不解析，保持加载状态
          })
      );

      render(<PaymentSuccessPage />);

      // 验证加载状态
      expect(screen.getByText('加载订单信息...')).toBeInTheDocument();
    });
  });

  describe('交互功能', () => {
    it('应该能点击返回首页按钮', async () => {
      // Mock URL参数
      const mockSearchParams = new URLSearchParams();
      mockSearchParams.set('orderId', 'order-123');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      // Mock fetch响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'order-123',
            orderNo: 'ORD20250117001',
            userId: 'user-123',
            amount: 299.0,
            currency: 'CNY',
            paymentMethod: 'WECHAT',
            status: 'PAID',
            paidAt: new Date('2025-01-17T10:00:00Z'),
            createdAt: new Date('2025-01-17T10:00:00Z'),
          },
        }),
      });

      render(<PaymentSuccessPage />);

      // 等待加载完成
      await waitFor(() => {
        expect(screen.queryByText('加载订单信息...')).not.toBeInTheDocument();
      });

      // 点击返回首页按钮（错误提示页面）
      const returnButton = screen.getByText('返回首页');
      returnButton.click();

      // 验证router.push被调用
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });

    it('应该能点击查看订单按钮', async () => {
      // Mock URL参数
      const mockSearchParams = new URLSearchParams();
      mockSearchParams.set('orderId', 'order-123');
      (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

      // Mock fetch响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'order-123',
            orderNo: 'ORD20250117001',
            userId: 'user-123',
            amount: 299.0,
            currency: 'CNY',
            paymentMethod: 'WECHAT',
            status: 'PAID',
            paidAt: new Date('2025-01-17T10:00:00Z'),
            createdAt: new Date('2025-01-17T10:00:00Z'),
            membershipTier: {
              id: 'tier-123',
              name: 'PROFESSIONAL',
              displayName: '专业版会员',
            },
          },
        }),
      });

      render(<PaymentSuccessPage />);

      // 等待加载完成
      await waitFor(() => {
        expect(screen.queryByText('加载订单信息...')).not.toBeInTheDocument();
      });

      // 查看按钮是否存在（需要根据实际组件来测试）
      const viewOrdersButton = screen.getByText('查看订单');
      viewOrdersButton.click();

      // 验证router.push被调用
      expect(mockRouter.push).toHaveBeenCalledWith('/orders');
    });
  });
});
