'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface OrderDetail {
  id: string;
  orderNo: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  userPhone: string | null;
  membershipTierName: string;
  membershipTierPrice: number;
  paymentMethod: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  expiredAt: string;
  paidAt: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  userMemberships: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    tierName: string;
  }>;
  paymentRecords: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    status: string;
    transactionId: string | null;
    thirdPartyOrderNo: string | null;
    createdAt: string;
  }>;
  refundRecords: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string | null;
    createdAt: string;
  }>;
  invoices: Array<{
    id: string;
    title: string | null;
    status: string;
    amount: number;
    issuedAt: string | null;
    createdAt: string;
  }>;
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: '待支付' },
  { value: 'PAID', label: '已支付' },
  { value: 'FAILED', label: '支付失败' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'REFUNDED', label: '已退款' },
  { value: 'EXPIRED', label: '已过期' },
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

export function AdminOrderDetail(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [paidAt, setPaidAt] = useState<string>('');
  const [failedReason, setFailedReason] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const loadOrderDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`);
      if (!response.ok) {
        throw new Error('获取订单详情失败');
      }

      const result = await response.json();
      setData(result.data);
      setNewStatus(result.data.status);
      setPaidAt(result.data.paidAt ? result.data.paidAt.split('T')[0] : '');
      setFailedReason(result.data.failedReason || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      loadOrderDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleUpdateStatus = async () => {
    setSaving(true);
    try {
      const updateData: {
        status: string;
        paidAt?: string;
        failedReason?: string;
      } = {
        status: newStatus,
      };

      if (paidAt) {
        updateData.paidAt = paidAt;
      }

      if (failedReason) {
        updateData.failedReason = failedReason;
      }

      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('更新订单状态失败');
      }

      await loadOrderDetail();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (data) {
      setNewStatus(data.status);
      setPaidAt(data.paidAt ? data.paidAt.split('T')[0] : '');
      setFailedReason(data.failedReason || '');
    }
    setIsEditing(false);
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
        <div className='text-gray-600'>订单不存在</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-2xl font-bold text-gray-900'>订单详情</h2>
          <button
            onClick={() => {
              router.back();
            }}
            className='px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700'
          >
            返回
          </button>
        </div>

        {/* 订单基本信息 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
          <div>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              订单信息
            </h3>
            <div className='space-y-3'>
              <div>
                <div className='text-sm text-gray-600'>订单号</div>
                <div className='text-sm font-mono text-gray-900'>
                  {data.orderNo}
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-600'>会员等级</div>
                <div className='text-sm text-gray-900'>
                  {data.membershipTierName}
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-600'>支付方式</div>
                <div className='text-sm text-gray-900'>
                  {PAYMENT_METHOD_LABELS[data.paymentMethod] ||
                    data.paymentMethod}
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-600'>订单金额</div>
                <div className='text-sm font-medium text-gray-900'>
                  {formatAmount(data.amount, data.currency)}
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-600'>订单描述</div>
                <div className='text-sm text-gray-900'>
                  {data.description || '-'}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              订单状态
            </h3>
            <div className='space-y-3'>
              <div>
                <div className='text-sm text-gray-600'>当前状态</div>
                <div className='text-sm'>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      STATUS_COLORS[data.status] || ''
                    }`}
                  >
                    {STATUS_OPTIONS.find(opt => opt.value === data.status)
                      ?.label || data.status}
                  </span>
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-600'>创建时间</div>
                <div className='text-sm text-gray-900'>
                  {formatDate(data.createdAt)}
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-600'>过期时间</div>
                <div className='text-sm text-gray-900'>
                  {formatDate(data.expiredAt)}
                </div>
              </div>
              {data.paidAt && (
                <div>
                  <div className='text-sm text-gray-600'>支付时间</div>
                  <div className='text-sm text-gray-900'>
                    {formatDate(data.paidAt)}
                  </div>
                </div>
              )}
              {data.failedReason && (
                <div>
                  <div className='text-sm text-gray-600'>失败原因</div>
                  <div className='text-sm text-red-600'>
                    {data.failedReason}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 用户信息 */}
        <div className='border-t pt-6 mb-8'>
          <h3 className='text-lg font-semibold text-gray-900 mb-4'>用户信息</h3>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <div className='text-sm text-gray-600'>用户邮箱</div>
              <div className='text-sm text-gray-900'>{data.userEmail}</div>
            </div>
            <div>
              <div className='text-sm text-gray-600'>用户姓名</div>
              <div className='text-sm text-gray-900'>
                {data.userName || '-'}
              </div>
            </div>
            <div>
              <div className='text-sm text-gray-600'>手机号码</div>
              <div className='text-sm text-gray-900'>
                {data.userPhone || '-'}
              </div>
            </div>
          </div>
        </div>

        {/* 编辑状态 */}
        <div className='border-t pt-6 mb-8'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900'>
              修改订单状态
            </h3>
            {!isEditing && (
              <button
                onClick={() => {
                  setIsEditing(true);
                }}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
              >
                编辑状态
              </button>
            )}
          </div>

          {isEditing ? (
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  订单状态
                </label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {newStatus === 'PAID' && (
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    支付时间
                  </label>
                  <input
                    type='date'
                    value={paidAt}
                    onChange={e => setPaidAt(e.target.value)}
                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
              )}

              {newStatus === 'FAILED' && (
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    失败原因
                  </label>
                  <textarea
                    value={failedReason}
                    onChange={e => setFailedReason(e.target.value)}
                    rows={3}
                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                    placeholder='请输入失败原因'
                  />
                </div>
              )}

              <div className='flex gap-2'>
                <button
                  onClick={handleUpdateStatus}
                  disabled={saving}
                  className='px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className='px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className='text-sm text-gray-600'>
              点击<strong>编辑状态</strong>按钮修改订单状态
            </div>
          )}
        </div>
      </div>

      {/* 关联记录 */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* 支付记录 */}
        {data.paymentRecords.length > 0 && (
          <div className='bg-white rounded-lg shadow p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              支付记录
            </h3>
            <div className='space-y-3'>
              {data.paymentRecords.map(record => (
                <div key={record.id} className='border rounded-lg p-4'>
                  <div className='flex justify-between items-center mb-2'>
                    <span className='text-sm font-medium text-gray-900'>
                      {formatAmount(record.amount, data.currency)}
                    </span>
                    <span className='text-sm text-gray-600'>
                      {PAYMENT_METHOD_LABELS[record.paymentMethod] ||
                        record.paymentMethod}
                    </span>
                  </div>
                  <div className='text-sm text-gray-600 mb-1'>
                    状态: {record.status}
                  </div>
                  {record.transactionId && (
                    <div className='text-sm text-gray-600 mb-1'>
                      交易号: {record.transactionId}
                    </div>
                  )}
                  {record.thirdPartyOrderNo && (
                    <div className='text-sm text-gray-600 mb-1'>
                      第三方订单号: {record.thirdPartyOrderNo}
                    </div>
                  )}
                  <div className='text-xs text-gray-500'>
                    {formatDate(record.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 退款记录 */}
        {data.refundRecords.length > 0 && (
          <div className='bg-white rounded-lg shadow p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              退款记录
            </h3>
            <div className='space-y-3'>
              {data.refundRecords.map(record => (
                <div key={record.id} className='border rounded-lg p-4'>
                  <div className='flex justify-between items-center mb-2'>
                    <span className='text-sm font-medium text-gray-900'>
                      {formatAmount(record.amount, data.currency)}
                    </span>
                    <span className='text-sm text-gray-600'>
                      {record.status}
                    </span>
                  </div>
                  {record.reason && (
                    <div className='text-sm text-gray-600 mb-1'>
                      原因: {record.reason}
                    </div>
                  )}
                  <div className='text-xs text-gray-500'>
                    {formatDate(record.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 发票记录 */}
        {data.invoices.length > 0 && (
          <div className='bg-white rounded-lg shadow p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              发票记录
            </h3>
            <div className='space-y-3'>
              {data.invoices.map(invoice => (
                <div key={invoice.id} className='border rounded-lg p-4'>
                  <div className='flex justify-between items-center mb-2'>
                    <span className='text-sm font-medium text-gray-900'>
                      {invoice.title || '未设置抬头'}
                    </span>
                    <span className='text-sm text-gray-600'>
                      {invoice.status}
                    </span>
                  </div>
                  <div className='text-sm text-gray-600 mb-1'>
                    金额: {formatAmount(invoice.amount, data.currency)}
                  </div>
                  {invoice.issuedAt && (
                    <div className='text-sm text-gray-600 mb-1'>
                      开具时间: {formatDate(invoice.issuedAt)}
                    </div>
                  )}
                  <div className='text-xs text-gray-500'>
                    {formatDate(invoice.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 会员信息 */}
        {data.userMemberships.length > 0 && (
          <div className='bg-white rounded-lg shadow p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              用户会员信息
            </h3>
            <div className='space-y-3'>
              {data.userMemberships.map(membership => (
                <div key={membership.id} className='border rounded-lg p-4'>
                  <div className='flex justify-between items-center mb-2'>
                    <span className='text-sm font-medium text-gray-900'>
                      {membership.tierName}
                    </span>
                    <span className='text-sm text-gray-600'>
                      {membership.status}
                    </span>
                  </div>
                  <div className='text-sm text-gray-600 mb-1'>
                    开始时间: {formatDate(membership.startDate)}
                  </div>
                  <div className='text-sm text-gray-600 mb-1'>
                    结束时间: {formatDate(membership.endDate)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
