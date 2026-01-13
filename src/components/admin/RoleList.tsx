'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Permission {
  id: string;
  name: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  permissions: Permission[];
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RoleListData {
  roles: Role[];
  pagination: Pagination;
}

interface CreateRoleForm {
  name: string;
  description: string;
  isDefault: boolean;
}

export function RoleList(): React.ReactElement {
  const [data, setData] = useState<RoleListData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<CreateRoleForm>({
    name: '',
    description: '',
    isDefault: false,
  });

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
      });

      const response = await fetch(`/api/admin/roles?${params}`);
      if (!response.ok) {
        throw new Error('获取角色列表失败');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    loadRoles();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || '创建失败');
      }

      setShowCreateModal(false);
      setCreateForm({ name: '', description: '', isDefault: false });
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleDelete = async (roleId: string, roleName: string) => {
    if (!window.confirm(`确定要删除角色"${roleName}"吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      await loadRoles();
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

  if (!data || data.roles.length === 0) {
    return (
      <div className='space-y-6'>
        <div className='bg-white rounded-lg shadow p-6'>
          <form onSubmit={handleSearch} className='flex gap-4'>
            <input
              type='text'
              placeholder='搜索角色名称或描述'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <button
              type='submit'
              className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              搜索
            </button>
          </form>
        </div>

        <div className='bg-white rounded-lg shadow p-6'>
          <div className='text-gray-600'>暂无角色数据</div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <form onSubmit={handleSearch} className='flex gap-4'>
          <input
            type='text'
            placeholder='搜索角色名称或描述'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <button
            type='submit'
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            搜索
          </button>
          <button
            type='button'
            onClick={() => setShowCreateModal(true)}
            className='px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
          >
            创建角色
          </button>
        </form>
      </div>

      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50'>
            <tr>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                角色名称
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                描述
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                权限数量
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                用户数量
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                默认角色
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-200'>
            {data.roles.map(role => (
              <tr key={role.id} className='hover:bg-gray-50'>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                  {role.name}
                </td>
                <td className='px-6 py-4 text-sm text-gray-500'>
                  {role.description || '-'}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {role.permissions.length}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {role.userCount}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm'>
                  {role.isDefault ? (
                    <span className='text-green-600'>是</span>
                  ) : (
                    <span className='text-gray-600'>否</span>
                  )}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                  <div className='flex justify-end gap-2'>
                    <Link
                      href={`/admin/roles/${role.id}`}
                      className='text-blue-600 hover:text-blue-900'
                    >
                      查看
                    </Link>
                    <Link
                      href={`/admin/roles/${role.id}/edit`}
                      className='text-indigo-600 hover:text-indigo-900'
                    >
                      编辑
                    </Link>
                    <button
                      onClick={() => handleDelete(role.id, role.name)}
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
            共 {data.pagination.total} 条记录，第 {currentPage} /{' '}
            {data.pagination.totalPages} 页
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              上一页
            </button>
            <button
              onClick={() =>
                setCurrentPage(p => Math.min(data.pagination.totalPages, p + 1))
              }
              disabled={currentPage === data.pagination.totalPages}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4'>
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>创建角色</h2>
            <form onSubmit={handleCreate} className='space-y-4'>
              <div>
                <label
                  htmlFor='name'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  角色名称
                </label>
                <input
                  type='text'
                  id='name'
                  required
                  value={createForm.name}
                  onChange={e =>
                    setCreateForm({ ...createForm, name: e.target.value })
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='例如：DEVELOPER'
                />
              </div>
              <div>
                <label
                  htmlFor='description'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  描述
                </label>
                <textarea
                  id='description'
                  value={createForm.description}
                  onChange={e =>
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    })
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                  rows={3}
                  placeholder='角色描述'
                />
              </div>
              <div className='flex items-center'>
                <input
                  type='checkbox'
                  id='isDefault'
                  checked={createForm.isDefault}
                  onChange={e =>
                    setCreateForm({
                      ...createForm,
                      isDefault: e.target.checked,
                    })
                  }
                  className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                />
                <label
                  htmlFor='isDefault'
                  className='ml-2 block text-sm text-gray-700'
                >
                  设为默认角色
                </label>
              </div>
              <div className='flex gap-4 pt-4'>
                <button
                  type='button'
                  onClick={() => setShowCreateModal(false)}
                  className='flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50'
                >
                  取消
                </button>
                <button
                  type='submit'
                  className='flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
