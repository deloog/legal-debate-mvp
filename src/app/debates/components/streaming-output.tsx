'use client';

import { useTypewriter } from '@/lib/hooks/use-debate-stream';
import { AIThinkingIndicator } from '@/components/ai/AIThinkingIndicator';

export interface StreamingOutputProps {
  content: string;
  isStreaming: boolean;
  side: 'PLAINTIFF' | 'DEFENDANT' | 'NEUTRAL';
  accentColor: 'blue' | 'red' | 'gray';
  /** 当前AI处理阶段 */
  stage?: 'analyzing' | 'searching' | 'generating' | 'reviewing';
}

/**
 * 颜色样式映射
 */
const colorStyles = {
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-300',
    indicator: 'bg-blue-500',
  },
  red: {
    border: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-700 dark:text-red-300',
    indicator: 'bg-red-500',
  },
  gray: {
    border: 'border-gray-500',
    bg: 'bg-gray-50 dark:bg-gray-950/20',
    text: 'text-gray-700 dark:text-gray-300',
    indicator: 'bg-gray-500',
  },
};

/**
 * 方向标签
 */
const sideLabels: Record<string, string> = {
  PLAINTIFF: '原告',
  DEFENDANT: '被告',
  NEUTRAL: '中立',
};

/**
 * 流式输出组件
 * 功能：实时展示AI生成的论点内容
 */
export function StreamingOutput({
  content,
  isStreaming,
  side,
  accentColor,
  stage = 'generating',
}: StreamingOutputProps) {
  const styles = colorStyles[accentColor];
  const { displayedText, isComplete } = useTypewriter({
    text: content,
    speed: 30,
    enabled: isStreaming || content.length > 0,
  });

  if (!isStreaming && !content) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border-2 ${styles.border} ${styles.bg} p-4 shadow-lg`}
    >
      {/* 头部：方向和状态 */}
      <div className='mb-3 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            {sideLabels[side]}
          </span>
          {isStreaming && (
            <div className='flex items-center gap-1'>
              <div
                className={`h-2 w-2 animate-pulse rounded-full ${styles.indicator}`}
              />
              <span className='text-xs text-zinc-500 dark:text-zinc-400'>
                生成中...
              </span>
            </div>
          )}
        </div>
        {isComplete && !isStreaming && (
          <span className='rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'>
            已完成
          </span>
        )}
      </div>

      {/* 流式输出内容 */}
      <div className='min-h-15'>
        {displayedText ? (
          <p className='text-sm leading-relaxed text-zinc-800 dark:text-zinc-200'>
            {displayedText}
            {isStreaming && !isComplete && (
              <span className='inline-block w-2 h-4 ml-1 bg-zinc-500 animate-pulse' />
            )}
          </p>
        ) : (
          <AIThinkingIndicator
            isThinking={isStreaming}
            stage={stage}
            variant='sm'
            showProgress={false}
            message={`${sideLabels[side]}论点生成中`}
          />
        )}
      </div>

      {/* 进度条 */}
      {isStreaming && (
        <div className='mt-3'>
          <div className='h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700'>
            <div
              className={`h-full ${styles.indicator} transition-all duration-300`}
              style={{
                width: `${isComplete ? 100 : (displayedText.length / Math.max(content.length, 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
