'use client';

import { useState } from 'react';
import { Argument } from '@prisma/client';
import { ArgumentCard } from './argument-card';

export interface ArgumentColumnProps {
  title: string;
  side: 'PLAINTIFF' | 'DEFENDANT' | 'NEUTRAL';
  arguments: Argument[];
  streamingArgumentId?: string | null;
  accentColor: 'blue' | 'red' | 'gray';
  /** 当前轮次是否已完成（用于判断AI失败警告） */
  roundCompleted?: boolean;
  /** 触发重新生成当前轮次 */
  onRetryGeneration?: () => void;
  isRetrying?: boolean;
}

/**
 * 颜色样式映射
 */
const colorStyles = {
  blue: {
    header: 'bg-blue-500',
    border: 'border-blue-500/20',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-300',
  },
  red: {
    header: 'bg-red-500',
    border: 'border-red-500/20',
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-700 dark:text-red-300',
  },
  gray: {
    header: 'bg-gray-500',
    border: 'border-gray-500/20',
    bg: 'bg-gray-50 dark:bg-gray-950/20',
    text: 'text-gray-700 dark:text-gray-300',
  },
};

/**
 * 判断当前列论点是否疑似使用了AI兜底模板
 * 触发条件：reasoning 全为 null，或 legalBasis 全为空数组
 */
function looksLikeFallback(args: Argument[]): boolean {
  if (args.length === 0) return false;
  const allMissingReasoning = args.every(a => !a.reasoning);
  const allMissingLegal = args.every(a => {
    const lb = a.legalBasis;
    return !lb || (Array.isArray(lb) && (lb as unknown[]).length === 0);
  });
  return allMissingReasoning || allMissingLegal;
}

/**
 * 论点列组件
 * 功能：展示单方（原告/被告/中立）的所有论点
 * 当轮次已完成但论点疑似AI生成失败时显示警告横幅和重试按钮
 */
export function ArgumentColumn({
  title,
  side,
  arguments: argumentsList,
  streamingArgumentId,
  accentColor,
  roundCompleted,
  onRetryGeneration,
  isRetrying,
}: ArgumentColumnProps) {
  const styles = colorStyles[accentColor];
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRetryClick = () => setShowConfirm(true);
  const handleConfirmRetry = () => {
    setShowConfirm(false);
    onRetryGeneration?.();
  };
  const filteredArguments = argumentsList.filter(arg => arg.side === side);

  // 当轮次完成但论点疑似兜底内容时，显示警告
  const showFallbackWarning =
    roundCompleted &&
    filteredArguments.length > 0 &&
    looksLikeFallback(filteredArguments);

  return (
    <div
      className={`flex flex-col rounded-xl border ${styles.border} ${styles.bg}`}
    >
      {/* 列标题 */}
      <div
        className={`${styles.header} rounded-t-xl px-4 py-3 text-center font-medium text-white`}
      >
        {title}
        <span className='ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs'>
          {filteredArguments.length}
        </span>
      </div>

      {/* AI生成失败警告横幅 */}
      {showFallbackWarning && (
        <div className='mx-4 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-900/20'>
          <div className='flex items-start gap-2'>
            <svg
              className='mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-2.694-.834-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z'
              />
            </svg>
            <div className='flex-1'>
              <p className='text-xs font-medium text-amber-800 dark:text-amber-300'>
                论点内容不完整
              </p>
              <p className='mt-0.5 text-xs text-amber-700 dark:text-amber-400'>
                AI 未能生成完整的分析推理，建议重新生成以获得更好的结果。
              </p>
              {onRetryGeneration && (
                <>
                  <button
                    onClick={handleRetryClick}
                    disabled={isRetrying}
                    className='mt-1.5 rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600'
                  >
                    {isRetrying ? '重新生成中…' : '重新生成本轮'}
                  </button>

                  {/* 确认弹窗 */}
                  {showConfirm && (
                    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
                      <div className='mx-4 w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900'>
                        <h3 className='mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
                          确认重新生成？
                        </h3>
                        <p className='mb-1 text-xs text-zinc-600 dark:text-zinc-400'>
                          将删除本轮所有{' '}
                          <strong>
                            {argumentsList.filter(a => a.side === side).length}
                          </strong>{' '}
                          条论点，此操作
                          <strong className='text-red-600'>不可撤销</strong>。
                        </p>
                        <p className='mb-4 text-xs text-zinc-500 dark:text-zinc-500'>
                          建议在重新生成前手动记录您认为有价值的论点。
                        </p>
                        <div className='flex justify-end gap-2'>
                          <button
                            onClick={() => setShowConfirm(false)}
                            className='rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800'
                          >
                            取消
                          </button>
                          <button
                            onClick={handleConfirmRetry}
                            className='rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
                          >
                            确认删除并重新生成
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 论点列表 */}
      <div className='flex-1 space-y-3 p-4'>
        {filteredArguments.length === 0 ? (
          <div className='flex h-32 flex-col items-center justify-center gap-2 text-sm text-zinc-400'>
            <svg
              className='h-8 w-8 text-zinc-300 dark:text-zinc-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1.5}
                d='M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
              />
            </svg>
            暂无论点
          </div>
        ) : (
          <div className='space-y-3'>
            {filteredArguments.map(argument => (
              <ArgumentCard
                key={argument.id}
                argument={argument}
                isStreaming={argument.id === streamingArgumentId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
