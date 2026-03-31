'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TeamListResponse,
  TeamDetail,
  TeamType,
  TeamStatus,
  TEAM_TYPE_LABELS,
  TEAM_STATUS_LABELS,
} from '@/types/team';

/**
 * 团队列表组件
 * 功能：展示团队列表、支持搜索、筛选、分页
 */
export function TeamList() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TeamType | ''>('');
  const [statusFilter, setStatusFilter] = useState<TeamStatus | ''>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const limit = 10;

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (typeFilter) {
        params.append('type', typeFilter);
      }

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/teams?${params.toString()}`);

      if (!response.ok) {
        throw new Error('获取团队列表失败');
      }

      const json = await response.json();
      const data = (json.data ?? json) as TeamListResponse;
      setTeams(data.teams ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取团队列表失败');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter, search]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  function handleSearch() {
    setPage(1);
    fetchTeams();
  }

  function handleKeyPress(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      handleSearch();
    }
  }

  function goToTeamDetail(id: string) {
    router.push(`/teams/${id}`);
  }

  function goToCreateTeam() {
    router.push('/teams/create');
  }

  if (loading && teams.length === 0) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchTeams} />;
  }

  return (
    <div className='space-y-6'>
      {/* 搜索和筛选栏 */}
      <div className='flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row'>
        <div className='flex-1'>
          <Input
            type='search'
            placeholder='搜索团队名称...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as TeamType | '')}
          className='rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
        >
          <option value=''>所有类型</option>
          {Object.values(TeamType).map(type => (
            <option key={type} value={type}>
              {TEAM_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TeamStatus | '')}
          className='rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
        >
          <option value=''>所有状态</option>
          {Object.values(TeamStatus).map(status => (
            <option key={status} value={status}>
              {TEAM_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <Button onClick={handleSearch}>搜索</Button>
      </div>

      {/* 团队列表 */}
      {teams.length === 0 ? (
        <EmptyState onCreate={goToCreateTeam} />
      ) : (
        <>
          <div className='space-y-4'>
            {teams.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                onClick={() => goToTeamDetail(team.id)}
              />
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className='flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800'>
              <div className='text-sm text-zinc-600 dark:text-zinc-400'>
                共 {total} 个团队，第 {page} / {totalPages} 页
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
 * 团队卡片
 */
function TeamCard({
  team,
  onClick,
}: {
  team: TeamDetail;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className='cursor-pointer rounded-lg border border-zinc-200 bg-white p-6 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700'
    >
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
            {team.name}
          </h3>
          <div className='mt-2 flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400'>
            <span>{TEAM_TYPE_LABELS[team.type]}</span>
            <span>•</span>
            <span>{TEAM_STATUS_LABELS[team.status]}</span>
            <span>•</span>
            <span>{team.memberCount ?? team.members?.length ?? 0} 成员</span>
          </div>
          {team.description && (
            <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
              {team.description}
            </p>
          )}
        </div>
        <Button variant='ghost' size='sm'>
          查看
        </Button>
      </div>
    </div>
  );
}

/**
 * 加载状态
 */
function LoadingState() {
  return (
    <div className='space-y-4'>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className='h-40 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900'
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
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950'>
      <div className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
        还没有团队
      </div>
      <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
        创建您的第一个团队开始协作
      </p>
      <Button onClick={onCreate} className='mt-4'>
        创建团队
      </Button>
    </div>
  );
}
