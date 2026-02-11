import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PaymentConfirm } from '@/components/payment/PaymentConfirm';
import { PaymentMethod } from '@/types/payment';

// Mock's Image component from next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt?: string; src?: string; className?: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

describe('PaymentConfirm', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render payment confirmation with amount', () => {
    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.WECHAT}
        membershipTierId='tier-123'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('¥99.99')).toBeInTheDocument();
    expect(screen.getByText('微信支付')).toBeInTheDocument();
    expect(screen.getByText('会员升级')).toBeInTheDocument();
  });

  it('should display order number after order is created', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          orderId: 'order-123',
          orderNo: 'ORD202401010001',
          amount: 99.99,
          currency: 'CNY',
          status: 'PENDING',
        },
      }),
    });

    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.WECHAT}
        membershipTierId='tier-123'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/订单号/)).toBeInTheDocument();
    });
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    // Mock成功创建订单
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          orderId: 'order-123',
          orderNo: 'ORD202401010001',
          amount: 99.99,
          currency: 'CNY',
          status: 'PENDING',
        },
      }),
    });

    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.WECHAT}
        membershipTierId='tier-123'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // 等待订单创建完成
    await waitFor(() => {
      expect(screen.getByText(/订单号/)).toBeInTheDocument();
    });

    const confirmButton = screen
      .getAllByRole('button')
      .find(b => b.textContent === '确认支付');
    if (confirmButton) {
      fireEvent.click(confirmButton);
    }
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it('should call onCancel when cancel button is clicked', () => {
    // 不提供membershipTierId避免自动创建订单
    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.WECHAT}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen
      .getAllByRole('button')
      .find(b => b.textContent === '取消');
    if (cancelButton) {
      fireEvent.click(cancelButton);
    }
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should display payment QR code when codeUrl is available', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          orderId: 'order-123',
          orderNo: 'ORD202401010001',
          codeUrl: 'https://pay.example.com/qrcode',
          amount: 99.99,
          currency: 'CNY',
          status: 'PENDING',
        },
      }),
    });

    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.WECHAT}
        membershipTierId='tier-123'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByAltText('支付二维码')).toBeInTheDocument();
    });
  });

  it('should show error message when order creation fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: '创建订单失败',
      }),
    });

    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.WECHAT}
        membershipTierId='tier-123'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('创建订单失败')).toBeInTheDocument();
    });
  });

  it('should show Alipay payment method name', () => {
    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.ALIPAY}
        membershipTierId='tier-123'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('支付宝')).toBeInTheDocument();
  });

  it('should show Balance payment method name', () => {
    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.BALANCE}
        membershipTierId='tier-123'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('余额支付')).toBeInTheDocument();
  });

  it('should show countdown timer', () => {
    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.WECHAT}
        membershipTierId='tier-123'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('支付剩余时间')).toBeInTheDocument();
    expect(screen.getByText(/02:00:/)).toBeInTheDocument();
  });

  it('should disable buttons when isLoading is true', () => {
    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.WECHAT}
        membershipTierId='test-tier-id'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        isLoading={true}
      />
    );

    const cancelButton = screen.getByText('取消');
    const confirmButton = screen.getByText('处理中...');

    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
  });

  it('should not create order when membershipTierId is missing', () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          orderId: 'order-123',
          orderNo: 'ORD202401010001',
        },
      }),
    });

    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={PaymentMethod.WECHAT}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // Order should not be created without membershipTierId
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should not create order when paymentMethod is missing', () => {
    render(
      <PaymentConfirm
        amount={99.99}
        paymentMethod={null}
        membershipTierId='tier-123'
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // Order should not be created without paymentMethod
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
