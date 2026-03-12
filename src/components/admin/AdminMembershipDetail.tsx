'use client';

import { useState, useEffect } from 'react';

// =============================================================================
// 类型定义
// =============================================================================

interface MembershipDetail {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  tierName: string;
  tierDisplayName: string;
  status: string;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  pausedAt: Date | null;
  pausedReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Props {
  membershipId: string;
  onClose: () => void;
}

// =============================================================================
// 辅助常量
// =============================================================================

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-600 bg-green-50',
  EXPIRED: 'text-red-600 bg-red-50',
  CANCELLED: 'text-gray-600 bg-gray-50',
  SUSPENDED: 'text-yellow-600 bg-yellow-50',
  PENDING: 'text-blue-600 bg-blue-50',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '生效中',
  EXPIRED: '已过期',
  CANCELLED: '已取消',
  SUSPENDED: '已暂停',
  PENDING: '待生效',
};

// =============================================================================
// 组件
// =============================================================================

export function AdminMembershipDetail({
  membershipId,
  onClose,
}: Props): React.ReactElement | null {
  const [membership, setMembership] = useState<MembershipDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembershipDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/memberships/${membershipId}`);
        if (!response.ok) {
          throw new Error('获取会员详情失败');
        }
        const result = await response.json();
        setMembership(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    if (membershipId) {
      fetchMembershipDetail();
    }
  }, [membershipId]);

  if (loading) {
    return (
      <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
        <div className='bg-white rounded-lg p-6 w-full max-w-md'>
          <div className='flex items-center justify-center'>
            <div className='text-gray-600'>加载中...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
        <div className='bg-white rounded-lg p-6 w-full max-w-md'>
          <div className='text-red-600 text-center mb-4'>{error}</div>
          <button
            onClick={onClose}
            className='w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300'
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  if (!membership) {
    return null;
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-xl font-bold text-gray-900'>会员详情</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 text-2xl'
          >
            ×
          </button>
        </div>

        <div className='space-y-6'>
          {/* 状态标签 */}
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-lg font-semibold text-gray-900'>
                {membership.tierDisplayName}
              </h3>
              <p className='text-sm text-gray-500'>
                {membership.userName || membership.userEmail}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                STATUS_COLORS[membership.status] || 'text-gray-600'
              }`}
            >
              {STATUS_LABELS[membership.status] || membership.status}
            </span>
          </div>

          {/* 基本信息 */}
          <div className='border-t pt-4'>
            <h4 className='text-sm font-medium text-gray-900 mb-3'>基本信息</h4>
            <dl className='grid grid-cols-1 gap-4 text-sm'>
              <div className='grid grid-cols-2'>
                <dt className='text-gray-500'>会员ID</dt>
                <dd className='text-gray-900'>{membership.id}</dd>
              </div>
              <div className='grid grid-cols-2'>
                <dt className='text-gray-500'>用户ID</dt>
                <dd className='text-gray-900'>{membership.userId}</dd>
              </div>
              <div className='grid grid-cols-2'>
                <dt className='text-gray-500'>邮箱</dt>
                <dd className='text-gray-900'>{membership.userEmail}</dd>
              </div>
              <div className='grid grid-cols-2'>
                <dt className='text-gray-500'>等级类型</dt>
                <dd className='text-gray-900'>{membership.tierName}</dd>
              </div>
            </dl>
          </div>

          {/* 订阅信息 */}
          <div className='border-t pt-4'>
            <h4 className='text-sm font-medium text-gray-900 mb-3'>订阅信息</h4>
            <dl className='grid grid-cols-1 gap-4 text-sm'>
              <div className='grid grid-cols-2'>
                <dt className='text-gray-500'>开始日期</dt>
                <dd className='text-gray-900'>
                  {new Date(membership.startDate).toLocaleDateString('zh-CN')}
                </dd>
              </div>
              <div className='grid grid-cols-2'>
                <dt className='text-gray-500'>结束日期</dt>
                <dd className='text-gray-900'>
                  {new Date(membership.endDate).toLocaleDateString('zh-CN')}
                </dd>
              </div>
              <div className='grid grid-cols-2'>
                <dt className='text-gray-500'>自动续费</dt>
                <dd className='text-gray-900'>
                  {membership.autoRenew ? '是' : '否'}
                </dd>
              </div>
              {membership.cancelledAt && (
                <div className='grid grid-cols-2'>
                  <dt className='text-gray-500'>取消时间</dt>
                  <dd className='text-gray-900'>
                    {new Date(membership.cancelledAt).toLocaleDateString(
                      'zh-CN'
                    )}
                  </dd>
                </div>
              )}
              {membership.cancelledReason && (
                <div className='grid grid-cols-2'>
                  <dt className='text-gray-500'>取消原因</dt>
                  <dd className='text-gray-900'>
                    {membership.cancelledReason}
                  </dd>
                </div>
              )}
              {membership.pausedAt && (
                <div className='grid grid-cols-2'>
                  <dt className='text-gray-500'>暂停时间</dt>
                  <dd className='text-gray-900'>
                    {new Date(membership.pausedAt).toLocaleDateString('zh-CN')}
                  </dd>
                </div>
              )}
              {membership.pausedReason && (
                <div className='grid grid-cols-2'>
                  <dt className='text-gray-500'>暂停原因</dt>
                  <dd className='text-gray-900'>{membership.pausedReason}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* 备注 */}
          {membership.notes && (
            <div className='border-t pt-4'>
              <h4 className='text-sm font-medium text-gray-900 mb-3'>备注</h4>
              <p className='text-sm text-gray-700'>{membership.notes}</p>
            </div>
          )}

          {/* 时间戳 */}
          <div className='border-t pt-4'>
            <h4 className='text-sm font-medium text-gray-900 mb-3'>时间戳</h4>
            <dl className='grid grid-cols-1 gap-4 text-sm'>
              <div className='grid grid-cols-2'>
                <dt className='text-gray-500'>创建时间</dt>
                <dd className='text-gray-900'>
                  {new Date(membership.createdAt).toLocaleString('zh-CN')}
                </dd>
              </div>
              <div className='grid grid-cols-2'>
                <dt className='text-gray-500'>更新时间</dt>
                <dd className='text-gray-900'>
                  {new Date(membership.updatedAt).toLocaleString('zh-CN')}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className='mt-6 flex justify-end'>
          <button
            onClick={onClose}
            className='px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300'
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
