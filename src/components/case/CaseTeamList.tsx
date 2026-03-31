import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TeamMemberForm } from '@/components/case/TeamMemberForm';
import {
  CaseRole,
  CASE_ROLE_LABELS,
  type CaseTeamMemberDetail,
} from '@/types/case-collaboration';

/**
 * 分页参数接口
 */
interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  role?: CaseRole;
}

/**
 * 分页响应接口
 */
interface PaginatedResponse<T> {
  members: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 组件属性
 */
export interface CaseTeamListProps {
  caseId: string;
  canManage?: boolean;
  currentUserId?: string;
}

/**
 * 案件团队成员列表组件
 */
export function CaseTeamList({
  caseId,
  canManage = false,
  currentUserId = '',
}: CaseTeamListProps) {
  const [members, setMembers] = useState<CaseTeamMemberDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // 分页状态
  const [pagination, setPagination] = useState<PaginationParams>({
    page: 1,
    limit: 10,
    sortBy: 'joinedAt',
    sortOrder: 'desc',
  });
  const [total, setTotal] = useState(0);

  // 加载团队成员列表
  const loadMembers = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (pagination.sortBy) {
        params.set('sortBy', pagination.sortBy);
      }
      if (pagination.sortOrder) {
        params.set('sortOrder', pagination.sortOrder);
      }
      if (pagination.role) {
        params.set('role', pagination.role);
      }

      const response = await fetch(
        `/api/cases/${caseId}/team-members?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('加载团队成员失败');
      }

      const data =
        (await response.json()) as PaginatedResponse<CaseTeamMemberDetail>;
      setMembers(data.members || []);
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
      console.error('加载团队成员失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [caseId, pagination]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  /**
   * 处理添加成员
   */
  async function handleAddMember(data: unknown): Promise<void> {
    try {
      const response = await fetch(`/api/cases/${caseId}/team-members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '添加成员失败');
      }

      setShowAddForm(false);
      void loadMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : '添加失败';
      throw new Error(message);
    }
  }

  /**
   * 处理删除成员
   */
  async function handleRemoveMember(userId: string): Promise<void> {
    if (!confirm('确定要移除该成员吗？')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/cases/${caseId}/team-members/${userId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '删除失败');
      }

      void loadMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除失败';
      alert(message);
      console.error('删除成员失败:', err);
    }
  }

  /**
   * 处理分页变更
   */
  function handlePageChange(newPage: number): void {
    setPagination(prev => ({ ...prev, page: newPage }));
  }

  /**
   * 处理角色筛选
   */
  function handleRoleFilter(role: CaseRole | ''): void {
    setPagination(prev => ({
      ...prev,
      role: role || undefined,
      page: 1,
    }));
  }

  /**
   * 获取角色徽章样式
   */
  function getRoleBadgeClass(role: CaseRole): string {
    const classes: Record<CaseRole, string> = {
      [CaseRole.LEAD]: 'bg-purple-100 text-purple-800',
      [CaseRole.ASSISTANT]: 'bg-blue-100 text-blue-800',
      [CaseRole.PARALEGAL]: 'bg-green-100 text-green-800',
      [CaseRole.OBSERVER]: 'bg-gray-100 text-gray-800',
    };
    return classes[role];
  }

  /**
   * 渲染成员卡片
   */
  function renderMemberCard(member: CaseTeamMemberDetail): React.JSX.Element {
    return (
      <Card key={member.id} className='mb-3'>
        <CardContent className='p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              {member.user?.avatar ? (
                <div className='relative h-12 w-12'>
                  <Image
                    src={member.user.avatar}
                    alt={member.user.name || member.user.email}
                    fill
                    className='rounded-full object-cover'
                  />
                </div>
              ) : (
                <div className='h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center'>
                  <span className='text-lg font-medium text-gray-600'>
                    {(member.user?.name || member.user?.email || '')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className='flex items-center space-x-2'>
                  <p className='text-sm font-medium text-gray-900'>
                    {member.user?.name || '未命名用户'}
                  </p>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(
                      member.role
                    )}`}
                  >
                    {CASE_ROLE_LABELS[member.role]}
                  </span>
                </div>
                <p className='text-sm text-gray-500'>
                  {member.user?.email || ''}
                </p>
                {member.notes && (
                  <p className='text-xs text-gray-400 mt-1'>{member.notes}</p>
                )}
              </div>
            </div>
            <div className='flex items-center space-x-2'>
              <span className='text-xs text-gray-400'>
                加入时间：{new Date(member.joinedAt).toLocaleDateString()}
              </span>
              {canManage && member.userId !== currentUserId && (
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => handleRemoveMember(member.userId)}
                  className='text-red-600 hover:text-red-700 hover:bg-red-50'
                >
                  移除
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>团队成员 ({total})</CardTitle>
            {canManage && (
              <Button
                size='sm'
                variant='primary'
                onClick={() => setShowAddForm(true)}
              >
                添加成员
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选栏 */}
          <div className='flex items-center space-x-4 mb-4'>
            <span className='text-sm text-gray-600'>筛选：</span>
            <select
              value={pagination.role || ''}
              onChange={e => handleRoleFilter(e.target.value as CaseRole | '')}
              className='px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>全部角色</option>
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

          {/* 加载状态 */}
          {isLoading && members.length === 0 && (
            <div className='text-center py-8 text-gray-500'>加载中...</div>
          )}

          {/* 错误状态 */}
          {error && (
            <div className='px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800 mb-4'>
              {error}
              <Button
                size='sm'
                variant='ghost'
                onClick={() => void loadMembers()}
                className='ml-2'
              >
                重试
              </Button>
            </div>
          )}

          {/* 成员列表 */}
          {!isLoading && members.length === 0 && !error && (
            <div className='text-center py-8 text-gray-500'>暂无团队成员</div>
          )}

          {members.map(member => renderMemberCard(member))}

          {/* 分页 */}
          {total > pagination.limit && (
            <div className='flex items-center justify-between mt-4'>
              <span className='text-sm text-gray-600'>共 {total} 位成员</span>
              <div className='flex items-center space-x-2'>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isLoading}
                >
                  上一页
                </Button>
                <span className='text-sm text-gray-600'>
                  第 {pagination.page} 页
                </span>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={
                    pagination.page * pagination.limit >= total || isLoading
                  }
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加成员弹窗 */}
      {showAddForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4'>
          <div className='w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900'>
            <div className='flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-zinc-700'>
              <h2 className='text-base font-semibold text-gray-900 dark:text-zinc-100'>
                添加团队成员
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className='rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
                aria-label='关闭'
              >
                <svg
                  className='h-5 w-5'
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
            <div
              className='overflow-y-auto p-6'
              style={{ maxHeight: 'calc(90vh - 80px)' }}
            >
              <TeamMemberForm
                onSubmit={data => handleAddMember(data)}
                onCancel={() => setShowAddForm(false)}
                isLoading={isLoading}
                existingMemberIds={members.map(m => m.userId)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
