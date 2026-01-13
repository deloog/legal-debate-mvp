'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// =============================================================================
// 类型定义
// =============================================================================

interface User {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: string;
  status: string;
  phone: string | null;
  address: string | null;
  bio: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  loginCount: number;
  emailVerified: Date | null;
}

interface LawyerQualification {
  id: string;
  licenseNumber: string;
  fullName: string;
  lawFirm: string;
  status: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewNotes: string | null;
}

interface EnterpriseAccount {
  id: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  status: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  expiresAt: Date | null;
}

interface UserStatistics {
  casesCount: number;
  debatesCount: number;
  documentsCount: number;
}

interface UserDetailData {
  user: User;
  lawyerQualification: LawyerQualification | null;
  enterpriseAccount: EnterpriseAccount | null;
  statistics: UserStatistics;
}

interface EditFormData {
  username: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  address: string;
  bio: string;
}

// =============================================================================
// 常量定义
// =============================================================================

const ROLE_OPTIONS = [
  { value: 'USER', label: '普通用户' },
  { value: 'LAWYER', label: '律师' },
  { value: 'ENTERPRISE', label: '企业' },
  { value: 'ADMIN', label: '管理员' },
  { value: 'SUPER_ADMIN', label: '超级管理员' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: '正常' },
  { value: 'SUSPENDED', label: '已暂停' },
  { value: 'BANNED', label: '已封禁' },
  { value: 'INACTIVE', label: '未激活' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-600 bg-green-100',
  SUSPENDED: 'text-yellow-600 bg-yellow-100',
  BANNED: 'text-red-600 bg-red-100',
  INACTIVE: 'text-gray-600 bg-gray-100',
};

const QUALIFICATION_STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600',
  UNDER_REVIEW: 'text-blue-600',
  APPROVED: 'text-green-600',
  REJECTED: 'text-red-600',
  EXPIRED: 'text-gray-600',
};

// =============================================================================
// 组件属性
// =============================================================================

interface UserDetailProps {
  userId: string;
}

// =============================================================================
// 主组件
// =============================================================================

export function UserDetail({ userId }: UserDetailProps): React.ReactNode {
  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<EditFormData | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        throw new Error('获取用户详情失败');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = () => {
    if (data) {
      setEditForm({
        username: data.user.username || '',
        name: data.user.name || '',
        role: data.user.role,
        status: data.user.status,
        phone: data.user.phone || '',
        address: data.user.address || '',
        bio: data.user.bio || '',
      });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!editForm) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('更新失败');
      }

      const result = await response.json();
      setData(result.data);
      setIsEditing(false);
      setEditForm(null);
      setMessage({ type: 'success', text: result.message || '更新成功' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '保存失败',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('确定要删除该用户吗？此操作不可恢复！')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      setMessage({ type: 'success', text: '删除成功' });
      setTimeout(() => {
        window.location.href = '/admin/users';
      }, 1500);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '删除失败',
      });
    }
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
        <div className='text-gray-600'>用户不存在</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {message && (
        <div
          className={`px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 基本信息 */}
      <div className='bg-white rounded-lg shadow p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-xl font-semibold text-gray-900'>基本信息</h2>
          {!isEditing ? (
            <div className='flex gap-2'>
              <button
                onClick={handleEdit}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                编辑
              </button>
              <button
                onClick={handleDelete}
                className='px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500'
              >
                删除
              </button>
            </div>
          ) : (
            <div className='flex gap-2'>
              <button
                onClick={handleSave}
                disabled={saving}
                className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50'
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className='px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50'
              >
                取消
              </button>
            </div>
          )}
        </div>

        {isEditing && editForm ? (
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  用户名
                </label>
                <input
                  type='text'
                  value={editForm.username}
                  onChange={e =>
                    setEditForm({ ...editForm, username: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  姓名
                </label>
                <input
                  type='text'
                  value={editForm.name}
                  onChange={e =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  角色
                </label>
                <select
                  value={editForm.role}
                  onChange={e =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  状态
                </label>
                <select
                  value={editForm.status}
                  onChange={e =>
                    setEditForm({ ...editForm, status: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  电话
                </label>
                <input
                  type='text'
                  value={editForm.phone}
                  onChange={e =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  地址
                </label>
                <input
                  type='text'
                  value={editForm.address}
                  onChange={e =>
                    setEditForm({ ...editForm, address: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                简介
              </label>
              <textarea
                value={editForm.bio}
                onChange={e =>
                  setEditForm({ ...editForm, bio: e.target.value })
                }
                rows={3}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>
        ) : (
          <div className='grid grid-cols-2 gap-6'>
            <div>
              <p className='text-sm text-gray-500 mb-1'>邮箱</p>
              <p className='text-gray-900'>{data.user.email}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>用户名</p>
              <p className='text-gray-900'>{data.user.username || '-'}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>姓名</p>
              <p className='text-gray-900'>{data.user.name || '-'}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>角色</p>
              <p className='text-gray-900'>{data.user.role}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>状态</p>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  STATUS_COLORS[data.user.status] || ''
                }`}
              >
                {data.user.status}
              </span>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>电话</p>
              <p className='text-gray-900'>{data.user.phone || '-'}</p>
            </div>
            <div className='col-span-2'>
              <p className='text-sm text-gray-500 mb-1'>地址</p>
              <p className='text-gray-900'>{data.user.address || '-'}</p>
            </div>
            <div className='col-span-2'>
              <p className='text-sm text-gray-500 mb-1'>简介</p>
              <p className='text-gray-900'>{data.user.bio || '-'}</p>
            </div>
          </div>
        )}
      </div>

      {/* 账户信息 */}
      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-xl font-semibold text-gray-900 mb-6'>账户信息</h2>
        <div className='grid grid-cols-3 gap-6'>
          <div>
            <p className='text-sm text-gray-500 mb-1'>注册时间</p>
            <p className='text-gray-900'>
              {new Date(data.user.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-500 mb-1'>最后登录</p>
            <p className='text-gray-900'>
              {data.user.lastLoginAt
                ? new Date(data.user.lastLoginAt).toLocaleString('zh-CN')
                : '从未登录'}
            </p>
          </div>
          <div>
            <p className='text-sm text-gray-500 mb-1'>登录次数</p>
            <p className='text-gray-900'>{data.user.loginCount}</p>
          </div>
          <div>
            <p className='text-sm text-gray-500 mb-1'>邮箱验证</p>
            <p
              className={
                data.user.emailVerified ? 'text-green-600' : 'text-yellow-600'
              }
            >
              {data.user.emailVerified ? '已验证' : '未验证'}
            </p>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-xl font-semibold text-gray-900 mb-6'>使用统计</h2>
        <div className='grid grid-cols-3 gap-6'>
          <div className='text-center'>
            <p className='text-3xl font-bold text-blue-600'>
              {data.statistics.casesCount}
            </p>
            <p className='text-gray-600 mt-1'>案件数</p>
          </div>
          <div className='text-center'>
            <p className='text-3xl font-bold text-green-600'>
              {data.statistics.debatesCount}
            </p>
            <p className='text-gray-600 mt-1'>辩论数</p>
          </div>
          <div className='text-center'>
            <p className='text-3xl font-bold text-purple-600'>
              {data.statistics.documentsCount}
            </p>
            <p className='text-gray-600 mt-1'>文档数</p>
          </div>
        </div>
      </div>

      {/* 律师资格认证 */}
      {data.lawyerQualification && (
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-xl font-semibold text-gray-900 mb-6'>
            律师资格认证
          </h2>
          <div className='grid grid-cols-2 gap-6'>
            <div>
              <p className='text-sm text-gray-500 mb-1'>执业证号</p>
              <p className='text-gray-900'>
                {data.lawyerQualification.licenseNumber}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>姓名</p>
              <p className='text-gray-900'>
                {data.lawyerQualification.fullName}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>执业律所</p>
              <p className='text-gray-900'>
                {data.lawyerQualification.lawFirm}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>状态</p>
              <p
                className={
                  QUALIFICATION_STATUS_COLORS[
                    data.lawyerQualification.status
                  ] || ''
                }
              >
                {data.lawyerQualification.status}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>提交时间</p>
              <p className='text-gray-900'>
                {new Date(data.lawyerQualification.submittedAt).toLocaleString(
                  'zh-CN'
                )}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>审核时间</p>
              <p className='text-gray-900'>
                {data.lawyerQualification.reviewedAt
                  ? new Date(
                      data.lawyerQualification.reviewedAt
                    ).toLocaleString('zh-CN')
                  : '-'}
              </p>
            </div>
            {data.lawyerQualification.reviewNotes && (
              <div className='col-span-2'>
                <p className='text-sm text-gray-500 mb-1'>审核备注</p>
                <p className='text-gray-900'>
                  {data.lawyerQualification.reviewNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 企业认证 */}
      {data.enterpriseAccount && (
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-xl font-semibold text-gray-900 mb-6'>企业认证</h2>
          <div className='grid grid-cols-2 gap-6'>
            <div>
              <p className='text-sm text-gray-500 mb-1'>企业名称</p>
              <p className='text-gray-900'>
                {data.enterpriseAccount.enterpriseName}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>统一社会信用代码</p>
              <p className='text-gray-900'>
                {data.enterpriseAccount.creditCode}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>法人代表</p>
              <p className='text-gray-900'>
                {data.enterpriseAccount.legalPerson}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>行业类型</p>
              <p className='text-gray-900'>
                {data.enterpriseAccount.industryType}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>状态</p>
              <p
                className={
                  QUALIFICATION_STATUS_COLORS[data.enterpriseAccount.status] ||
                  ''
                }
              >
                {data.enterpriseAccount.status}
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500 mb-1'>有效期</p>
              <p className='text-gray-900'>
                {data.enterpriseAccount.expiresAt
                  ? new Date(data.enterpriseAccount.expiresAt).toLocaleString(
                      'zh-CN'
                    )
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 返回按钮 */}
      <div>
        <Link
          href='/admin/users'
          className='inline-block px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500'
        >
          返回列表
        </Link>
      </div>
    </div>
  );
}
