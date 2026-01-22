import { ChangeEvent, FormEvent, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionSelector } from '@/components/case/PermissionSelector';
import {
  CaseRole,
  CasePermission,
  getRoleDefaultPermissions,
  CASE_ROLE_LABELS,
} from '@/types/case-collaboration';

/**
 * 用户搜索结果接口
 */
interface UserSearchResult {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  role: string;
}

/**
 * 表单数据接口
 */
interface FormData {
  userId: string;
  role: CaseRole;
  permissions: CasePermission[];
  notes: string;
}

/**
 * 组件属性
 */
export interface TeamMemberFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  existingMemberIds?: string[];
}

/**
 * 团队成员表单组件
 */
export function TeamMemberForm({
  onSubmit,
  onCancel,
  isLoading = false,
  existingMemberIds = [],
}: TeamMemberFormProps) {
  const [formData, setFormData] = useState<FormData>({
    userId: '',
    role: CaseRole.ASSISTANT,
    permissions: getRoleDefaultPermissions(CaseRole.ASSISTANT),
    notes: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * 搜索用户
   */
  async function handleSearch(
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const query = event.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(
        `/api/users/search?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error('搜索用户失败');
      }

      const data = await response.json();

      // 过滤掉已经是团队成员的用户
      const filteredResults = (data.users || []).filter(
        (user: UserSearchResult) => !existingMemberIds.includes(user.id)
      );

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('搜索用户失败:', error);
      setErrors(prev => ({
        ...prev,
        userId: '搜索用户失败，请稍后重试',
      }));
    } finally {
      setIsSearching(false);
    }
  }

  /**
   * 选择用户
   */
  function handleSelectUser(user: UserSearchResult): void {
    setFormData(prev => ({ ...prev, userId: user.id }));
    setSearchResults([]);
    setSearchQuery('');
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.userId;
      return newErrors;
    });
  }

  /**
   * 处理表单提交
   */
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    // 验证表单
    const newErrors: Record<string, string> = {};

    if (!formData.userId.trim()) {
      newErrors.userId = '请选择用户';
    }

    if (Object.keys(newErrors).length > 0) {
      setIsSubmitting(true);
      setErrors({});

      try {
        await onSubmit(formData);
      } catch (error) {
        console.error('提交表单失败:', error);
        setErrors({
          submit: '提交失败，请稍后重试',
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setErrors(newErrors);
    }
  }

  /**
   * 处理角色变更
   */
  function handleRoleChange(role: CaseRole): void {
    setFormData(prev => ({
      ...prev,
      role,
      permissions: getRoleDefaultPermissions(role),
    }));
  }

  /**
   * 处理权限变更
   */
  function handlePermissionsChange(permissions: CasePermission[]): void {
    setFormData(prev => ({ ...prev, permissions }));
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {/* 用户搜索 */}
      <div className='space-y-2'>
        <Label htmlFor='user-search'>用户 *</Label>
        <div className='relative'>
          <Input
            id='user-search'
            type='text'
            value={searchQuery}
            onChange={handleSearch}
            placeholder='搜索用户（姓名或邮箱）'
            disabled={isLoading || isSubmitting}
            className={errors.userId ? 'border-red-500' : ''}
          />
          {isSearching && (
            <div className='absolute right-3 top-1/2 -translate-y-1/2'>
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 border-t-transparent'></div>
            </div>
          )}
        </div>
        {errors.userId && (
          <p className='text-sm text-red-600'>{errors.userId}</p>
        )}
      </div>

      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <div className='border border-gray-200 rounded-md max-h-48 overflow-y-auto'>
          {searchResults.map(user => (
            <button
              key={user.id}
              type='button'
              onClick={() => handleSelectUser(user)}
              className='w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-3 border-b border-gray-100 last:border-0'
            >
              {user.avatar ? (
                <div className='relative h-8 w-8'>
                  <Image
                    src={user.avatar}
                    alt={user.name || user.email}
                    fill
                    className='rounded-full object-cover'
                  />
                </div>
              ) : (
                <div className='h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center'>
                  <span className='text-sm font-medium text-gray-600'>
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className='flex-1'>
                <p className='text-sm font-medium text-gray-900'>
                  {user.name || user.email}
                </p>
                {user.name && user.email && (
                  <p className='text-xs text-gray-500'>{user.email}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 已选用户 */}
      {formData.userId && (
        <div className='flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-md'>
          <div className='h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center'>
            <span className='text-sm font-medium text-blue-600'>✓</span>
          </div>
          <div className='flex-1'>
            <p className='text-sm font-medium text-gray-900'>
              {searchResults.find(u => u.id === formData.userId)?.name ||
                '已选用户'}
            </p>
          </div>
          <button
            type='button'
            onClick={() => {
              setFormData(prev => ({ ...prev, userId: '' }));
              setSearchQuery('');
            }}
            className='text-sm text-gray-500 hover:text-gray-700'
          >
            取消选择
          </button>
        </div>
      )}

      {/* 角色选择 */}
      <div className='space-y-2'>
        <Label>角色</Label>
        <select
          value={formData.role}
          onChange={e => handleRoleChange(e.target.value as CaseRole)}
          disabled={isLoading || isSubmitting}
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'
        >
          <option value={CaseRole.LEAD}>
            {CASE_ROLE_LABELS[CaseRole.LEAD]}
          </option>
          <option value={CaseRole.ASSISTANT}>
            {CASE_ROLE_LABELS[CaseRole.ASSISTANT]}
          </option>
          <option value={CaseRole.PARALEGAL}>
            {CASE_ROLE_LABELS[CaseRole.PARALEGAL]}
          </option>
          <option value={CaseRole.OBSERVER}>
            {CASE_ROLE_LABELS[CaseRole.OBSERVER]}
          </option>
        </select>
      </div>

      {/* 权限选择 */}
      <div className='space-y-2'>
        <Label>权限</Label>
        <PermissionSelector
          selectedRole={formData.role}
          selectedPermissions={formData.permissions}
          onChange={handlePermissionsChange}
          disabled={isLoading || isSubmitting}
        />
      </div>

      {/* 备注 */}
      <div className='space-y-2'>
        <Label htmlFor='notes'>备注</Label>
        <textarea
          id='notes'
          value={formData.notes}
          onChange={e =>
            setFormData(prev => ({ ...prev, notes: e.target.value }))
          }
          disabled={isLoading || isSubmitting}
          placeholder='添加备注信息（可选）'
          rows={3}
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 resize-none'
        />
      </div>

      {/* 提交错误 */}
      {errors.submit && (
        <div className='px-4 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-800'>
          {errors.submit}
        </div>
      )}

      {/* 按钮 */}
      <div className='flex space-x-3'>
        <Button
          type='button'
          variant='outline'
          onClick={onCancel}
          disabled={isLoading || isSubmitting}
        >
          取消
        </Button>
        <Button
          type='submit'
          variant='primary'
          disabled={isLoading || isSubmitting || !formData.userId}
        >
          {isSubmitting ? '提交中...' : '添加成员'}
        </Button>
      </div>
    </form>
  );
}
