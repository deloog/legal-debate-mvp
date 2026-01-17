'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  ArrowUpDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Order, OrderStatus, PaymentMethod } from '@/types/payment';
import { OrderDetailModal } from '@/components/order/OrderDetailModal';

interface OrderListProps {
  userId: string;
}

interface OrderListResponse {
  success: boolean;
  message: string;
  data?: {
    orders: Order[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

interface Filters {
  status?: OrderStatus;
  search: string;
  sortBy: 'createdAt' | 'updatedAt' | 'amount' | 'paidAt';
  sortOrder: 'asc' | 'desc';
  page: number;
  limit: number;
}

export function OrderList({ userId }: OrderListProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // 筛选和排序状态
  const [filters, setFilters] = useState<Filters>({
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 10,
  });

  // 加载订单列表
  const loadOrders = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.status) {
        params.set('status', filters.status);
      }
      params.set('page', filters.page.toString());
      params.set('limit', filters.limit.toString());
      params.set('sortBy', filters.sortBy);
      params.set('sortOrder', filters.sortOrder);

      const response = await fetch(
        `/api/orders?${params.toString()}&userId=${userId}`
      );
      const data: OrderListResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '加载订单失败');
      }

      setOrders(data.data?.orders || []);
      setTotal(data.data?.pagination.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载订单失败');
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  // 初始加载和筛选变化时重新加载
  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // 获取状态标签样式
  const getStatusBadgeVariant = (
    status: OrderStatus
  ): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case OrderStatus.PAID:
        return 'default';
      case OrderStatus.PENDING:
        return 'secondary';
      case OrderStatus.CANCELLED:
      case OrderStatus.FAILED:
      case OrderStatus.EXPIRED:
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // 获取状态显示文本
  const getStatusText = (status: OrderStatus): string => {
    switch (status) {
      case OrderStatus.PENDING:
        return '待支付';
      case OrderStatus.PROCESSING:
        return '处理中';
      case OrderStatus.PAID:
        return '已支付';
      case OrderStatus.FAILED:
        return '支付失败';
      case OrderStatus.CANCELLED:
        return '已取消';
      case OrderStatus.REFUNDED:
        return '已退款';
      case OrderStatus.EXPIRED:
        return '已过期';
      default:
        return '未知状态';
    }
  };

  // 获取支付方式显示文本
  const getPaymentMethodText = (method: PaymentMethod): string => {
    switch (method) {
      case PaymentMethod.WECHAT:
        return '微信支付';
      case PaymentMethod.ALIPAY:
        return '支付宝';
      case PaymentMethod.BALANCE:
        return '余额支付';
      default:
        return '未知';
    }
  };

  // 格式化日期
  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 格式化金额
  const formatAmount = (amount: number): string => {
    return `¥${amount.toFixed(2)}`;
  };

  // 处理状态筛选变化
  const handleStatusChange = (status?: OrderStatus): void => {
    setFilters(prev => ({ ...prev, status, page: 1 }));
  };

  // 处理搜索
  const handleSearch = (value: string): void => {
    setFilters(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 处理排序变化
  const handleSort = (field: Filters['sortBy']): void => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder:
        prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  // 处理分页变化
  const handlePageChange = (page: number): void => {
    setFilters(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 本地筛选（搜索功能）
  const filteredOrders = orders.filter(order => {
    if (!filters.search) {
      return true;
    }
    const searchLower = filters.search.toLowerCase();
    return (
      order.orderNo.toLowerCase().includes(searchLower) ||
      order.description.toLowerCase().includes(searchLower)
    );
  });

  // 计算总页数
  const totalPages = Math.ceil(total / filters.limit);

  return (
    <div className='space-y-4'>
      {/* 工具栏 */}
      <Card>
        <div className='flex flex-wrap gap-3 p-4'>
          {/* 搜索框 */}
          <div className='relative flex-1 min-w-50'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
            <input
              type='text'
              placeholder='搜索订单号或描述'
              value={filters.search}
              onChange={e => handleSearch(e.target.value)}
              className='w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
            />
          </div>

          {/* 状态筛选 */}
          <select
            value={filters.status || ''}
            onChange={e =>
              handleStatusChange(
                e.target.value ? (e.target.value as OrderStatus) : undefined
              )
            }
            className='rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
          >
            <option value=''>全部状态</option>
            <option value={OrderStatus.PENDING}>待支付</option>
            <option value={OrderStatus.PROCESSING}>处理中</option>
            <option value={OrderStatus.PAID}>已支付</option>
            <option value={OrderStatus.FAILED}>支付失败</option>
            <option value={OrderStatus.CANCELLED}>已取消</option>
            <option value={OrderStatus.REFUNDED}>已退款</option>
            <option value={OrderStatus.EXPIRED}>已过期</option>
          </select>

          {/* 排序按钮 */}
          <div className='flex items-center gap-2'>
            <ArrowUpDown className='h-4 w-4 text-gray-400' />
            <select
              value={filters.sortBy}
              onChange={e => handleSort(e.target.value as Filters['sortBy'])}
              className='rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
            >
              <option value='createdAt'>创建时间</option>
              <option value='updatedAt'>更新时间</option>
              <option value='amount'>金额</option>
              <option value='paidAt'>支付时间</option>
            </select>
          </div>

          {/* 刷新按钮 */}
          <Button onClick={() => void loadOrders()} variant='outline'>
            刷新
          </Button>
        </div>
      </Card>

      {/* 加载状态 */}
      {loading ? (
        <Card>
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin text-blue-600' />
            <span className='ml-3 text-sm text-gray-600'>加载中...</span>
          </div>
        </Card>
      ) : (
        /* 订单列表 */
        <>
          {/* 错误提示 */}
          {error && (
            <Card>
              <div className='flex items-center justify-between border border-red-200 bg-red-50 p-4 text-red-800'>
                <span className='text-sm'>{error}</span>
                <Button onClick={() => void loadOrders()} size='sm'>
                  重试
                </Button>
              </div>
            </Card>
          )}

          {/* 空状态 */}
          {filteredOrders.length === 0 && !error && (
            <Card>
              <div className='flex flex-col items-center justify-center py-12 text-gray-500'>
                <FileText className='mb-3 h-16 w-16' />
                <p className='text-sm'>
                  {filters.search ? '未找到匹配的订单' : '暂无订单记录'}
                </p>
                <Button
                  onClick={() => (window.location.href = '/membership')}
                  className='mt-4'
                  variant='outline'
                >
                  去开通会员
                </Button>
              </div>
            </Card>
          )}

          {/* 订单列表 */}
          {filteredOrders.length > 0 && (
            <Card>
              <div className='overflow-x-auto'>
                <table className='w-full min-w-150'>
                  <thead>
                    <tr className='border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500'>
                      <th className='px-4 py-3'>订单号</th>
                      <th className='px-4 py-3'>创建时间</th>
                      <th className='px-4 py-3'>金额</th>
                      <th className='px-4 py-3'>支付方式</th>
                      <th className='px-4 py-3'>状态</th>
                      <th className='px-4 py-3 text-right'>操作</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-200'>
                    {filteredOrders.map(order => (
                      <tr
                        key={order.id}
                        className='cursor-pointer hover:bg-gray-50 transition-colors'
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td className='px-4 py-3'>
                          <div className='font-mono text-sm text-gray-900'>
                            {order.orderNo}
                          </div>
                          {order.description && (
                            <div className='mt-1 text-xs text-gray-500'>
                              {order.description}
                            </div>
                          )}
                        </td>
                        <td className='px-4 py-3 text-sm text-gray-600'>
                          {formatDate(order.createdAt)}
                        </td>
                        <td className='px-4 py-3 text-sm font-semibold text-gray-900'>
                          {formatAmount(order.amount)}
                        </td>
                        <td className='px-4 py-3 text-sm text-gray-600'>
                          {getPaymentMethodText(order.paymentMethod)}
                        </td>
                        <td className='px-4 py-3'>
                          <Badge variant={getStatusBadgeVariant(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                        </td>
                        <td className='px-4 py-3 text-right'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                          >
                            查看
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className='flex items-center justify-between border-t border-gray-200 px-4 py-3'>
                  <div className='text-sm text-gray-600'>
                    共 {total} 条记录，第 {filters.page} / {totalPages} 页
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handlePageChange(filters.page - 1)}
                      disabled={filters.page <= 1}
                    >
                      <ChevronLeft className='h-4 w-4' />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }).map(
                      (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (filters.page <= 3) {
                          pageNum = i + 1;
                        } else if (filters.page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = filters.page - 2 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            size='sm'
                            variant={
                              pageNum === filters.page ? 'default' : 'outline'
                            }
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      }
                    )}
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handlePageChange(filters.page + 1)}
                      disabled={filters.page >= totalPages}
                    >
                      <ChevronRight className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* 订单详情弹窗 */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={() => void loadOrders()}
          onRefresh={() => void loadOrders()}
        />
      )}
    </div>
  );
}
