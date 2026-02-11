/**
 * 支付回调页面测试
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WechatPayCallbackPage from '@/app/payment/wechat/callback/page';
import AlipayCallbackPage from '@/app/payment/alipay/callback/page';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

import { useSearchParams, useRouter } from 'next/navigation';

describe('WechatPayCallbackPage', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('加载状态', () => {
    it('应该显示加载状态', () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn(() => 'ORD123'),
        forEach: jest.fn((callback: (value: string, key: string) => void) =>
          callback('ORD123', 'out_trade_no')
        ),
      });

      render(<WechatPayCallbackPage />);

      expect(screen.getByText('正在处理支付结果')).toBeInTheDocument();
      expect(
        screen.getByText('正在确认您的支付结果，请稍候...')
      ).toBeInTheDocument();
    });
  });

  describe('错误状态', () => {
    it('应该显示缺少参数错误', () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn(() => null),
        forEach: jest.fn(() => {}),
      });

      render(<WechatPayCallbackPage />);

      expect(screen.getByText('处理失败')).toBeInTheDocument();
      expect(screen.getByText('缺少回调参数')).toBeInTheDocument();
      expect(screen.getByText('查看我的订单')).toBeInTheDocument();
      expect(screen.getByText('返回首页')).toBeInTheDocument();
    });
  });

  describe('成功状态', () => {
    beforeEach(() => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn(() => 'ORD123'),
        forEach: jest.fn((callback: (value: string, key: string) => void) =>
          callback('ORD123', 'out_trade_no')
        ),
      });
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: '支付成功',
              redirectUrl: '/payment/success?orderId=order-123',
              delay: 2000,
            }),
        })
      );
    });

    it('应该显示支付成功状态', async () => {
      render(<WechatPayCallbackPage />);

      await waitFor(
        () => {
          expect(screen.getByText('支付成功')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('应该自动跳转到成功页面', async () => {
      render(<WechatPayCallbackPage />);

      await waitFor(
        () => {
          expect(screen.getByText(/支付成功/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      jest.advanceTimersByTime(2000);

      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalledWith(
            '/payment/success?orderId=order-123'
          );
        },
        { timeout: 5000 }
      );
    });
  });

  describe('网络错误', () => {
    beforeEach(() => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn(() => 'ORD123'),
        forEach: jest.fn((callback: (value: string, key: string) => void) =>
          callback('ORD123', 'out_trade_no')
        ),
      });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('网络错误'));
    });

    it('应该显示错误信息', async () => {
      render(<WechatPayCallbackPage />);

      await waitFor(
        () => {
          expect(screen.getByText('处理失败')).toBeInTheDocument();
          expect(screen.getByText(/网络错误|处理回调失败/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });
});

describe('AlipayCallbackPage', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('加载状态', () => {
    it('应该显示加载状态', () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn(() => 'ORD123'),
        forEach: jest.fn((callback: (value: string, key: string) => void) =>
          callback('ORD123', 'out_trade_no')
        ),
      });

      render(<AlipayCallbackPage />);

      expect(screen.getByText('正在处理支付结果')).toBeInTheDocument();
      expect(
        screen.getByText('正在确认您的支付结果，请稍候...')
      ).toBeInTheDocument();
    });
  });

  describe('错误状态', () => {
    it('应该显示缺少参数错误', () => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn(() => null),
        forEach: jest.fn(() => {}),
      });

      render(<AlipayCallbackPage />);

      expect(screen.getByText('处理失败')).toBeInTheDocument();
      expect(screen.getByText('缺少回调参数')).toBeInTheDocument();
      expect(screen.getByText('查看我的订单')).toBeInTheDocument();
      expect(screen.getByText('返回首页')).toBeInTheDocument();
    });
  });

  describe('成功状态', () => {
    beforeEach(() => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn(() => 'ORD123'),
        forEach: jest.fn((callback: (value: string, key: string) => void) =>
          callback('ORD123', 'out_trade_no')
        ),
      });
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: '支付成功',
              redirectUrl: '/payment/success?orderId=order-123',
              delay: 3000,
            }),
        })
      );
    });

    it('应该显示支付成功状态', async () => {
      render(<AlipayCallbackPage />);

      await waitFor(
        () => {
          expect(screen.getByText('支付成功')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('应该自动跳转到成功页面', async () => {
      render(<AlipayCallbackPage />);

      await waitFor(
        () => {
          expect(screen.getByText(/支付成功/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      jest.advanceTimersByTime(3000);

      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalledWith(
            '/payment/success?orderId=order-123'
          );
        },
        { timeout: 5000 }
      );
    });
  });

  describe('网络错误', () => {
    beforeEach(() => {
      (useSearchParams as jest.Mock).mockReturnValue({
        get: jest.fn(() => 'ORD123'),
        forEach: jest.fn((callback: (value: string, key: string) => void) =>
          callback('ORD123', 'out_trade_no')
        ),
      });
      (global.fetch as jest.Mock).mockRejectedValue(new Error('网络错误'));
    });

    it('应该显示错误信息', async () => {
      render(<AlipayCallbackPage />);

      await waitFor(
        () => {
          expect(screen.getByText('处理失败')).toBeInTheDocument();
          expect(screen.getByText(/网络错误|处理回调失败/)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });
});
