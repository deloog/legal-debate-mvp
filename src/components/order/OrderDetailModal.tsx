'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X,
  RefreshCw,
  AlertCircle,
  FileText,
  Clock,
  CreditCard,
  CheckCircle,
} from 'lucide-react';
import { Order, OrderStatus, PaymentMethod } from '@/types/payment';

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
  onOrderUpdated: () => void;
  onRefresh?: () => void;
}

interface CancelOrderResponse {
  success: boolean;
  message: string;
  data?: Order;
  error?: string;
}

export function OrderDetailModal({
  order,
  onClose,
  onOrderUpdated,
  onRefresh,
}: OrderDetailModalProps) {
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!date) {
      return '-';
    }
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

  // 检查订单是否可以取消
  const canCancel = order.status === OrderStatus.PENDING;

  // 获取状态描述
  const getStatusDescription = (status: OrderStatus): string => {
    switch (status) {
      case OrderStatus.PENDING:
        return '订单待支付，请在过期时间内完成支付';
      case OrderStatus.PROCESSING:
        return '订单处理中，请稍后查看';
      case OrderStatus.PAID:
        return '订单已支付成功，会员权益已生效';
      case OrderStatus.FAILED:
        return '订单支付失败，请重新下单';
      case OrderStatus.CANCELLED:
        return '订单已取消';
      case OrderStatus.REFUNDED:
        return '订单已退款';
      case OrderStatus.EXPIRED:
        return '订单已过期';
      default:
        return '';
    }
  };

  // 取消订单
  const handleCancel = async (): Promise<void> => {
    if (!canCancel || isCancelling) {
      return;
    }

    if (
      !window.confirm(
        '确定要取消此订单吗？取消后无法恢复，如需购买请重新下单。'
      )
    ) {
      return;
    }

    try {
      setIsCancelling(true);
      setError(null);

      const response = await fetch(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
      });

      const data: CancelOrderResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '取消订单失败');
      }

      onOrderUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消订单失败');
    } finally {
      setIsCancelling(false);
    }
  };

  // 获取元数据信息
  const getMetadataInfo = (): Array<{ label: string; value: string }> => {
    const info: Array<{ label: string; value: string }> = [];
    const metadata = order.metadata as Record<string, unknown>;

    if (metadata.billingCycle) {
      const cycleMap: Record<string, string> = {
        MONTHLY: '月付',
        QUARTERLY: '季付',
        YEARLY: '年付',
        LIFETIME: '终身',
      };
      info.push({
        label: '计费周期',
        value: cycleMap[metadata.billingCycle as string] || '-',
      });
    }

    if (metadata.autoRenew) {
      info.push({
        label: '自动续费',
        value: metadata.autoRenew ? '是' : '否',
      });
    }

    return info;
  };

  return (
    <div
      className='fixed inset-0 z-50 overflow-y-auto'
      aria-labelledby='modal-title'
      role='dialog'
      aria-modal='true'
    >
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity'
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div className='flex min-h-screen items-center justify-center p-4'>
        <div className='relative z-10 mx-auto w-full max-w-2xl bg-white rounded-lg shadow-xl'>
          {/* 弹窗头部 */}
          <div className='flex items-center justify-between border-b border-gray-200 p-4'>
            <h3
              id='modal-title'
              className='text-xl font-semibold text-gray-900'
            >
              订单详情
            </h3>
            <button
              onClick={onClose}
              className='rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          {/* 弹窗主体 */}
          <div className='max-h-[70vh] overflow-y-auto p-4'>
            {/* 错误提示 */}
            {error && (
              <div className='mb-4 rounded-lg border border-red-200 bg-red-50 p-4'>
                <div className='flex items-start gap-3'>
                  <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-red-600' />
                  <div>
                    <h4 className='mb-1 font-semibold text-red-900'>
                      操作失败
                    </h4>
                    <p className='text-sm text-red-800'>{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 订单状态卡片 */}
            <div className='mb-4 rounded-lg border border-gray-200 p-4'>
              <div className='flex items-center justify-between mb-4'>
                <div className='flex items-center gap-3'>
                  <Badge
                    variant={getStatusBadgeVariant(order.status)}
                    className='text-sm'
                  >
                    {getStatusText(order.status)}
                  </Badge>
                  <span className='text-sm text-gray-600'>
                    {getStatusDescription(order.status)}
                  </span>
                </div>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={onRefresh || (() => window.location.reload())}
                >
                  <RefreshCw className='mr-2 h-4 w-4' />
                  刷新
                </Button>
              </div>
            </div>

            {/* 订单基本信息 */}
            <div className='mb-4 space-y-3'>
              <h4 className='font-semibold text-gray-900'>基本信息</h4>
              <div className='grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2'>
                <div>
                  <div className='text-xs uppercase tracking-wider text-gray-500'>
                    订单号
                  </div>
                  <div className='mt-1 font-mono text-sm font-medium text-gray-900'>
                    {order.orderNo}
                  </div>
                </div>
                <div>
                  <div className='text-xs uppercase tracking-wider text-gray-500'>
                    创建时间
                  </div>
                  <div className='mt-1 text-sm font-medium text-gray-900'>
                    {formatDate(order.createdAt)}
                  </div>
                </div>
                <div>
                  <div className='text-xs uppercase tracking-wider text-gray-500'>
                    支付时间
                  </div>
                  <div className='mt-1 text-sm font-medium text-gray-900'>
                    {order.paidAt ? formatDate(order.paidAt) : '-'}
                  </div>
                </div>
                <div>
                  <div className='text-xs uppercase tracking-wider text-gray-500'>
                    过期时间
                  </div>
                  <div className='mt-1 text-sm font-medium text-gray-900'>
                    {formatDate(order.expiredAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* 订单金额信息 */}
            <div className='mb-4 space-y-3'>
              <h4 className='font-semibold text-gray-900'>金额信息</h4>
              <div className='grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2'>
                <div>
                  <div className='text-xs uppercase tracking-wider text-gray-500'>
                    订单金额
                  </div>
                  <div className='mt-1 text-xl font-bold text-gray-900'>
                    {formatAmount(order.amount)}
                  </div>
                </div>
                <div>
                  <div className='text-xs uppercase tracking-wider text-gray-500'>
                    货币
                  </div>
                  <div className='mt-1 text-sm font-medium text-gray-900'>
                    {order.currency}
                  </div>
                </div>
              </div>
            </div>

            {/* 支付信息 */}
            <div className='mb-4 space-y-3'>
              <h4 className='font-semibold text-gray-900'>支付信息</h4>
              <div className='grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2'>
                <div>
                  <div className='flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500'>
                    <CreditCard className='h-4 w-4' />
                    支付方式
                  </div>
                  <div className='mt-1 text-sm font-medium text-gray-900'>
                    {getPaymentMethodText(order.paymentMethod)}
                  </div>
                </div>
                <div>
                  <div className='text-xs uppercase tracking-wider text-gray-500'>
                    订单状态
                  </div>
                  <div className='mt-1'>
                    <Badge variant={getStatusBadgeVariant(order.status)}>
                      {getStatusText(order.status)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* 会员信息 */}
            {order.membershipTier && (
              <div className='mb-4 space-y-3'>
                <h4 className='font-semibold text-gray-900'>会员信息</h4>
                <div className='grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2'>
                  <div>
                    <div className='text-xs uppercase tracking-wider text-gray-500'>
                      会员等级
                    </div>
                    <div className='mt-1 text-sm font-medium text-gray-900'>
                      {order.membershipTier.displayName ||
                        order.membershipTier.name}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs uppercase tracking-wider text-gray-500'>
                      等级代码
                    </div>
                    <div className='mt-1 text-sm font-medium text-gray-900'>
                      {order.membershipTier.tier}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 订单描述 */}
            {order.description && (
              <div className='mb-4 space-y-3'>
                <h4 className='font-semibold text-gray-900'>订单描述</h4>
                <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
                  <div className='flex items-start gap-3'>
                    <FileText className='mt-0.5 h-4 w-4 shrink-0 text-gray-400' />
                    <p className='text-sm text-gray-900'>{order.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 元数据信息 */}
            {getMetadataInfo().length > 0 && (
              <div className='mb-4 space-y-3'>
                <h4 className='font-semibold text-gray-900'>附加信息</h4>
                <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
                  <div className='space-y-2'>
                    {getMetadataInfo().map((item, index) => (
                      <div key={index} className='grid grid-cols-2 gap-2'>
                        <div className='text-xs uppercase tracking-wider text-gray-500'>
                          {item.label}
                        </div>
                        <div className='text-sm font-medium text-gray-900'>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 支付记录 */}
            {order.paymentRecords && order.paymentRecords.length > 0 && (
              <div className='mb-4 space-y-3'>
                <h4 className='font-semibold text-gray-900'>支付记录</h4>
                <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
                  {order.paymentRecords.map((record, index) => (
                    <div
                      key={index}
                      className={`border-b border-gray-200 pb-2 ${index === (order.paymentRecords?.length ?? 0) - 1 ? 'border-b-0' : ''}`}
                    >
                      <div className='grid gap-2 sm:grid-cols-2'>
                        <div>
                          <div className='text-xs text-gray-500'>支付方式</div>
                          <div className='text-sm font-medium text-gray-900'>
                            {getPaymentMethodText(record.paymentMethod)}
                          </div>
                        </div>
                        <div>
                          <div className='text-xs text-gray-500'>支付状态</div>
                          <div className='mt-1'>
                            <Badge
                              variant={getStatusBadgeVariant(
                                record.status as unknown as OrderStatus
                              )}
                            >
                              {getStatusText(
                                record.status as unknown as OrderStatus
                              )}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {record.transactionId && (
                        <div className='mt-2 text-xs text-gray-600'>
                          交易ID: {record.transactionId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 失败原因 */}
            {order.failedReason && (
              <div className='mb-4 space-y-3'>
                <h4 className='font-semibold text-gray-900'>失败原因</h4>
                <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
                  <div className='flex items-start gap-3'>
                    <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-red-600' />
                    <div className='text-sm text-red-900'>
                      {order.failedReason}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 弹窗底部 */}
          <div className='flex items-center justify-between border-t border-gray-200 p-4'>
            <div className='text-sm text-gray-600'>
              <div className='flex items-center gap-2'>
                <Clock className='h-4 w-4' />
                <span>订单创建于 {formatDate(order.createdAt)}</span>
              </div>
            </div>
            <div className='flex gap-3'>
              <Button onClick={onClose} variant='outline'>
                关闭
              </Button>
              {canCancel && (
                <Button
                  onClick={() => void handleCancel()}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <RefreshCw className='mr-2 h-4 w-4 animate-spin' />
                      取消中...
                    </>
                  ) : (
                    <>
                      <CheckCircle className='mr-2 h-4 w-4' />
                      取消订单
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
