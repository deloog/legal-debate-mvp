'use client';

/**
 * 会员编辑模态框组件
 * 管理员可编辑会员等级、状态、有效期、备注等信息
 */

import React, { useState } from 'react';

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
  detail: MembershipDetail;
  onClose: () => void;
  onUpdate: (updatedData: unknown) => void;
}

interface EditFormData {
  tierId: string;
  status: string;
  endDate: string;
  autoRenew: boolean;
  notes: string;
  pausedReason: string;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 格式化日期为YYYY-MM-DD
 */
function formatDateForInput(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * 获取状态显示文本
 */
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    ACTIVE: '生效中',
    EXPIRED: '已过期',
    CANCELLED: '已取消',
    SUSPENDED: '已暂停',
    PENDING: '待生效',
  };
  return statusMap[status] || status;
}

/**
 * 获取状态颜色类名
 */
function getStatusColorClass(status: string): string {
  const colorMap: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    SUSPENDED: 'bg-yellow-100 text-yellow-800',
    PENDING: 'bg-blue-100 text-blue-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

// =============================================================================
// 主组件
// =============================================================================

export function AdminMembershipEditModal({
  membershipId,
  detail,
  onClose,
  onUpdate,
}: Props) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [formData, setFormData] = useState<EditFormData>({
    tierId: detail.tierName || '',
    status: detail.status || '',
    endDate: formatDateForInput(detail.endDate),
    autoRenew: detail.autoRenew || false,
    notes: detail.notes || '',
    pausedReason: detail.pausedReason || '',
  });

  // 处理表单输入变化
  function handleInputChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ): void {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]:
        name === 'autoRenew'
          ? (event.target as HTMLInputElement).checked
          : value,
    }));
  }

  // 提交表单
  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/memberships/${membershipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        onUpdate(result.data);
        onClose();
      } else {
        setError(result.message || '更新会员信息失败');
      }
    } catch (err) {
      setError('更新会员信息失败');
      console.error('更新会员信息失败:', err);
    } finally {
      setLoading(false);
    }
  }

  // 处理状态变更（暂停/恢复快捷操作）
  function handleStatusChange(newStatus: string): void {
    setFormData(prev => ({
      ...prev,
      status: newStatus,
    }));
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col'>
        {/* 头部 */}
        <div className='p-6 border-b border-gray-200 flex justify-between items-center'>
          <div>
            <h2 className='text-xl font-semibold text-gray-900'>
              编辑会员信息
            </h2>
            <p className='text-sm text-gray-600 mt-1'>会员ID: {detail.id}</p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 transition-colors'
            aria-label='关闭'
          >
            <svg
              className='h-6 w-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className='flex-1 overflow-y-auto p-6'>
          {error && (
            <div className='mb-4 p-4 bg-red-50 border border-red-200 rounded-md'>
              <p className='text-red-800'>{error}</p>
            </div>
          )}

          {/* 用户信息卡片 */}
          <div className='bg-gray-50 rounded-lg p-4 mb-4'>
            <h3 className='text-sm font-medium text-gray-900 mb-3'>用户信息</h3>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm text-gray-600'>邮箱</p>
                <p className='text-sm font-medium text-gray-900'>
                  {detail.userEmail}
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>用户名</p>
                <p className='text-sm font-medium text-gray-900'>
                  {detail.userName || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* 当前状态卡片 */}
          <div className='bg-gray-50 rounded-lg p-4 mb-4'>
            <h3 className='text-sm font-medium text-gray-900 mb-3'>当前状态</h3>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                <span className='text-sm text-gray-600'>当前状态：</span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${getStatusColorClass(
                    detail.status
                  )}`}
                >
                  {getStatusText(detail.status)}
                </span>
              </div>
              <div>
                <p className='text-sm text-gray-600'>有效期：</p>
                <p className='text-sm font-medium text-gray-900'>
                  {new Date(detail.endDate).toLocaleDateString('zh-CN')}
                </p>
              </div>
              <div>
                <p className='text-sm text-gray-600'>自动续费：</p>
                <p className='text-sm font-medium text-gray-900'>
                  {detail.autoRenew ? '是' : '否'}
                </p>
              </div>
            </div>
          </div>

          {/* 编辑表单 */}
          <form onSubmit={handleSubmit}>
            <div className='bg-gray-50 rounded-lg p-4 mb-4'>
              <h3 className='text-sm font-medium text-gray-900 mb-3'>
                编辑选项
              </h3>

              {/* 会员等级 */}
              <div className='mb-4'>
                <label
                  htmlFor='tierId'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  会员等级
                </label>
                <select
                  id='tierId'
                  name='tierId'
                  value={formData.tierId}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm'
                  required
                >
                  <option value=''>选择等级...</option>
                  <option value='FREE'>免费版 - ¥0/月</option>
                  <option value='BASIC'>基础版 - ¥99/月</option>
                  <option value='PROFESSIONAL'>专业版 - ¥299/月</option>
                  <option value='ENTERPRISE'>企业版 - ¥999/月</option>
                </select>
              </div>

              {/* 状态选择 */}
              <div className='mb-4'>
                <label
                  htmlFor='status'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  会员状态
                </label>
                <select
                  id='status'
                  name='status'
                  value={formData.status}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm'
                  required
                >
                  <option value=''>选择状态...</option>
                  <option value='ACTIVE'>生效中</option>
                  <option value='SUSPENDED'>已暂停</option>
                  <option value='EXPIRED'>已过期</option>
                  <option value='CANCELLED'>已取消</option>
                  <option value='PENDING'>待生效</option>
                </select>

                {/* 快捷操作按钮 */}
                <div className='mt-2'>
                  {formData.status !== 'SUSPENDED' && (
                    <button
                      type='button'
                      onClick={() => handleStatusChange('SUSPENDED')}
                      className='text-sm text-indigo-600 hover:text-indigo-700 font-medium mr-4'
                    >
                      暂停会员
                    </button>
                  )}
                  {formData.status === 'SUSPENDED' && (
                    <button
                      type='button'
                      onClick={() => handleStatusChange('ACTIVE')}
                      className='text-sm text-green-600 hover:text-green-700 font-medium'
                    >
                      恢复会员
                    </button>
                  )}
                </div>
              </div>

              {/* 结束日期 */}
              <div className='mb-4'>
                <label
                  htmlFor='endDate'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  有效期至
                </label>
                <input
                  type='date'
                  id='endDate'
                  name='endDate'
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm'
                  required
                />
              </div>

              {/* 自动续费 */}
              <div className='mb-4 flex items-center'>
                <input
                  type='checkbox'
                  id='autoRenew'
                  name='autoRenew'
                  checked={formData.autoRenew}
                  onChange={handleInputChange}
                  className='h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500'
                />
                <label
                  htmlFor='autoRenew'
                  className='ml-2 text-sm text-gray-700'
                >
                  启用自动续费
                </label>
              </div>

              {/* 备注 */}
              <div className='mb-4'>
                <label
                  htmlFor='notes'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  备注
                </label>
                <textarea
                  id='notes'
                  name='notes'
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm'
                  placeholder='添加管理员备注...'
                />
              </div>

              {/* 暂停原因（仅暂停状态显示） */}
              {formData.status === 'SUSPENDED' && (
                <div className='mb-4'>
                  <label
                    htmlFor='pausedReason'
                    className='block text-sm font-medium text-gray-700 mb-1'
                  >
                    暂停原因
                  </label>
                  <input
                    type='text'
                    id='pausedReason'
                    name='pausedReason'
                    value={formData.pausedReason}
                    onChange={handleInputChange}
                    className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm'
                    placeholder='填写暂停原因...'
                  />
                </div>
              )}
            </div>

            {/* 按钮组 */}
            <div className='flex justify-end space-x-3'>
              <button
                type='button'
                onClick={onClose}
                disabled={loading}
                className='px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                取消
              </button>
              <button
                type='submit'
                disabled={loading}
                className='px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {loading ? '保存中...' : '保存更改'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
