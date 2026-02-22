'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  ChevronRight,
} from 'lucide-react';

// ── 枚举映射 ────────────────────────────────────────────────
const REFUND_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'bg-yellow-100 text-yellow-700' },
  PROCESSING: { label: '处理中', color: 'bg-blue-100 text-blue-700' },
  SUCCESS: { label: '已退款', color: 'bg-green-100 text-green-700' },
  FAILED: { label: '退款失败', color: 'bg-red-100 text-red-600' },
  CANCELLED: { label: '已取消', color: 'bg-zinc-100 text-zinc-500' },
};

const REFUND_REASON_LABELS: Record<string, string> = {
  USER_REQUEST: '用户申请退款',
  SYSTEM_ERROR: '系统错误',
  DUPLICATE_PAYMENT: '重复付款',
  SERVICE_ISSUE: '服务问题',
  OTHER: '其他原因',
};

// ── 类型定义 ────────────────────────────────────────────────
interface Order {
  id: string;
  orderNo: string;
  amount: number;
  status: string;
  createdAt: string;
  membershipTier?: { name: string };
}

interface RefundRecord {
  id: string;
  orderId: string;
  amount: number;
  refundAmount: number;
  status: string;
  reason: string;
  appliedAt: string;
  currency?: string;
}

// ── 主组件 ────────────────────────────────────────────────
export default function RefundsPage() {
  const [tab, setTab] = useState<'apply' | 'history'>('apply');
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // 申请表单状态
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [reason, setReason] = useState('USER_REQUEST');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/orders?status=PAID&limit=20');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 获取订单失败`);
      }
      const data = await res.json();
      if (data.success) {
        setOrders(data.data?.orders ?? data.data ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取订单失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/refunds');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 获取退款记录失败`);
      }
      const data = await res.json();
      if (data.success) {
        setRefunds(data.data?.refunds ?? []);
      } else {
        setError(data.message || '获取退款记录失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取退款记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'apply') {
      fetchOrders();
    } else {
      fetchRefunds();
    }
  }, [tab, fetchOrders, fetchRefunds]);

  const handleApplyRefund = async (orderId: string) => {
    if (!description.trim() && reason === 'OTHER') {
      setError('请填写退款说明');
      return;
    }
    setSubmitting(orderId);
    setError(null);
    try {
      const res = await fetch('/api/refunds/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason, description }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 申请失败`);
      }
      const data = await res.json();
      if (data.success) {
        setSuccess('退款申请已提交，预计 3-5 个工作日处理');
        setShowForm(false);
        setSelectedOrder(null);
        fetchOrders();
      } else {
        setError(data.message || '申请失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '申请失败，请重试');
    } finally {
      setSubmitting(null);
    }
  };

  const openRefundForm = (orderId: string) => {
    setSelectedOrder(orderId);
    setShowForm(true);
    setReason('USER_REQUEST');
    setDescription('');
  };

  // ── 渲染 ────────────────────────────────────────────────
  return (
    <div className='min-h-screen bg-zinc-50'>
      <header className='border-b border-zinc-200 bg-white px-6 py-4'>
        <div className='mx-auto max-w-4xl flex items-center gap-3'>
          <RefreshCw className='h-6 w-6 text-blue-600' />
          <h1 className='text-xl font-semibold text-zinc-900'>退款管理</h1>
        </div>
      </header>

      <main className='mx-auto max-w-4xl px-6 py-6 space-y-5'>
        {/* 通知 */}
        {success && (
          <div className='flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm'>
            <CheckCircle className='h-4 w-4 shrink-0' /> {success}
            <button onClick={() => setSuccess(null)} className='ml-auto'>
              ✕
            </button>
          </div>
        )}
        {error && (
          <div className='flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm'>
            <AlertCircle className='h-4 w-4 shrink-0' /> {error}
            <button onClick={() => setError(null)} className='ml-auto'>
              ✕
            </button>
          </div>
        )}

        {/* 退款说明 */}
        <div className='bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800'>
          <p className='font-medium mb-1'>退款政策说明</p>
          <ul className='list-disc list-inside space-y-0.5 text-blue-700'>
            <li>已支付的订单在 7 天内可申请退款</li>
            <li>退款将原路返回至支付账户，3-5 个工作日到账</li>
            <li>已使用的会员权益将按比例扣除</li>
          </ul>
        </div>

        {/* Tabs */}
        <div className='flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit'>
          {(['apply', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setShowForm(false);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {t === 'apply' ? '申请退款' : '退款记录'}
            </button>
          ))}
        </div>

        {/* 内容 */}
        {loading ? (
          <div className='space-y-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className='bg-white rounded-xl border border-zinc-200 p-5 animate-pulse'
              >
                <div className='h-4 bg-zinc-200 rounded w-1/2 mb-3' />
                <div className='h-3 bg-zinc-100 rounded w-1/3' />
              </div>
            ))}
          </div>
        ) : tab === 'apply' ? (
          orders.length === 0 ? (
            <div className='bg-white rounded-xl border border-zinc-200 p-12 text-center'>
              <CreditCard className='h-12 w-12 text-zinc-300 mx-auto mb-4' />
              <p className='text-zinc-500 font-medium'>暂无可退款订单</p>
            </div>
          ) : (
            <div className='space-y-3'>
              {orders.map(order => (
                <div
                  key={order.id}
                  className='bg-white rounded-xl border border-zinc-200 p-5'
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div>
                      <div className='flex items-center gap-2 mb-1'>
                        <span className='font-medium text-zinc-900'>
                          订单 {order.orderNo}
                        </span>
                        <span className='text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700'>
                          已支付
                        </span>
                      </div>
                      <div className='text-sm text-zinc-500'>
                        {order.membershipTier?.name && (
                          <span>{order.membershipTier.name} · </span>
                        )}
                        ¥{order.amount} ·{' '}
                        {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <button
                      onClick={() => openRefundForm(order.id)}
                      className='flex items-center gap-1 px-3 py-1.5 border border-zinc-300 text-zinc-600 rounded-lg text-sm hover:bg-zinc-50 shrink-0'
                    >
                      申请退款 <ChevronRight className='h-3.5 w-3.5' />
                    </button>
                  </div>

                  {/* 退款表单 */}
                  {showForm && selectedOrder === order.id && (
                    <div className='mt-4 pt-4 border-t border-zinc-100 space-y-3'>
                      <div>
                        <label className='block text-sm font-medium text-zinc-700 mb-1'>
                          退款原因
                        </label>
                        <select
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                          className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                        >
                          {Object.entries(REFUND_REASON_LABELS).map(
                            ([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <div>
                        <label className='block text-sm font-medium text-zinc-700 mb-1'>
                          补充说明{' '}
                          {reason === 'OTHER' && (
                            <span className='text-red-500'>*</span>
                          )}
                        </label>
                        <textarea
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder='请描述退款原因...'
                          rows={3}
                          className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500'
                        />
                      </div>
                      <div className='flex gap-2 justify-end'>
                        <button
                          onClick={() => setShowForm(false)}
                          className='px-4 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50'
                        >
                          取消
                        </button>
                        <button
                          onClick={() => handleApplyRefund(order.id)}
                          disabled={submitting === order.id}
                          className='px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50'
                        >
                          {submitting === order.id ? '提交中...' : '确认申请'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : /* 退款记录 */
        refunds.length === 0 ? (
          <div className='bg-white rounded-xl border border-zinc-200 p-12 text-center'>
            <Clock className='h-12 w-12 text-zinc-300 mx-auto mb-4' />
            <p className='text-zinc-500 font-medium'>暂无退款记录</p>
          </div>
        ) : (
          <div className='space-y-3'>
            {refunds.map(refund => {
              const statusCfg =
                REFUND_STATUS[refund.status] ?? REFUND_STATUS.PENDING;
              return (
                <div
                  key={refund.id}
                  className='bg-white rounded-xl border border-zinc-200 p-5'
                >
                  <div className='flex items-start justify-between gap-4'>
                    <div>
                      <div className='flex items-center gap-2 mb-1'>
                        <span className='font-medium text-zinc-900'>
                          退款 ¥{refund.refundAmount}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusCfg.color}`}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className='text-sm text-zinc-500'>
                        {REFUND_REASON_LABELS[refund.reason] ?? refund.reason} ·{' '}
                        {new Date(refund.appliedAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    {refund.status === 'SUCCESS' && (
                      <CheckCircle className='h-5 w-5 text-green-500 shrink-0' />
                    )}
                    {refund.status === 'FAILED' && (
                      <XCircle className='h-5 w-5 text-red-400 shrink-0' />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
