'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Order {
  id: string;
  orderNo: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  membershipTierName: string;
  paymentMethod: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  expiredAt: string;
  paidAt: string | null;
  createdAt: string;
}

interface Summary {
  total: number;
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  pendingAmount: number;
  failedCount: number;
  failedAmount: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OrderListData {
  orders: Order[];
  summary: Summary;
  pagination: Pagination;
}

interface FilterParams {
  status: string;
  paymentMethod: string;
  search: string;
  startDate: string;
  endDate: string;
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待支付' },
  { value: 'PAID', label: '已支付' },
  { value: 'FAILED', label: '支付失败' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'EXPIRED', label: '已过期' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: '全部支付方式' },
  { value: 'WECHAT', label: '微信支付' },
  { value: 'ALIPAY', label: '支付宝' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600 bg-yellow-50',
  PAID: 'text-green-600 bg-green-50',
  FAILED: 'text-red-600 bg-red-50',
  CANCELLED: 'text-gray-600 bg-gray-50',
  REFUNDED: 'text-purple-600 bg-purple-50',
  EXPIRED: 'text-orange-600 bg-orange-50',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  WECHAT: '微信支付',
  ALIPAY: '支付宝',
};

export function AdminOrderList(): React.ReactElement {
  const [data, setData] = useState<OrderListData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterParams>({
    status: '',
    paymentMethod: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [currentPage, setCurrentPage] = useState<number>(1);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(filters.status && { status: filters.status }),
        ...(filters.paymentMethod && { paymentMethod: filters.paymentMethod }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/admin/orders?${params}`);
      if (!response.ok) {
        throw new Error('获取订单列表失败');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleFilterChange = (key: keyof FilterParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    loadOrders();
  };

  const handleResetFilters = () => {
    setFilters({
      status: '',
      paymentMethod: '',
      search: '',
      startDate: '',
      endDate: '',
    });
    setCurrentPage(1);
  };

  const formatAmount = (amount: number, currency: string): string => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-red-600'>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>暂无订单数据</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 统计卡片 */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div className='bg-white rounded-lg shadow p-4'>
          <div className='text-sm text-gray-600'>总订单数</div>
          <div className='text-2xl font-bold text-gray-900 mt-1'>
            {data.summary.total}
          </div>
        </div>
        <div className='bg-green-50 rounded-lg shadow p-4'>
          <div className='text-sm text-green-600'>已支付订单</div>
          <div className='text-2xl font-bold text-green-900 mt-1'>
            {data.summary.paidCount}
          </div>
          <div className='text-sm text-green-700 mt-1'>
            {formatAmount(data.summary.paidAmount, 'CNY')}
          </div>
        </div>
        <div className='bg-yellow-50 rounded-lg shadow p-4'>
          <div className='text-sm text-yellow-600'>待支付订单</div>
          <div className='text-2xl font-bold text-yellow-900 mt-1'>
            {data.summary.pendingCount}
          </div>
          <div className='text-sm text-yellow-700 mt-1'>
            {formatAmount(data.summary.pendingAmount, 'CNY')}
          </div>
        </div>
        <div className='bg-red-50 rounded-lg shadow p-4'>
          <div className='text-sm text-red-600'>失败订单</div>
          <div className='text-2xl font-bold text-red-900 mt-1'>
            {data.summary.failedCount}
          </div>
          <div className='text-sm text-red-700 mt-1'>
            {formatAmount(data.summary.failedAmount, 'CNY')}
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className='bg-white rounded-lg shadow p-6'>
        <form onSubmit={handleSearch} className='space-y-4'>
          <div className='flex flex-wrap gap-4'>
            <input
              type='text'
              placeholder='搜索订单号或用户邮箱'
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              className='flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <select
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={filters.paymentMethod}
              onChange={e =>
                handleFilterChange('paymentMethod', e.target.value)
              }
              className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {PAYMENT_METHOD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type='date'
              value={filters.startDate}
              onChange={e => handleFilterChange('startDate', e.target.value)}
              className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <input
              type='date'
              value={filters.endDate}
              onChange={e => handleFilterChange('endDate', e.target.value)}
              className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div className='flex gap-2'>
            <button
              type='submit'
              className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              搜索
            </button>
            <button
              type='button'
              onClick={handleResetFilters}
              className='px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500'
            >
              重置
            </button>
          </div>
        </form>
      </div>

      {/* 订单列表 */}
      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  订单号
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  用户
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  会员等级
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  支付方式
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  金额
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  状态
                </th>
                <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  创建时间
                </th>
                <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                  操作
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {data.orders.map(order => (
                <tr key={order.id} className='hover:bg-gray-50'>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono'>
                    {order.orderNo}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    <div>{order.userEmail}</div>
                    {order.userName && (
                      <div className='text-xs text-gray-400'>
                        {order.userName}
                      </div>
                    )}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {order.membershipTierName}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {PAYMENT_METHOD_LABELS[order.paymentMethod] ||
                      order.paymentMethod}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium'>
                    {formatAmount(order.amount, order.currency)}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm'>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[order.status] || ''
                      }`}
                    >
                      {STATUS_OPTIONS.find(opt => opt.value === order.status)
                        ?.label || order.status}
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                    {formatDate(order.createdAt)}
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className='text-blue-600 hover:text-blue-900'
                    >
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className='bg-gray-50 px-6 py-4 flex items-center justify-between'>
          <div className='text-sm text-gray-700'>
            共 {data.pagination.total} 条记录，第 {currentPage} /{' '}
            {data.pagination.totalPages} 页
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
              }}
              disabled={currentPage === 1}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              上一页
            </button>
            <button
              onClick={() => {
                setCurrentPage(p =>
                  Math.min(data.pagination.totalPages, p + 1)
                );
              }}
              disabled={currentPage === data.pagination.totalPages}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
