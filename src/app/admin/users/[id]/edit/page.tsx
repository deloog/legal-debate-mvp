'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { UserRole, UserStatus } from '@/types/auth';

interface UserFormData {
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  address: string;
  bio: string;
}

interface UserDetailData {
  user: {
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
  };
  lawyerQualification: {
    id: string;
    licenseNumber: string;
    fullName: string;
    lawFirm: string;
    status: string;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewNotes: string | null;
  } | null;
  enterpriseAccount: {
    id: string;
    enterpriseName: string;
    creditCode: string;
    legalPerson: string;
    industryType: string;
    status: string;
    submittedAt: Date;
    reviewedAt: Date | null;
    expiresAt: Date | null;
  } | null;
  statistics: {
    casesCount: number;
    debatesCount: number;
    documentsCount: number;
  };
}

const ROLE_OPTIONS = [
  { value: UserRole.USER, label: '普通用户' },
  { value: UserRole.LAWYER, label: '律师' },
  { value: UserRole.ENTERPRISE, label: '企业' },
  { value: UserRole.ADMIN, label: '管理员' },
  { value: UserRole.SUPER_ADMIN, label: '超级管理员' },
];

const STATUS_OPTIONS = [
  { value: UserStatus.ACTIVE, label: '正常' },
  { value: UserStatus.SUSPENDED, label: '已暂停' },
  { value: UserStatus.BANNED, label: '已封禁' },
  { value: UserStatus.INACTIVE, label: '未激活' },
];

export function UserEditPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    username: '',
    name: '',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    phone: '',
    address: '',
    bio: '',
  });

  const loadUserDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (!response.ok) {
        throw new Error('获取用户详情失败');
      }

      const result = await response.json();
      const data = result.data as UserDetailData;

      setFormData({
        email: data.user.email,
        username: data.user.username || '',
        name: data.user.name || '',
        role: data.user.role,
        status: data.user.status,
        phone: data.user.phone || '',
        address: data.user.address || '',
        bio: data.user.bio || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUserDetail();
  }, [loadUserDetail]);

  const handleInputChange = (field: keyof UserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.email.includes('@')) {
      setError('请输入有效的邮箱地址');
      return false;
    }

    if (!formData.username || formData.username.length < 2) {
      setError('用户名至少需要2个字符');
      return false;
    }

    if (!ROLE_OPTIONS.some(opt => opt.value === formData.role)) {
      setError('请选择有效的角色');
      return false;
    }

    if (!STATUS_OPTIONS.some(opt => opt.value === formData.status)) {
      setError('请选择有效的状态');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          name: formData.name,
          role: formData.role,
          status: formData.status,
          phone: formData.phone || null,
          address: formData.address || null,
          bio: formData.bio || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '更新失败');
      }

      setSuccess('用户信息更新成功');
      setTimeout(() => {
        router.push(`/admin/users/${userId}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>加载中...</div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-red-600'>{error}</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h2 className='text-2xl font-bold text-gray-900'>编辑用户</h2>
        <Link
          href={`/admin/users/${userId}`}
          className='px-4 py-2 text-blue-600 hover:text-blue-900'
        >
          返回详情
        </Link>
      </div>

      {error && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
          <p className='text-red-600'>{error}</p>
        </div>
      )}

      {success && (
        <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
          <p className='text-green-600'>{success}</p>
        </div>
      )}

      <div className='bg-white rounded-lg shadow p-6'>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <label
                htmlFor='email'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                邮箱（只读）
              </label>
              <input
                type='email'
                id='email'
                value={formData.email}
                disabled
                className='w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed'
              />
              <p className='mt-1 text-xs text-gray-500'>邮箱地址不可修改</p>
            </div>

            <div>
              <label
                htmlFor='username'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                用户名
              </label>
              <input
                type='text'
                id='username'
                value={formData.username}
                onChange={e => handleInputChange('username', e.target.value)}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            <div>
              <label
                htmlFor='name'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                姓名
              </label>
              <input
                type='text'
                id='name'
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            <div>
              <label
                htmlFor='role'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                角色
              </label>
              <select
                id='role'
                value={formData.role}
                onChange={e => handleInputChange('role', e.target.value)}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                {ROLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor='status'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                状态
              </label>
              <select
                id='status'
                value={formData.status}
                onChange={e => handleInputChange('status', e.target.value)}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor='phone'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                电话
              </label>
              <input
                type='tel'
                id='phone'
                value={formData.phone}
                onChange={e => handleInputChange('phone', e.target.value)}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            <div>
              <label
                htmlFor='address'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                地址
              </label>
              <input
                type='text'
                id='address'
                value={formData.address}
                onChange={e => handleInputChange('address', e.target.value)}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>

          <div>
            <label
              htmlFor='bio'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              个人简介
            </label>
            <textarea
              id='bio'
              rows={4}
              value={formData.bio}
              onChange={e => handleInputChange('bio', e.target.value)}
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div className='flex justify-end gap-4'>
            <Link
              href={`/admin/users/${userId}`}
              className='px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500'
            >
              取消
            </Link>
            <button
              type='submit'
              disabled={submitting}
              className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {submitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
