'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Permission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  permissions: Array<{
    permission: Permission;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface AllPermissions {
  [resource: string]: Permission[];
}

interface EditForm {
  name: string;
  description: string;
}

export function RoleDetail({ roleId }: { roleId: string }): React.ReactElement {
  const [role, setRole] = useState<Role | null>(null);
  const [allPermissions, setAllPermissions] = useState<AllPermissions>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: '',
    description: '',
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const loadRole = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/roles/${roleId}`);
      if (!response.ok) {
        throw new Error('获取角色详情失败');
      }

      const result = await response.json();
      setRole(result.data);
      setSelectedPermissions(
        result.data.permissions.map(
          (rp: { permission: Permission }) => rp.permission.id
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  const loadAllPermissions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/permissions');
      if (!response.ok) {
        throw new Error('获取权限列表失败');
      }

      const result = await response.json();
      const grouped: AllPermissions = {};
      result.data.forEach((perm: Permission) => {
        if (!grouped[perm.resource]) {
          grouped[perm.resource] = [];
        }
        grouped[perm.resource].push(perm);
      });
      setAllPermissions(grouped);
    } catch (err) {
      console.error('加载权限列表失败:', err);
    }
  }, []);

  useEffect(() => {
    loadRole();
    loadAllPermissions();
  }, [loadRole, loadAllPermissions]);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || '更新失败');
      }

      setShowEditModal(false);
      await loadRole();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleAssignPermissions = async () => {
    try {
      const response = await fetch(
        `/api/admin/roles/${roleId}/permissions/batch`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ permissionIds: selectedPermissions }),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || '分配权限失败');
      }

      await loadRole();
    } catch (err) {
      setError(err instanceof Error ? err.message : '分配权限失败');
    }
  };

  const handleDelete = async () => {
    if (!role) {
      return;
    }

    if (!window.confirm(`确定要删除角色"${role.name}"吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/roles/${roleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      window.location.href = '/admin/roles';
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(id => id !== permissionId);
      }
      return [...prev, permissionId];
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

  if (!role) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>角色不存在</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <div className='flex justify-between items-start mb-6'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>{role.name}</h1>
            <p className='text-gray-600 mt-2'>
              {role.description || '暂无描述'}
            </p>
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => {
                setEditForm({
                  name: role.name,
                  description: role.description || '',
                });
                setShowEditModal(true);
              }}
              className='px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700'
            >
              编辑
            </button>
            <button
              onClick={handleDelete}
              className='px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700'
            >
              删除
            </button>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4 text-sm'>
          <div>
            <span className='text-gray-500'>角色ID：</span>
            <span className='ml-2 text-gray-900'>{role.id}</span>
          </div>
          <div>
            <span className='text-gray-500'>默认角色：</span>
            <span className='ml-2'>
              {role.isDefault ? (
                <span className='text-green-600'>是</span>
              ) : (
                <span className='text-gray-600'>否</span>
              )}
            </span>
          </div>
          <div>
            <span className='text-gray-500'>创建时间：</span>
            <span className='ml-2 text-gray-900'>
              {new Date(role.createdAt).toLocaleString('zh-CN')}
            </span>
          </div>
          <div>
            <span className='text-gray-500'>更新时间：</span>
            <span className='ml-2 text-gray-900'>
              {new Date(role.updatedAt).toLocaleString('zh-CN')}
            </span>
          </div>
        </div>
      </div>

      <div className='bg-white rounded-lg shadow p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h2 className='text-xl font-bold text-gray-900'>角色权限</h2>
          <button
            onClick={handleAssignPermissions}
            className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700'
          >
            保存权限
          </button>
        </div>

        {Object.keys(allPermissions).length === 0 ? (
          <div className='text-gray-600'>加载权限列表中...</div>
        ) : (
          <div className='space-y-6'>
            {Object.entries(allPermissions).map(([resource, perms]) => (
              <div key={resource}>
                <h3 className='text-lg font-semibold text-gray-900 mb-3'>
                  {resource}
                </h3>
                <div className='grid grid-cols-2 gap-4'>
                  {perms.map(perm => (
                    <label
                      key={perm.id}
                      className='flex items-center space-x-2'
                    >
                      <input
                        type='checkbox'
                        checked={selectedPermissions.includes(perm.id)}
                        onChange={() => handlePermissionToggle(perm.id)}
                        className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                      />
                      <div className='flex-1'>
                        <span className='text-sm font-medium text-gray-900'>
                          {perm.name}
                        </span>
                        {perm.description && (
                          <p className='text-xs text-gray-500 mt-1'>
                            {perm.description}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className='flex gap-4'>
        <Link
          href='/admin/roles'
          className='px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700'
        >
          返回列表
        </Link>
      </div>

      {showEditModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4'>
            <h2 className='text-2xl font-bold text-gray-900 mb-4'>编辑角色</h2>
            <form onSubmit={handleUpdate} className='space-y-4'>
              <div>
                <label
                  htmlFor='editName'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  角色名称
                </label>
                <input
                  type='text'
                  id='editName'
                  required
                  value={editForm.name}
                  onChange={e =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label
                  htmlFor='editDescription'
                  className='block text-sm font-medium text-gray-700 mb-1'
                >
                  描述
                </label>
                <textarea
                  id='editDescription'
                  value={editForm.description}
                  onChange={e =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                  rows={3}
                />
              </div>
              <div className='flex gap-4 pt-4'>
                <button
                  type='button'
                  onClick={() => setShowEditModal(false)}
                  className='flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50'
                >
                  取消
                </button>
                <button
                  type='submit'
                  className='flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
