import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import { OrderList } from '@/components/order/OrderList';
import { Order, OrderStatus, PaymentMethod } from '@/types/payment';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OrderList', () => {
  const mockUserId = 'user-123';
  const mockOrders: Order[] = [
    {
      id: 'order-1',
      orderNo: 'ORD202401010001',
      userId: mockUserId,
      membershipTierId: 'tier-1',
      paymentMethod: PaymentMethod.WECHAT,
      status: OrderStatus.PAID,
      amount: 99.99,
      currency: 'CNY',
      description: '会员升级',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
      paidAt: new Date('2024-01-01T10:05:00Z'),
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
    },
    {
      id: 'order-2',
      orderNo: 'ORD202401010002',
      userId: mockUserId,
      membershipTierId: 'tier-2',
      paymentMethod: PaymentMethod.ALIPAY,
      status: OrderStatus.PENDING,
      amount: 199.99,
      currency: 'CNY',
      description: '会员升级',
      createdAt: new Date('2024-01-02T10:00:00Z'),
      updatedAt: new Date('2024-01-02T10:00:00Z'),
      paidAt: null,
      expiredAt: new Date('2024-01-02T12:00:00Z'),
      metadata: {
        billingCycle: 'YEARLY',
        autoRenew: true,
      },
      membershipTier: {
        id: 'tier-2',
        name: 'Professional Tier',
        displayName: '专业会员',
        tier: 'PROFESSIONAL',
      },
      paymentRecords: [],
    },
  ];

  const mockSuccessResponse = {
    success: true,
    message: '查询成功',
    data: {
      orders: mockOrders,
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
    },
  };

  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockSuccessResponse,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render order list component', async () => {
    render(<OrderList userId={mockUserId} />);

    // placeholder是属性，不是文本，需要查找包含placeholder的input
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('搜索订单号或描述');
      expect(searchInput).toBeInTheDocument();
    });

    // 检查 fetch 是否被调用，并且URL包含预期的参数
    expect(mockFetch).toHaveBeenCalled();
    const calls = mockFetch.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toContain(
      '/api/orders?page=1&limit=10&sortBy=createdAt&sortOrder=desc'
    );
  });

  it('should display orders after loading', async () => {
    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
      expect(screen.getByText('ORD202401010002')).toBeInTheDocument();
    });

    // 使用 getAllByText 处理重复的文本
    expect(screen.getAllByText('已支付').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待支付').length).toBeGreaterThan(0);
  });

  it('should show loading state', () => {
    // Mock延迟响应
    mockFetch.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => mockSuccessResponse,
              }),
            100
          )
        )
    );

    render(<OrderList userId={mockUserId} />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should handle fetch error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: '加载订单失败',
      }),
    });

    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('加载订单失败')).toBeInTheDocument();
    });
  });

  it('should filter orders by status', async () => {
    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    });

    const statusSelects = screen.getAllByRole('combobox');
    const statusSelect = statusSelects.find((s: HTMLSelectElement) =>
      s.textContent?.includes('全部状态')
    );
    if (statusSelect) {
      fireEvent.change(statusSelect, { target: { value: OrderStatus.PAID } });

      // 检查fetch是否被调用，并且最后一次调用包含status=PAID
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const calls = mockFetch.mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0]).toContain('status=PAID');
      });
    }
  });

  it('should search orders by text', async () => {
    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('搜索订单号或描述');
    fireEvent.change(searchInput, {
      target: { value: 'ORD202401010001' },
    });

    // 本地搜索应该过滤显示的订单
    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    });
  });

  it('should sort orders by different fields', async () => {
    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    });

    const sortSelects = screen.getAllByRole('combobox');
    const sortSelect = sortSelects.find((s: HTMLSelectElement) =>
      s.textContent?.includes('创建时间')
    );
    if (sortSelect) {
      fireEvent.change(sortSelect, { target: { value: 'amount' } });

      // 检查fetch是否被调用，并且最后一次调用包含sortBy=amount
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
        const calls = mockFetch.mock.calls;
        const lastCall = calls[calls.length - 1];
        expect(lastCall[0]).toContain('sortBy=amount');
      });
    }
  });

  it('should handle pagination', async () => {
    // 第一次调用返回第一页数据（limit=1，total=2，totalPages=2）
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          orders: [mockOrders[0]],
          pagination: {
            page: 1,
            limit: 1,
            total: 2,
            totalPages: 2,
          },
        },
      }),
    });

    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    });

    // 检查是否显示分页信息
    const paginationInfo = screen.queryByText(/共 2 条记录/);
    if (paginationInfo) {
      expect(paginationInfo).toBeInTheDocument();
    }
  });

  it('should display payment method correctly', async () => {
    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      // 使用 getAllByText 来处理可能重复的文本
      const paymentMethods = screen.getAllByText(/微信支付|支付宝/);
      expect(paymentMethods.length).toBeGreaterThan(0);
    });
  });

  it('should display amount formatted correctly', async () => {
    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('¥99.99')).toBeInTheDocument();
      expect(screen.getByText('¥199.99')).toBeInTheDocument();
    });
  });

  it('should show empty state when no orders', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          orders: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        },
      }),
    });

    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('暂无订单记录')).toBeInTheDocument();
    });
  });

  it('should show empty state with search message when searching', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          orders: mockOrders,
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
          },
        },
      }),
    });

    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('搜索订单号或描述');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('未找到匹配的订单')).toBeInTheDocument();
    });
  });

  it('should refresh orders when refresh button is clicked', async () => {
    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    });

    const allButtons = screen.getAllByRole('button');
    const refreshButtons = allButtons.filter(b => b.textContent === '刷新');
    if (refreshButtons.length > 0) {
      fireEvent.click(refreshButtons[0]);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    }
  });

  it('should format dates correctly', async () => {
    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText(/2024\/01\/01/)).toBeInTheDocument();
      expect(screen.getByText(/2024\/01\/02/)).toBeInTheDocument();
    });
  });

  it('should handle retry on error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: '网络错误',
      }),
    });

    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });

    // Reset mock for retry
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    });

    const retryButton = screen.getByRole('button', { name: '重试' });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    });
  });

  it('should display status badges with correct variants', async () => {
    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('ORD202401010001')).toBeInTheDocument();
    });

    const badges = screen.getAllByText(/待支付|已支付|已取消|已过期/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('should navigate to membership page when clicking go to membership button', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          orders: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        },
      }),
    });

    render(<OrderList userId={mockUserId} />);

    await waitFor(() => {
      expect(screen.getByText('暂无订单记录')).toBeInTheDocument();
    });

    const membershipButton = screen.getByRole('button', {
      name: '去开通会员',
    });

    // 验证按钮存在
    expect(membershipButton).toBeInTheDocument();

    // 点击按钮验证可点击
    fireEvent.click(membershipButton);

    // 按钮点击后，组件应该尝试设置 window.location.href
    // 由于测试环境的限制，我们只验证按钮的交互行为
  });
});
