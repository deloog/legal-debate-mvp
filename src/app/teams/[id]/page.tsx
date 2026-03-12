'use client';

import { TeamDetail } from '@/types/team';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * 团队详情页面主入口
 * 功能：展示团队信息、团队成员、支持编辑和成员管理
 */
export default function TeamDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/teams/${id}`);

      if (!response.ok) {
        throw new Error('获取团队信息失败');
      }

      const data = (await response.json()) as TeamDetail;
      setTeam(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取团队信息失败');
      setTeam(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchTeam();
    }
  }, [id, fetchTeam]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={fetchTeam} />;
  }

  if (!team) {
    return <NotFoundState />;
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => router.back()}
              className='text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            >
              返回
            </button>
            <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
              团队详情
            </h1>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className='text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
          >
            {isEditing ? '取消编辑' : '编辑团队'}
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          {/* 团队信息卡片 */}
          <div className='lg:col-span-1'>
            <Suspense fallback={<div className='h-40 animate-pulse' />}>
              <TeamInfoCard team={team} isEditing={isEditing} />
            </Suspense>
          </div>

          {/* 成员列表 */}
          <div className='lg:col-span-2'>
            <Suspense fallback={<div className='h-40 animate-pulse' />}>
              <TeamMemberList teamId={team.id} />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * 团队信息卡片
 */
function TeamInfoCard({
  team,
  isEditing,
}: {
  team: TeamDetail;
  isEditing: boolean;
}) {
  if (isEditing) {
    return (
      <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
        <h2 className='mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
          编辑团队信息
        </h2>
        <TeamForm team={team} onSuccess={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
      <h2 className='mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
        团队信息
      </h2>
      <dl className='space-y-4'>
        <div>
          <dt className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
            团队名称
          </dt>
          <dd className='mt-1 text-sm text-zinc-900 dark:text-zinc-50'>
            {team.name}
          </dd>
        </div>
        <div>
          <dt className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
            团队类型
          </dt>
          <dd className='mt-1 text-sm text-zinc-900 dark:text-zinc-50'>
            {team.type}
          </dd>
        </div>
        <div>
          <dt className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
            状态
          </dt>
          <dd className='mt-1 text-sm text-zinc-900 dark:text-zinc-50'>
            {team.status}
          </dd>
        </div>
        <div>
          <dt className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
            成员数
          </dt>
          <dd className='mt-1 text-sm text-zinc-900 dark:text-zinc-50'>
            {team.memberCount ?? team.members?.length ?? 0}
          </dd>
        </div>
        {team.description && (
          <div>
            <dt className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
              描述
            </dt>
            <dd className='mt-1 text-sm text-zinc-900 dark:text-zinc-50'>
              {team.description}
            </dd>
          </div>
        )}
        <div>
          <dt className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
            创建时间
          </dt>
          <dd className='mt-1 text-sm text-zinc-900 dark:text-zinc-50'>
            {new Date(team.createdAt).toLocaleString('zh-CN')}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** 成员角色标签 */
const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理员',
  LAWYER: '律师',
  PARALEGAL: '律师助理',
  OTHER: '其他',
};

/** 成员状态标签 */
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '活跃',
  INACTIVE: '不活跃',
  REMOVED: '已移除',
};

/** 单行成员数据类型 */
interface MemberRow {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  notes: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
    role: string;
  };
}

/**
 * 团队成员列表
 * 从 /api/teams/[teamId]/members 加载数据
 */
function TeamMemberList({ teamId }: { teamId: string }) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    flushSync(() => {
      setLoading(true);
      setError(null);
    });

    fetch(`/api/teams/${teamId}/members?limit=50`)
      .then(r => r.json())
      .then((data: { members?: MemberRow[]; total?: number }) => {
        if (cancelled) return;
        setMembers(data.members ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载成员列表失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
          团队成员
        </h2>
        {!loading && (
          <span className='text-sm text-zinc-500 dark:text-zinc-400'>
            共 {total} 人
          </span>
        )}
      </div>

      {loading && (
        <div className='space-y-2'>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className='h-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800'
            />
          ))}
        </div>
      )}

      {error && (
        <div className='rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400'>
          {error}
        </div>
      )}

      {!loading && !error && members.length === 0 && (
        <div className='py-8 text-center text-sm text-zinc-500 dark:text-zinc-400'>
          暂无团队成员
        </div>
      )}

      {!loading && !error && members.length > 0 && (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-zinc-100 dark:border-zinc-800'>
                <th className='pb-2 text-left font-medium text-zinc-600 dark:text-zinc-400'>
                  成员
                </th>
                <th className='pb-2 text-left font-medium text-zinc-600 dark:text-zinc-400'>
                  角色
                </th>
                <th className='pb-2 text-left font-medium text-zinc-600 dark:text-zinc-400'>
                  状态
                </th>
                <th className='pb-2 text-left font-medium text-zinc-600 dark:text-zinc-400'>
                  加入时间
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-zinc-100 dark:divide-zinc-800'>
              {members.map(member => (
                <tr key={member.id}>
                  <td className='py-3 pr-4'>
                    <div className='font-medium text-zinc-900 dark:text-zinc-50'>
                      {member.user?.name ?? member.userId}
                    </div>
                    {member.user?.email && (
                      <div className='text-xs text-zinc-500 dark:text-zinc-400'>
                        {member.user.email}
                      </div>
                    )}
                  </td>
                  <td className='py-3 pr-4'>
                    <span className='rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'>
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  </td>
                  <td className='py-3 pr-4'>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        member.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {STATUS_LABELS[member.status] ?? member.status}
                    </span>
                  </td>
                  <td className='py-3 text-zinc-600 dark:text-zinc-400'>
                    {new Date(member.joinedAt).toLocaleDateString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * 团队表单占位符
 */
function TeamForm({
  team,
  onSuccess,
}: {
  team: TeamDetail;
  onSuccess: () => void;
}) {
  return (
    <form className='space-y-4'>
      <div>
        <label className='block text-sm font-medium text-zinc-700 dark:text-zinc-300'>
          团队名称
        </label>
        <input
          type='text'
          defaultValue={team.name}
          className='mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
        />
      </div>
      <button
        type='button'
        onClick={onSuccess}
        className='w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
      >
        保存
      </button>
    </form>
  );
}

/**
 * 加载状态
 */
function LoadingState() {
  return (
    <div className='flex min-h-screen items-center justify-center'>
      <div className='text-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100' />
        <p className='mt-4 text-sm text-zinc-600 dark:text-zinc-400'>
          加载中...
        </p>
      </div>
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
    <div className='flex min-h-screen items-center justify-center'>
      <div className='text-center'>
        <div className='mb-4 text-6xl'>😢</div>
        <h2 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
          加载失败
        </h2>
        <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>{error}</p>
        <button
          onClick={onRetry}
          className='mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
        >
          重试
        </button>
      </div>
    </div>
  );
}

/**
 * 未找到状态
 */
function NotFoundState() {
  return (
    <div className='flex min-h-screen items-center justify-center'>
      <div className='text-center'>
        <div className='mb-4 text-6xl'>🔍</div>
        <h2 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
          团队不存在
        </h2>
        <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
          该团队可能已被删除或您没有访问权限
        </p>
        <button
          onClick={() => window.history.back()}
          className='mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
        >
          返回
        </button>
      </div>
    </div>
  );
}
