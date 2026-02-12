'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ADMIN_API, buildUrl } from '@/lib/constants/api-paths';

interface User {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserListData {
  users: User[];
  pagination: Pagination;
}

interface FilterParams {
  role: string;
  status: string;
  search: string;
}

const ROLE_OPTIONS = [
  { value: '', label: '全部角色' },
  { value: 'USER', label: '普通用户' },
  { value: 'LAWYER', label: '律师' },
  { value: 'ENTERPRISE', label: '企业' },
  { value: 'ADMIN', label: '管理员' },
  { value: 'SUPER_ADMIN', label: '超级管理员' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'ACTIVE', label: '正常' },
  { value: 'SUSPENDED', label: '已暂停' },
  { value: 'BANNED', label: '已封禁' },
  { value: 'INACTIVE', label: '未激活' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-600',
  SUSPENDED: 'text-yellow-600',
  BANNED: 'text-red-600',
  INACTIVE: 'text-gray-600',
};

export function UserList(): React.ReactElement {
  const [data, setData] = useState<UserListData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterParams>({
    role: '',
    status: '',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState<number>(1);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(filters.role && { role: filters.role }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(
        buildUrl(ADMIN_API.USERS.LIST, Object.fromEntries(params.entries()))
      );
      if (!response.ok) {
        throw new Error('获取用户列表失败');
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
    loadUsers();
  }, [loadUsers]);

  const handleFilterChange = (key: keyof FilterParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    loadUsers();
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!window.confirm(`确定要删除用户"${userName}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(ADMIN_API.USERS.delete(userId), {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
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

  if (!data || data.users.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>暂无用户数据</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <form onSubmit={handleSearch} className='flex flex-wrap gap-4'>
          <input
            type='text'
            placeholder='搜索邮箱、用户名或姓名'
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            className='flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <select
            value={filters.role}
            onChange={e => handleFilterChange('role', e.target.value)}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
          <button
            type='submit'
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            搜索
          </button>
        </form>
      </div>

      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50'>
            <tr>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                邮箱
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                用户名
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                姓名
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                角色
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                状态
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                注册时间
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-200'>
            {data.users.map(user => (
              <tr key={user.id} className='hover:bg-gray-50'>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                  {user.email}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {user.username || '-'}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {user.name || '-'}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {user.role}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm'>
                  <span className={STATUS_COLORS[user.status] || ''}>
                    {user.status}
                  </span>
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                  <div className='flex justify-end gap-2'>
                    <Link
                      href={`/admin/users/${user.id}`}
                      className='text-blue-600 hover:text-blue-900'
                    >
                      查看
                    </Link>
                    <Link
                      href={`/admin/users/${user.id}/edit`}
                      className='text-indigo-600 hover:text-indigo-900'
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => {
                        handleDelete(user.id, user.name || user.email);
                      }}
                      className='text-red-600 hover:text-red-900'
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className='bg-gray-50 px-6 py-4 flex items-center justify-between'>
          <div className='text-sm text-gray-700'>
            {' '}
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
