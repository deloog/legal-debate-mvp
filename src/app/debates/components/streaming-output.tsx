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
  /** 外部传入的生成进度（0-100），有内容时展示进度条 */
  progress?: number;
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
 *
 * 渲染逻辑：
 * - isStreaming=true  + content=''    → 显示 AIThinkingIndicator 动画（等待内容）
 * - isStreaming=true  + content='...' → 打字机逐字展示 + 光标 + 进度条
 * - isStreaming=false + content='...' → 打字机展示（已完成状态）
 * - isStreaming=false + content=''    → 返回 null
 */
export function StreamingOutput({
  content,
  isStreaming,
  side,
  accentColor,
  stage = 'generating',
  progress: externalProgress,
}: StreamingOutputProps) {
  const styles = colorStyles[accentColor];

  // 使用useTypewriter实现打字机效果（仅当有内容时启用动画）
  const { displayedText, isComplete } = useTypewriter({
    text: content,
    speed: 20,
    enabled: content.length > 0,
  });

  // 无内容且非流式状态 → 不渲染
  if (!isStreaming && !content) {
    return null;
  }

  // 计算进度：优先使用外部进度，否则基于已显示字符数估算
  const progressValue =
    externalProgress !== undefined
      ? externalProgress
      : content.length > 0
        ? Math.min(
            (displayedText.length / Math.max(content.length, 1)) * 100,
            99
          )
        : 0;

  return (
    <div
      className={`rounded-lg border-2 ${styles.border} ${styles.bg} p-4 shadow-lg transition-all duration-300`}
    >
      {/* 头部：方向和状态 */}
      <div className='mb-3 flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            {sideLabels[side]}
          </span>
          {isStreaming && content && (
            <div className='flex items-center gap-1'>
              <div
                className={`h-2 w-2 animate-pulse rounded-full ${styles.indicator}`}
              />
              <span className='text-xs text-zinc-500 dark:text-zinc-400 animate-pulse'>
                AI生成中...
              </span>
            </div>
          )}
        </div>
        {isComplete && !isStreaming && content && (
          <span className='rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'>
            已完成
          </span>
        )}
      </div>

      {/* 流式输出内容 */}
      <div className='min-h-[60px]'>
        {/* 有实际文字内容时：打字机展示 */}
        {displayedText ? (
          <div className='relative'>
            <p className='text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap'>
              {displayedText}
              {isStreaming && !isComplete && (
                <span className='inline-block w-2 h-4 ml-1 bg-zinc-500 animate-pulse align-middle' />
              )}
            </p>
          </div>
        ) : (
          /* 流式状态但尚无文字：显示 AI 思考动画 */
          <AIThinkingIndicator
            isThinking={isStreaming}
            stage={stage}
            variant='sm'
            showProgress={false}
            message={`${sideLabels[side]}论点生成中`}
          />
        )}
      </div>

      {/* 进度条（仅当有实际内容时显示） */}
      {isStreaming && content && (
        <div className='mt-3'>
          <div className='h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700'>
            <div
              className={`h-full ${styles.indicator} transition-all duration-150 ease-out`}
              style={{ width: `${isComplete ? 100 : progressValue}%` }}
            />
          </div>
          <div className='mt-1 flex justify-between text-xs text-zinc-500'>
            <span>{displayedText.length} 字符</span>
            <span>{Math.round(progressValue)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
