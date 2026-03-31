'use client';

import { DebateRound, Argument } from '@prisma/client';

export interface RoundTimelineProps {
  rounds: DebateRound[];
  currentRoundId: string | null;
  onRoundChange: (roundId: string) => void;
  /** 所有论点（用于计算每轮双方论点数，以及判断中断轮次） */
  arguments?: Argument[];
}

/**
 * 轮次状态配置
 */
const statusConfig: Record<
  string,
  { label: string; dotClass: string; lineClass: string; badgeClass: string }
> = {
  PENDING: {
    label: '待开始',
    dotClass: 'bg-zinc-300 dark:bg-zinc-600',
    lineClass: 'bg-zinc-200 dark:bg-zinc-700',
    badgeClass: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
  IN_PROGRESS: {
    label: '进行中',
    dotClass: 'bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/40',
    lineClass: 'bg-blue-200 dark:bg-blue-800',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  COMPLETED: {
    label: '已完成',
    dotClass: 'bg-green-500',
    lineClass: 'bg-green-200 dark:bg-green-800',
    badgeClass:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
  FAILED: {
    label: '生成失败',
    dotClass: 'bg-red-400',
    lineClass: 'bg-red-200 dark:bg-red-800',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
};

/**
 * 轮次时间轴组件
 *
 * 替代 RoundSelector（水平标签页），提供：
 * - 可视化时间轴节点（状态颜色编码）
 * - 每轮双方论点数量气泡
 * - 轮次时间显示
 * - 活跃轮次高亮
 */
export function RoundTimeline({
  rounds,
  currentRoundId,
  onRoundChange,
  arguments: argumentsList = [],
}: RoundTimelineProps) {
  if (rounds.length === 0) {
    return (
      <div className='rounded-lg border border-zinc-200 bg-white p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'>
        暂无轮次数据
      </div>
    );
  }

  return (
    <div className='rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900'>
      <h3 className='mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300'>
        辩论轮次
      </h3>

      {/* 时间轴 */}
      <div className='flex items-start gap-0 overflow-x-auto pt-3 pb-3 scrollbar-thin'>
        {rounds.map((round, index) => {
          const config = statusConfig[round.status] ?? statusConfig.PENDING;
          const isActive = round.id === currentRoundId;
          const isLast = index === rounds.length - 1;

          // 计算本轮各方论点数
          const plaintiffCount = argumentsList.filter(
            a => a.roundId === round.id && a.side === 'PLAINTIFF'
          ).length;
          const defendantCount = argumentsList.filter(
            a => a.roundId === round.id && a.side === 'DEFENDANT'
          ).length;

          // IN_PROGRESS 且该轮无论点 → 视为中断轮次，显示为"待开始"样式
          const roundArgCount = (argumentsList ?? []).filter(
            a => a.roundId === round.id
          ).length;
          const isInterrupted =
            round.status === 'IN_PROGRESS' && roundArgCount === 0;
          const displayConfig = isInterrupted ? statusConfig.PENDING : config;

          return (
            <div
              key={round.id}
              className='flex min-w-[90px] flex-1 flex-col items-center'
            >
              {/* 连接线 + 节点行 */}
              <div className='flex w-full items-center'>
                {/* 左侧连接线（第一个节点无左线） */}
                {index > 0 ? (
                  <div
                    className={`h-0.5 flex-1 ${statusConfig[rounds[index - 1].status]?.lineClass ?? 'bg-zinc-200'}`}
                  />
                ) : (
                  <div className='flex-1' />
                )}

                {/* 节点圆点（可点击） */}
                <button
                  onClick={() => onRoundChange(round.id)}
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${displayConfig.dotClass} ${
                    isActive ? 'scale-110 shadow-md' : ''
                  }`}
                  aria-label={`第${index + 1}轮 ${displayConfig.label}`}
                >
                  {round.status === 'IN_PROGRESS' && !isInterrupted && (
                    <span className='absolute inset-0 animate-ping rounded-full bg-blue-400 opacity-30' />
                  )}
                  {round.status === 'COMPLETED' && (
                    <svg
                      className='h-4 w-4 text-white'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2.5}
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  )}
                  {round.status === 'IN_PROGRESS' && !isInterrupted && (
                    <span className='h-2.5 w-2.5 rounded-full bg-white' />
                  )}
                  {(round.status === 'PENDING' ||
                    round.status === 'FAILED' ||
                    isInterrupted) && (
                    <span className='text-xs font-bold text-white'>
                      {index + 1}
                    </span>
                  )}
                </button>

                {/* 右侧连接线（最后节点无右线） */}
                {!isLast ? (
                  <div className={`h-0.5 flex-1 ${config.lineClass}`} />
                ) : (
                  <div className='flex-1' />
                )}
              </div>

              {/* 节点下方信息卡 */}
              <button
                onClick={() => onRoundChange(round.id)}
                className={`mt-2 w-full max-w-[120px] rounded-lg border px-2 py-2 text-left transition-all hover:shadow-sm ${
                  isActive
                    ? 'border-blue-400 bg-blue-50 shadow-sm dark:border-blue-600 dark:bg-blue-950/30'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
                }`}
              >
                {/* 轮次标题 + 状态徽章 */}
                <div className='mb-1.5 flex items-center justify-between gap-1'>
                  <span
                    className={`text-xs font-semibold ${
                      isActive
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    第{index + 1}轮
                  </span>
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] font-medium ${displayConfig.badgeClass}`}
                  >
                    {displayConfig.label}
                  </span>
                </div>

                {/* 双方论点数量 */}
                {(plaintiffCount > 0 || defendantCount > 0) && (
                  <div className='flex items-center gap-1.5'>
                    <span className='inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400'>
                      <span className='inline-block h-1.5 w-1.5 rounded-full bg-blue-500' />
                      原 {plaintiffCount}
                    </span>
                    <span className='inline-flex items-center gap-0.5 text-[10px] text-red-600 dark:text-red-400'>
                      <span className='inline-block h-1.5 w-1.5 rounded-full bg-red-500' />
                      被 {defendantCount}
                    </span>
                  </div>
                )}

                {/* 轮次时间 */}
                {round.startedAt && (
                  <div className='mt-1 text-[10px] text-zinc-400 dark:text-zinc-500'>
                    {new Date(round.startedAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 图例说明 */}
      <div className='mt-3 flex flex-wrap gap-3 border-t border-zinc-100 pt-2 dark:border-zinc-800'>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <span
            key={key}
            className='flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400'
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${cfg.dotClass.replace(' ring-4 ring-blue-100 dark:ring-blue-900/40', '')}`}
            />
            {cfg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
