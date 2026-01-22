'use client';

import { useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  TeamMemberDetail,
  TeamRole,
  MemberStatus,
  TEAM_ROLE_LABELS,
  MEMBER_STATUS_LABELS,
} from '@/types/team';

/**
 * 团队成员列表组件
 * 功能：展示团队成员、支持筛选、添加、编辑、移除成员
 */
export function TeamMemberList({ teamId }: { teamId: string }) {
  const [members, setMembers] = useState<TeamMemberDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<TeamRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | ''>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const limit = 10;

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        teamId,
        page: page.toString(),
        limit: limit.toString(),
      });

      if (roleFilter) {
        params.append('role', roleFilter);
      }

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(
        `/api/teams/${teamId}/members?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取团队成员失败');
      }

      const data = (await response.json()) as {
        members: TeamMemberDetail[];
        total: number;
        teamId: string;
        page: number;
        limit: number;
        totalPages: number;
      };

      setMembers(data.members);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取团队成员失败');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter, teamId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleRemoveMember(memberId: string) {
    if (!confirm('确定要移除该成员吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('移除成员失败');
      }

      await fetchMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '移除成员失败');
    }
  }

  if (loading && members.length === 0) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchMembers} />;
  }

  return (
    <div className='space-y-6'>
      {/* 筛选栏 */}
      <div className='flex gap-4'>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value as TeamRole | '')}
          className='rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
        >
          <option value=''>所有角色</option>
          {Object.values(TeamRole).map(role => (
            <option key={role} value={role}>
              {TEAM_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as MemberStatus | '')}
          className='rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
        >
          <option value=''>所有状态</option>
          {Object.values(MemberStatus).map(status => (
            <option key={status} value={status}>
              {MEMBER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {/* 成员列表 */}
      {members.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className='space-y-3'>
            {members.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                onRemove={() => handleRemoveMember(member.id)}
              />
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className='flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800'>
              <div className='text-sm text-zinc-600 dark:text-zinc-400'>
                共 {total} 位成员，第 {page} / {totalPages} 页
              </div>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  variant='outline'
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 成员卡片
 */
function MemberCard({
  member,
  onRemove,
}: {
  member: TeamMemberDetail;
  onRemove: () => void;
}) {
  return (
    <div className='flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'>
      <div className='flex-1'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'>
            {member.user?.name?.[0] ?? '?'}
          </div>
          <div>
            <h3 className='font-medium text-zinc-900 dark:text-zinc-50'>
              {member.user?.name}
            </h3>
            <div className='mt-1 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400'>
              <span className='rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800'>
                {TEAM_ROLE_LABELS[member.role]}
              </span>
              <span
                className={
                  member.status === MemberStatus.ACTIVE
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-zinc-600 dark:text-zinc-400'
                }
              >
                {MEMBER_STATUS_LABELS[member.status]}
              </span>
            </div>
            {member.notes && (
              <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
                {member.notes}
              </p>
            )}
            <div className='mt-1 text-xs text-zinc-500 dark:text-zinc-500'>
              加入时间：{new Date(member.joinedAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
        </div>
      </div>
      <Button variant='ghost' size='sm' onClick={onRemove}>
        移除
      </Button>
    </div>
  );
}

/**
 * 加载状态
 */
function LoadingState() {
  return (
    <div className='space-y-3'>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className='h-20 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900'
        />
      ))}
    </div>
  );
}

/**
 * 错误状态
 */
function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950'>
      <p className='text-red-900 dark:text-red-100'>{error}</p>
      <Button onClick={onRetry} className='mt-4'>
        重试
      </Button>
    </div>
  );
}

/**
 * 空状态
 */
function EmptyState() {
  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950'>
      <div className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
        还没有成员
      </div>
      <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
        添加成员开始协作
      </p>
      <Button className='mt-4'>添加成员</Button>
    </div>
  );
}
