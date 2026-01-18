/**
 * 支付处理中页面测试
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentProcessingPage from '@/app/payment/processing/page';
import { PaymentProcessing } from '@/components/payment/PaymentProcessing';
import { PaymentMethod } from '@/types/payment';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('@/components/payment/PaymentProcessing', () => ({
  PaymentProcessing: jest.fn(() =>
    React.createElement('div', { 'data-testid': 'mock-payment-processing' })
  ),
}));

jest.mock('@/components/payment/PaymentFail', () => ({
  PaymentFail: jest.fn(({ orderId, message }) =>
    React.createElement(
      'div',
      { 'data-testid': 'mock-payment-fail' },
      React.createElement('div', { 'data-testid': 'fail-order-id' }, orderId),
      React.createElement('div', { 'data-testid': 'fail-message' }, message),
      '支付失败，请重试或联系客服',
      React.createElement(
        'button',
        { 'data-testid': 'view-order-btn' },
        '查看订单详情'
      )
    )
  ),
}));

import { useSearchParams, useRouter } from 'next/navigation';

describe('PaymentProcessingPage', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('错误状态', () => {
    it('应该显示参数错误并提供返回按钮', () => {
      // Mock空参数
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn(() => null),
        forEach: jest.fn(() => {}),
      });

      render(<PaymentProcessingPage />);

      // 错误状态应该立即显示（无需等待）
      expect(screen.getByText('参数错误')).toBeInTheDocument();
      expect(screen.getByText('缺少订单参数')).toBeInTheDocument();

      // 检查返回按钮存在
      expect(screen.getByText('返回订单列表')).toBeInTheDocument();
    });
  });

  describe('支付失败状态', () => {
    beforeEach(() => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === 'orderId') return 'test-order-id';
          return null;
        }),
        forEach: jest.fn((callback: (value: string, key: string) => void) => {
          callback('test-order-id', 'orderId');
        }),
      });
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: '查询成功',
              data: {
                order: {
                  id: 'test-order-id',
                  orderNo: 'ORD123',
                  userId: 'test-user-id',
                  paymentMethod: 'WECHAT',
                  status: 'FAILED',
                  amount: 99,
                  currency: 'CNY',
                },
                paymentStatus: 'FAILED',
              },
            }),
        })
      );
    });

    it('应该显示支付失败状态', async () => {
      render(<PaymentProcessingPage />);

      await waitFor(
        () => {
          expect(screen.getByTestId('mock-payment-fail')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('轮询超时状态', () => {
    beforeEach(() => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === 'orderId') return 'test-order-id';
          return null;
        }),
        forEach: jest.fn((callback: (value: string, key: string) => void) => {
          callback('test-order-id', 'orderId');
        }),
      });
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: '查询成功',
              data: {
                order: {
                  id: 'test-order-id',
                  orderNo: 'ORD123',
                  userId: 'test-user-id',
                  paymentMethod: 'WECHAT',
                  status: 'PROCESSING',
                  amount: 99,
                  currency: 'CNY',
                },
                paymentStatus: 'PROCESSING',
              },
            }),
        })
      );
    });

    it('应该在30次轮询后显示超时', async () => {
      render(<PaymentProcessingPage />);

      await waitFor(
        () => {
          expect(screen.queryByText('加载订单信息...')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      for (let i = 0; i < 30; i++) {
        jest.advanceTimersByTime(2000);
      }

      await waitFor(
        () => {
          expect(screen.getByText('查询超时')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('支付成功状态', () => {
    beforeEach(() => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === 'orderId') return 'test-order-id';
          if (key === 'orderNo') return 'ORD123';
          if (key === 'amount') return '99';
          if (key === 'currency') return 'CNY';
          if (key === 'paymentMethod') return 'WECHAT';
          return null;
        }),
        forEach: jest.fn((callback: (value: string, key: string) => void) => {
          callback('test-order-id', 'orderId');
          callback('ORD123', 'orderNo');
          callback('99', 'amount');
          callback('CNY', 'currency');
          callback('WECHAT', 'paymentMethod');
        }),
      });
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: '查询成功',
              data: {
                order: {
                  id: 'test-order-id',
                  orderNo: 'ORD123',
                  userId: 'test-user-id',
                  paymentMethod: 'WECHAT',
                  status: 'PAID',
                  amount: 99,
                  currency: 'CNY',
                },
                paymentStatus: 'SUCCESS',
              },
            }),
        })
      );
    });

    it('应该在支付成功时跳转到成功页面', async () => {
      render(<PaymentProcessingPage />);

      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalled();
          expect(mockPush.mock.calls[0][0]).toContain(
            '/payment/success?orderId=test-order-id'
          );
        },
        { timeout: 5000 }
      );
    });
  });

  describe('正常处理中状态', () => {
    beforeEach(() => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === 'orderId') return 'test-order-id';
          if (key === 'orderNo') return 'ORD123';
          if (key === 'amount') return '99';
          if (key === 'currency') return 'CNY';
          if (key === 'paymentMethod') return 'WECHAT';
          return null;
        }),
        forEach: jest.fn((callback: (value: string, key: string) => void) => {
          callback('test-order-id', 'orderId');
          callback('ORD123', 'orderNo');
          callback('99', 'amount');
          callback('CNY', 'currency');
          callback('WECHAT', 'paymentMethod');
        }),
      });
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: '查询成功',
              data: {
                order: {
                  id: 'test-order-id',
                  orderNo: 'ORD123',
                  userId: 'test-user-id',
                  paymentMethod: 'WECHAT',
                  status: 'PROCESSING',
                  amount: 99,
                  currency: 'CNY',
                },
                paymentStatus: 'PROCESSING',
              },
            }),
        })
      );
    });
    it('应该显示处理中组件', async () => {
      render(<PaymentProcessingPage />);

      await waitFor(
        () => {
          expect(screen.queryByText('加载订单信息...')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      expect(screen.getByTestId('mock-payment-processing')).toBeInTheDocument();
    });
  });
});
