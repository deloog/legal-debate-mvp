'use client';

import { Suspense, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDebate } from '@/lib/hooks/use-debate';
import { DebateArena } from '../components/debate-arena';
import type { Argument } from '@prisma/client';

/** 从论点列表计算质量评分摘要 */
function calcQualityStats(args: Argument[]) {
  const scored = args.filter(a => a.overallScore != null);
  if (scored.length === 0) return null;
  const avg = (key: keyof Argument) => {
    const vals = scored.map(a => a[key] as number).filter(v => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  return {
    overall: avg('overallScore'),
    legal: avg('legalScore'),
    logic: avg('logicScore'),
    confidence: avg('confidence'),
    scoredCount: scored.length,
    total: args.length,
  };
}

function ScoreBar({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className='mb-1 flex items-center justify-between text-xs'>
        <span className='text-zinc-600 dark:text-zinc-400'>{label}</span>
        <span className={`font-semibold ${color}`}>{pct}%</span>
      </div>
      <div className='h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700'>
        <div
          className={`h-full rounded-full transition-all ${color.replace('text-', 'bg-')}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 辩论页面主入口
 * 功能：展示辩论界面，包括轮次选择和正反方论点展示
 */
export default function DebatesPage() {
  const params = useParams();
  const router = useRouter();
  const debateId = typeof params?.id === 'string' ? params.id : '';

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    debate,
    rounds,
    currentRound,
    arguments: argumentsList,
    isLoading,
    error,
  } = useDebate(debateId, 5000);

  // 处理轮次切换（空函数，DebateArena内部管理状态）
  const handleRoundChange = () => {
    // 状态由DebateArena组件内部管理
  };

  // 必须在所有 early return 前调用（React Hooks 规则）
  const qualityStats = useMemo(
    () => calcQualityStats(argumentsList),
    [argumentsList]
  );

  // 加载状态
  if (isLoading) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black'>
        <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
          <div className='mx-auto max-w-7xl'>
            <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
              加载中...
            </h1>
          </div>
        </header>
        <LoadingSkeleton />
      </div>
    );
  }

  // 错误状态
  if (error || !debate) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black'>
        <div className='rounded-lg border border-red-200 bg-white p-8 text-center dark:border-red-800 dark:bg-zinc-950'>
          <div className='mb-4 text-red-500'>
            <svg
              className='mx-auto h-16 w-16'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
              />
            </svg>
          </div>
          <h2 className='mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
            {error || '未找到辩论'}
          </h2>
          <p className='mb-4 text-sm text-zinc-600 dark:text-zinc-400'>
            请检查辩论ID是否正确，或返回案件列表重试
          </p>
          <button
            onClick={() => router.push('/cases')}
            className='rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600'
          >
            返回案件列表
          </button>
        </div>
      </div>
    );
  }

  const isDebateCompleted = debate.status === 'COMPLETED';

  const handleDeleteDebate = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/debates/${debateId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? '删除失败');
        return;
      }
      router.push('/cases');
    } catch {
      alert('删除失败，请稍后重试');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-zinc-950'>
      {/* 辩论已结束横幅 */}
      {isDebateCompleted && (
        <div className='border-b border-green-200 bg-green-50 px-6 py-2 dark:border-green-800 dark:bg-green-900/20'>
          <div className='mx-auto flex max-w-7xl items-center gap-2'>
            <svg
              className='h-4 w-4 shrink-0 text-green-600 dark:text-green-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <span className='text-sm font-medium text-green-700 dark:text-green-300'>
              辩论已完成 · 共 {rounds.length} 轮 · {argumentsList.length} 条论点
            </span>
            <button
              onClick={() => router.push(`/debates/${debateId}/summary`)}
              className='ml-auto rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600'
            >
              查看辩论总结
            </button>
          </div>
        </div>
      )}

      {/* AI 质量评分面板（辩论完成且有评分时展示） */}
      {isDebateCompleted && qualityStats && (
        <div className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900'>
          <div className='mx-auto max-w-7xl'>
            <div className='flex items-start gap-6'>
              {/* 综合评分 */}
              <div className='flex shrink-0 flex-col items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950'>
                <span className='text-3xl font-bold text-zinc-900 dark:text-zinc-50'>
                  {Math.round((qualityStats.overall ?? 0) * 100)}
                </span>
                <span className='mt-0.5 text-xs text-zinc-500 dark:text-zinc-400'>
                  综合评分
                </span>
              </div>
              {/* 分项评分 */}
              <div className='flex-1 space-y-2.5'>
                <p className='text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500'>
                  AI 质量评估 · {qualityStats.scoredCount}/{qualityStats.total}{' '}
                  条论点已评分
                </p>
                {qualityStats.legal != null && (
                  <ScoreBar
                    value={qualityStats.legal}
                    label='法条依据'
                    color='text-blue-600 dark:text-blue-400'
                  />
                )}
                {qualityStats.logic != null && (
                  <ScoreBar
                    value={qualityStats.logic}
                    label='逻辑一致性'
                    color='text-violet-600 dark:text-violet-400'
                  />
                )}
                {qualityStats.confidence != null && (
                  <ScoreBar
                    value={qualityStats.confidence}
                    label='置信度'
                    color='text-emerald-600 dark:text-emerald-400'
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900'>
        <div className='mx-auto max-w-7xl'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
                {debate.title || '辩论'}
              </h1>
              <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
                共 {rounds.length} 轮 · {argumentsList.length} 条论点
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => router.push(`/debates/${debateId}/summary`)}
                className='rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
              >
                辩论总结
              </button>
              {/* 导出下拉按钮 */}
              <div className='relative'>
                <button
                  onClick={() => setShowExportMenu(v => !v)}
                  className='flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                >
                  导出
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`}
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M19 9l-7 7-7-7'
                    />
                  </svg>
                </button>
                {showExportMenu && (
                  <>
                    {/* 点击外部关闭 */}
                    <div
                      className='fixed inset-0 z-10'
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className='absolute right-0 z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900'>
                      <a
                        href={`/api/v1/debates/${debateId}/export?format=markdown`}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className='flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-t-lg'
                      >
                        <svg
                          className='h-4 w-4 text-zinc-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                          />
                        </svg>
                        导出 Markdown
                      </a>
                      <a
                        href={`/api/v1/debates/${debateId}/export?format=json`}
                        download
                        onClick={() => setShowExportMenu(false)}
                        className='flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-b-lg'
                      >
                        <svg
                          className='h-4 w-4 text-zinc-400'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582 4-8 4s8 1.79 8 4'
                          />
                        </svg>
                        导出 JSON
                      </a>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className='rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-900/20'
              >
                删除辩论
              </button>
              <button
                onClick={() => router.push('/cases')}
                className='rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
              >
                返回
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        <Suspense fallback={<LoadingSkeleton />}>
          <DebateArena
            debateId={debateId}
            rounds={rounds}
            currentRound={currentRound}
            arguments={argumentsList}
            onRoundChange={handleRoundChange}
            caseId={debate.caseId ?? undefined}
          />
        </Suspense>
      </main>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4'>
          <div className='w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900'>
            <h3 className='mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100'>
              确认删除辩论？
            </h3>
            <p className='mb-1 text-sm text-zinc-600 dark:text-zinc-400'>
              将永久删除辩论「{debate.title}」及所有轮次、论点数据，
            </p>
            <p className='mb-5 text-sm font-medium text-red-600 dark:text-red-400'>
              此操作不可撤销。
            </p>
            <div className='flex justify-end gap-2'>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className='rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
              >
                取消
              </button>
              <button
                onClick={() => void handleDeleteDebate()}
                disabled={isDeleting}
                className='rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600'
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 加载骨架屏
 */
function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      {/* 轮次选择器骨架 */}
      <div className='space-y-2'>
        <div className='h-5 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
        <div className='flex gap-2'>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className='h-24 w-40 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900'
            />
          ))}
        </div>
      </div>

      {/* 论点列骨架 */}
      <div className='grid gap-6 md:grid-cols-2'>
        {[...Array(2)].map((_, i) => (
          <div key={i} className='space-y-3'>
            <div className='h-12 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800' />
            <div className='space-y-3'>
              {[...Array(2)].map((_, j) => (
                <div
                  key={j}
                  className='h-32 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900'
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
