'use client';

import { TeamDetail } from '@/types/team';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

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
            {team.memberCount ?? team.members ?? 0}
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

/**
 * 成员列表占位符
 */
function TeamMemberList({}: { teamId: string }) {
  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
      <h2 className='mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
        团队成员
      </h2>
      <div className='text-center text-sm text-zinc-600 dark:text-zinc-400'>
        成员列表组件待实现
      </div>
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
