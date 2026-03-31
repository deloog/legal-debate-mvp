import { ChangeEvent, FormEvent, useState } from 'react';
import Image from 'next/image';
import {
  CaseRole,
  getRoleDefaultPermissions,
  CASE_ROLE_LABELS,
} from '@/types/case-collaboration';

interface UserSearchResult {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
  role: string;
}

interface FormData {
  userId: string;
  role: CaseRole;
  permissions: ReturnType<typeof getRoleDefaultPermissions>;
  notes: string;
}

export interface TeamMemberFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  existingMemberIds?: string[];
}

const ROLE_OPTIONS: { value: CaseRole; label: string; desc: string }[] = [
  {
    value: CaseRole.LEAD,
    label: CASE_ROLE_LABELS[CaseRole.LEAD],
    desc: '完整管理权限',
  },
  {
    value: CaseRole.ASSISTANT,
    label: CASE_ROLE_LABELS[CaseRole.ASSISTANT],
    desc: '可编辑案件内容',
  },
  {
    value: CaseRole.PARALEGAL,
    label: CASE_ROLE_LABELS[CaseRole.PARALEGAL],
    desc: '可添加证据和文件',
  },
  {
    value: CaseRole.OBSERVER,
    label: CASE_ROLE_LABELS[CaseRole.OBSERVER],
    desc: '仅查看，不可编辑',
  },
];

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
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSearch(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error('搜索失败');
      const data = await res.json();
      setSearchResults(
        (data.users || []).filter(
          (u: UserSearchResult) => !existingMemberIds.includes(u.id)
        )
      );
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  }

  function handleSelectUser(user: UserSearchResult): void {
    setSelectedUser(user);
    setFormData(prev => ({ ...prev, userId: user.id }));
    setSearchQuery('');
    setSearchResults([]);
  }

  function handleRoleChange(role: CaseRole): void {
    setFormData(prev => ({
      ...prev,
      role,
      permissions: getRoleDefaultPermissions(role),
    }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!formData.userId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(formData);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : '提交失败，请稍后重试'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const disabled = isLoading || isSubmitting;

  return (
    <form onSubmit={e => void handleSubmit(e)} className='space-y-5'>
      {/* 用户搜索 */}
      <div>
        <label className='mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300'>
          用户 <span className='text-red-500'>*</span>
        </label>

        {selectedUser ? (
          /* 已选用户 */
          <div className='flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:border-green-800 dark:bg-green-900/20'>
            <div className='relative h-9 w-9 shrink-0'>
              {selectedUser.avatar ? (
                <Image
                  src={selectedUser.avatar}
                  alt={selectedUser.name ?? selectedUser.email}
                  fill
                  className='rounded-full object-cover'
                />
              ) : (
                <div className='flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'>
                  {(selectedUser.name ?? selectedUser.email)
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium text-gray-900 dark:text-zinc-100'>
                {selectedUser.name ?? selectedUser.email}
              </p>
              {selectedUser.name && (
                <p className='truncate text-xs text-gray-500 dark:text-zinc-400'>
                  {selectedUser.email}
                </p>
              )}
            </div>
            <button
              type='button'
              onClick={() => {
                setSelectedUser(null);
                setFormData(prev => ({ ...prev, userId: '' }));
              }}
              className='shrink-0 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400'
            >
              更换
            </button>
          </div>
        ) : (
          /* 搜索框 */
          <div className='relative'>
            <input
              type='text'
              value={searchQuery}
              onChange={handleSearch}
              placeholder='输入姓名或邮箱搜索用户'
              disabled={disabled}
              className='w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
            />
            {isSearching && (
              <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                <div className='h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
              </div>
            )}

            {/* 搜索下拉结果 */}
            {searchResults.length > 0 && (
              <div className='absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900'>
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    type='button'
                    onClick={() => handleSelectUser(user)}
                    className='flex w-full items-center gap-3 border-b border-gray-100 px-4 py-2.5 text-left last:border-0 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800'
                  >
                    {user.avatar ? (
                      <div className='relative h-8 w-8 shrink-0'>
                        <Image
                          src={user.avatar}
                          alt={user.name ?? user.email}
                          fill
                          className='rounded-full object-cover'
                        />
                      </div>
                    ) : (
                      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600 dark:bg-zinc-700 dark:text-zinc-300'>
                        {(user.name ?? user.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium text-gray-900 dark:text-zinc-100'>
                        {user.name ?? user.email}
                      </p>
                      {user.name && (
                        <p className='truncate text-xs text-gray-500 dark:text-zinc-400'>
                          {user.email}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 角色选择（卡片式） */}
      <div>
        <label className='mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300'>
          角色
        </label>
        <div className='grid grid-cols-2 gap-2'>
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type='button'
              disabled={disabled}
              onClick={() => handleRoleChange(opt.value)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                formData.role === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
              }`}
            >
              <p
                className={`text-sm font-medium ${formData.role === opt.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-zinc-100'}`}
              >
                {opt.label}
              </p>
              <p className='mt-0.5 text-xs text-gray-500 dark:text-zinc-400'>
                {opt.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 备注（可选，折叠展示） */}
      <div>
        <label className='mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300'>
          备注{' '}
          <span className='text-xs font-normal text-gray-400'>（可选）</span>
        </label>
        <textarea
          value={formData.notes}
          onChange={e =>
            setFormData(prev => ({ ...prev, notes: e.target.value }))
          }
          disabled={disabled}
          placeholder='如：负责合同审查部分'
          rows={2}
          className='w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
        />
      </div>

      {submitError && (
        <p className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'>
          {submitError}
        </p>
      )}

      {/* 操作按钮 */}
      <div className='flex justify-end gap-2 pt-1'>
        <button
          type='button'
          onClick={onCancel}
          disabled={disabled}
          className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
        >
          取消
        </button>
        <button
          type='submit'
          disabled={disabled || !formData.userId}
          className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600'
        >
          {isSubmitting ? '添加中...' : '添加成员'}
        </button>
      </div>
    </form>
  );
}
