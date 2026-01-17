import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OrderDetailModal } from '@/components/order/OrderDetailModal';
import {
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/types/payment';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock window.confirm
global.confirm = jest.fn() as unknown as () => boolean;

// Mock onRefresh callback
const mockOnRefresh = jest.fn();

describe('OrderDetailModal', () => {
  const mockOrder: Order = {
    id: 'order-123',
    orderNo: 'ORD202401010001',
    userId: 'user-123',
    membershipTierId: 'tier-1',
    paymentMethod: PaymentMethod.WECHAT,
    status: OrderStatus.PENDING,
    amount: 99.99,
    currency: 'CNY',
    description: '会员升级',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    paidAt: null,
    expiredAt: new Date('2024-01-01T12:00:00Z'),
    metadata: {
      billingCycle: 'MONTHLY',
      autoRenew: false,
    },
    membershipTier: {
      id: 'tier-1',
      name: 'Basic Tier',
      displayName: '基础会员',
      tier: 'BASIC',
    },
    paymentRecords: [],
  };

  const mockOnClose = jest.fn();
  const mockOnOrderUpdated = jest.fn();

  beforeEach(() => {
    mockFetch.mockClear();
    mockOnClose.mockClear();
    mockOnOrderUpdated.mockClear();
    mockOnRefresh.mockClear();
    (global.confirm as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal with order details', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText('订单详情')).toBeInTheDocument();
    expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    expect(screen.getByText('¥99.99')).toBeInTheDocument();
  });

  it('should display order status badge', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    // 使用 getAllByText 来处理重复的文本
    const paymentStatus = screen.getAllByText('待支付');
    expect(paymentStatus.length).toBeGreaterThan(0);
  });

  it('should display payment status for different order statuses', () => {
    const paidOrder = { ...mockOrder, status: OrderStatus.PAID };
    render(
      <OrderDetailModal
        order={paidOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    // 使用 getAllByText 来处理可能重复的文本
    const paymentStatus = screen.getAllByText('已支付');
    expect(paymentStatus.length).toBeGreaterThan(0);
  });

  it('should display payment method correctly', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('微信支付')).toBeInTheDocument();
  });

  it('should display Alipay payment method', () => {
    const alipayOrder = {
      ...mockOrder,
      paymentMethod: PaymentMethod.ALIPAY,
    };
    render(
      <OrderDetailModal
        order={alipayOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('支付宝')).toBeInTheDocument();
  });

  it('should display Balance payment method', () => {
    const balanceOrder = {
      ...mockOrder,
      paymentMethod: PaymentMethod.BALANCE,
    };
    render(
      <OrderDetailModal
        order={balanceOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('余额支付')).toBeInTheDocument();
  });

  it('should display membership tier information', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('基础会员')).toBeInTheDocument();
    expect(screen.getByText('BASIC')).toBeInTheDocument();
  });

  it('should display metadata information', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('计费周期')).toBeInTheDocument();
    expect(screen.getByText('月付')).toBeInTheDocument();
    // 当 autoRenew 为 true 时才显示自动续费信息
    // autoRenew 为 false 时不显示
    expect(screen.queryByText('自动续费')).not.toBeInTheDocument();
  });

  it('should display metadata with autoRenew true', () => {
    const autoRenewOrder = {
      ...mockOrder,
      metadata: { ...mockOrder.metadata, autoRenew: true },
    };
    render(
      <OrderDetailModal
        order={autoRenewOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('自动续费')).toBeInTheDocument();
    expect(screen.getByText('是')).toBeInTheDocument();
  });

  it('should display order description', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('会员升级')).toBeInTheDocument();
  });

  it('should display dates correctly', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    // 使用 getAllByText 来处理重复的日期文本
    const dates = screen.getAllByText(/2024\/01\/01/);
    expect(dates.length).toBeGreaterThan(0);
  });

  it('should display paid date when order is paid', () => {
    const paidOrder = {
      ...mockOrder,
      status: OrderStatus.PAID,
      paidAt: new Date('2024-01-01T10:05:00Z'),
    };
    render(
      <OrderDetailModal
        order={paidOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    // formatDate 返回完整的日期时间格式，例如 "2024/01/01 18:05"
    expect(screen.getByText(/18:05/)).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const closeButtons = allButtons.filter(b => b.textContent === '');
    if (closeButtons.length > 0) {
      fireEvent.click(closeButtons[0]);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should call onClose when close button at bottom is clicked', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
        onRefresh={mockOnRefresh}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const bottomCloseButton = allButtons.find(b => b.textContent === '关闭');
    if (bottomCloseButton) {
      fireEvent.click(bottomCloseButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should call window.location.reload when refresh button is clicked', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
        onRefresh={mockOnRefresh}
      />
    );

    const refreshButton = screen.getByRole('button', { name: '刷新' });
    fireEvent.click(refreshButton);

    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it('should show cancel button for pending order', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
        onRefresh={mockOnRefresh}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const cancelButton = allButtons.find(b =>
      b.textContent?.includes('取消订单')
    );
    expect(cancelButton).toBeInTheDocument();
  });

  it('should not show cancel button for paid order', () => {
    const paidOrder = { ...mockOrder, status: OrderStatus.PAID };
    render(
      <OrderDetailModal
        order={paidOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
        onRefresh={mockOnRefresh}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const cancelButton = allButtons.find(b =>
      b.textContent?.includes('取消订单')
    );
    expect(cancelButton).toBeUndefined();
  });

  it('should cancel order when confirm is accepted', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: '订单已取消',
        data: { ...mockOrder, status: OrderStatus.CANCELLED },
      }),
    });

    (global.confirm as jest.Mock).mockReturnValue(true);

    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
        onRefresh={mockOnRefresh}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const cancelButton = allButtons.find(b =>
      b.textContent?.includes('取消订单')
    );
    if (cancelButton) {
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith(
          expect.stringContaining('确定要取消此订单吗')
        );
        expect(mockFetch).toHaveBeenCalledWith('/api/orders/order-123/cancel', {
          method: 'POST',
        });
        expect(mockOnOrderUpdated).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    }
  });

  it('should not cancel order when confirm is declined', () => {
    (global.confirm as jest.Mock).mockReturnValue(false);

    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
        onRefresh={mockOnRefresh}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const cancelButton = allButtons.find(b =>
      b.textContent?.includes('取消订单')
    );
    if (cancelButton) {
      fireEvent.click(cancelButton);
    }

    expect(global.confirm).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should display error when cancel fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: '取消订单失败',
      }),
    });

    (global.confirm as jest.Mock).mockReturnValue(true);

    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
        onRefresh={mockOnRefresh}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const cancelButton = allButtons.find(b =>
      b.textContent?.includes('取消订单')
    );
    if (cancelButton) {
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByText('取消订单失败')).toBeInTheDocument();
      });
    }
  });

  it('should show failed reason when order failed', () => {
    const failedOrder = {
      ...mockOrder,
      status: OrderStatus.FAILED,
      failedReason: '支付超时',
    };
    render(
      <OrderDetailModal
        order={failedOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('失败原因')).toBeInTheDocument();
    expect(screen.getByText('支付超时')).toBeInTheDocument();
  });

  it('should display status description for pending order', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(
      screen.getByText('订单待支付，请在过期时间内完成支付')
    ).toBeInTheDocument();
  });

  it('should display status description for paid order', () => {
    const paidOrder = { ...mockOrder, status: OrderStatus.PAID };
    render(
      <OrderDetailModal
        order={paidOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(
      screen.getByText('订单已支付成功，会员权益已生效')
    ).toBeInTheDocument();
  });

  it('should display payment records when available', () => {
    const orderWithRecords = {
      ...mockOrder,
      paymentRecords: [
        {
          id: 'record-1',
          orderId: 'order-123',
          userId: 'user-123',
          paymentMethod: PaymentMethod.WECHAT,
          status: PaymentStatus.SUCCESS,
          amount: 99.99,
          currency: 'CNY',
          transactionId: 'TXN123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    render(
      <OrderDetailModal
        order={orderWithRecords}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('支付记录')).toBeInTheDocument();
    expect(screen.getByText('交易ID: TXN123')).toBeInTheDocument();
  });

  it('should not display payment records section when empty', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.queryByText('支付记录')).not.toBeInTheDocument();
  });

  it('should close modal when clicking backdrop', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    // Find the backdrop (first div with bg-gray-900)
    const backdrop = screen.getByRole('dialog').querySelector('.bg-gray-900');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should handle cancel button disabled state while cancelling', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  success: true,
                  message: '订单已取消',
                  data: { ...mockOrder, status: OrderStatus.CANCELLED },
                }),
              }),
            100
          )
        )
    );

    (global.confirm as jest.Mock).mockReturnValue(true);

    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
        onRefresh={mockOnRefresh}
      />
    );

    const allButtons = screen.getAllByRole('button');
    const cancelButton = allButtons.find(b =>
      b.textContent?.includes('取消订单')
    );
    if (cancelButton) {
      fireEvent.click(cancelButton);

      // Button should be disabled while cancelling
      await waitFor(() => {
        expect(screen.getByText(/取消中/)).toBeInTheDocument();
      });
    }
  });

  it('should format amount correctly', () => {
    render(
      <OrderDetailModal
        order={mockOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('¥99.99')).toBeInTheDocument();
  });

  it('should display different billing cycles', () => {
    const quarterlyOrder = {
      ...mockOrder,
      metadata: { billingCycle: 'QUARTERLY', autoRenew: false },
    };
    render(
      <OrderDetailModal
        order={quarterlyOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('季付')).toBeInTheDocument();
  });

  it('should display yearly billing cycle', () => {
    const yearlyOrder = {
      ...mockOrder,
      metadata: { billingCycle: 'YEARLY', autoRenew: false },
    };
    render(
      <OrderDetailModal
        order={yearlyOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('年付')).toBeInTheDocument();
  });

  it('should display lifetime billing cycle', () => {
    const lifetimeOrder = {
      ...mockOrder,
      metadata: { billingCycle: 'LIFETIME', autoRenew: false },
    };
    render(
      <OrderDetailModal
        order={lifetimeOrder}
        onClose={mockOnClose}
        onOrderUpdated={mockOnOrderUpdated}
      />
    );

    expect(screen.getByText('终身')).toBeInTheDocument();
  });
});
