'use client';

import { DebateRound } from '@prisma/client';

export interface RoundSelectorProps {
  rounds: DebateRound[];
  currentRoundId: string | null;
  onRoundChange: (roundId: string) => void;
}

/**
 * 轮次状态标签样式
 */
const statusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待开始', color: 'bg-gray-100 text-gray-700' },
  IN_PROGRESS: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-700' },
  TERMINATED: { label: '已终止', color: 'bg-red-100 text-red-700' },
};

/**
 * 轮次选择器组件
 * 功能：选择当前展示的轮次
 */
export function RoundSelector({
  rounds,
  currentRoundId,
  onRoundChange,
}: RoundSelectorProps) {
  if (rounds.length === 0) {
    return (
      <div className='rounded-lg border border-zinc-200 bg-white p-4 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'>
        暂无轮次
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <h3 className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
        选择轮次
      </h3>
      <div className='flex gap-2 overflow-x-auto pb-2'>
        {rounds.map((round, index) => {
          const status = statusLabels[round.status] || statusLabels.PENDING;
          const isActive = round.id === currentRoundId;

          return (
            <button
              key={round.id}
              onClick={() => onRoundChange(round.id)}
              className={`shrink-0 rounded-lg border px-4 py-3 text-left transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/20'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
              }`}
            >
              {/* 轮次标题 */}
              <div className='mb-1 flex items-center gap-2'>
                <span
                  className={`font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-700 dark:text-zinc-300'}`}
                >
                  第{index + 1}轮
                </span>
                <span className={`rounded px-2 py-0.5 text-xs ${status.color}`}>
                  {status.label}
                </span>
              </div>

              {/* 轮次时间 */}
              {round.startedAt && (
                <div className='mt-1 text-xs text-zinc-400 dark:text-zinc-500'>
                  {new Date(round.startedAt).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
