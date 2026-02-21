'use client';

import { useState, useEffect } from 'react';
import { DebateRound, Argument } from '@prisma/client';
import { ArgumentColumn } from './argument-column';
import { RoundTimeline } from './round-timeline';
import { StreamingOutput } from './streaming-output';
import { LawArticleList } from './law-article-list';
import { DebateRecommendations } from '@/components/debate/DebateRecommendations';
import { useArgumentsByRound } from '@/lib/hooks/use-debate';
import { useDebateStream } from '@/lib/hooks/use-debate-stream';
import type {
  ArgumentEventData,
  AIStreamEventData,
} from '@/lib/debate/stream/types';

export interface DebateArenaProps {
  debateId: string;
  rounds: DebateRound[];
  currentRound: DebateRound | null;
  arguments: Argument[];
  onRoundChange: (roundId: string) => void;
}

/** AI 生成阶段循环顺序 */
const GENERATION_STAGES = [
  'analyzing',
  'searching',
  'generating',
  'reviewing',
] as const;
type GenerationStage = (typeof GENERATION_STAGES)[number];

/**
 * 辩论展示区组件
 *
 * 改进点：
 * - 轮次进行中时接入 SSE 流，实时展示 AI 生成的 token 内容
 * - 区分原告/被告流式论点内容，分列展示
 * - 尚无内容时显示 AIThinkingIndicator 思考动画（含阶段循环）
 * - 已完成轮次且论点疑似 AI 失败时，显示警告横幅 + 重试按钮
 */
export function DebateArena({
  debateId,
  rounds,
  currentRound,
  arguments: argumentsList,
  onRoundChange,
}: DebateArenaProps) {
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(
    currentRound?.id || null
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // AI 生成阶段（用于 StreamingOutput 的 stage 动画）
  const [generationStage, setGenerationStage] =
    useState<GenerationStage>('analyzing');

  // SSE 流式内容（按方存储，从 argument 事件中提取）
  const [plaintiffStreamContent, setPlaintiffStreamContent] = useState('');
  const [defendantStreamContent, setDefendantStreamContent] = useState('');
  // 原始 AI token 流（在论点解析完成前供预览）
  const [rawStreamContent, setRawStreamContent] = useState('');

  // 根据选中的轮次筛选论点
  const roundArguments = useArgumentsByRound(argumentsList, selectedRoundId);

  // 找到选中的轮次对象
  const selectedRound = rounds.find(r => r.id === selectedRoundId) || null;
  const roundCompleted = selectedRound?.status === 'COMPLETED';
  const roundFailed = selectedRound?.status === 'FAILED';
  const isCurrentRoundInProgress = currentRound?.status === 'IN_PROGRESS';

  // 处理轮次切换
  const handleRoundChange = (roundId: string) => {
    setSelectedRoundId(roundId);
    onRoundChange(roundId);
  };

  // 同步当前轮次
  if (currentRound && selectedRoundId !== currentRound.id) {
    setSelectedRoundId(currentRound.id);
  }

  // 轮次变化时重置流式内容
  useEffect(() => {
    setPlaintiffStreamContent('');
    setDefendantStreamContent('');
    setRawStreamContent('');
    setGenerationStage('analyzing');
  }, [selectedRoundId]);

  // 轮次进行中时循环切换 AI 生成阶段（每 4 秒一个阶段）
  useEffect(() => {
    if (!isCurrentRoundInProgress) return;

    let stageIndex = 0;
    const interval = setInterval(() => {
      stageIndex = (stageIndex + 1) % GENERATION_STAGES.length;
      setGenerationStage(GENERATION_STAGES[stageIndex]);
    }, 4000);

    return () => clearInterval(interval);
  }, [isCurrentRoundInProgress]);

  // SSE 只在"初始生成路径"下连接：
  //   初始生成 → 轮次 IN_PROGRESS（外部触发），SSE 接入 /stream 实时推送
  //   重试路径 → handleRetryGeneration 调用 /generate，关闭 SSE 避免双重生成
  const sseEnabled = isCurrentRoundInProgress && !isRetrying;

  // 流式展示区可见条件（两条路径都需要显示等待/生成动画）
  const showStreamingArea = isCurrentRoundInProgress || isRetrying;

  // 接入 SSE 流式输出
  const { progress: streamProgress } = useDebateStream({
    debateId,
    roundId: selectedRoundId,
    enabled: sseEnabled,
    onError: err => {
      const msg = err instanceof Error ? err.message : 'AI 生成出错，请重试';
      setRetryError(msg);
    },
    onMessage: message => {
      // 收到具体论点（已完成解析的结构化数据）
      if (message.event === 'argument') {
        const argData = message.data as ArgumentEventData;
        const text = argData.content?.trim();
        if (!text) return;
        if (argData.side === 'PLAINTIFF') {
          setPlaintiffStreamContent(prev =>
            prev ? `${prev}\n\n${text}` : text
          );
        } else if (argData.side === 'DEFENDANT') {
          setDefendantStreamContent(prev =>
            prev ? `${prev}\n\n${text}` : text
          );
        }
      }
      // 收到原始 AI token（尚未解析成论点时的中间内容）
      if (message.event === 'ai_stream') {
        const streamData = message.data as AIStreamEventData;
        if (streamData.content) {
          setRawStreamContent(prev => prev + streamData.content);
        }
      }
    },
    onComplete: () => {
      // 流完成后延迟重置（等待页面轮询刷新论点卡片）
      setTimeout(() => {
        setPlaintiffStreamContent('');
        setDefendantStreamContent('');
        setRawStreamContent('');
      }, 1500);
    },
  });

  // 重新生成当前轮次
  const handleRetryGeneration = async () => {
    if (!selectedRoundId || isRetrying) return;
    setIsRetrying(true);
    setRetryError(null);
    // 重置流式内容
    setPlaintiffStreamContent('');
    setDefendantStreamContent('');
    setRawStreamContent('');
    setGenerationStage('analyzing');
    try {
      // 先重置轮次状态为 IN_PROGRESS
      const resetRes = await fetch(
        `/api/v1/debates/${debateId}/rounds/${selectedRoundId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'IN_PROGRESS' }),
        }
      );
      if (!resetRes.ok) throw new Error('重置轮次状态失败，请稍后重试');

      // 触发重新生成
      const genRes = await fetch(
        `/api/v1/debates/${debateId}/rounds/${selectedRoundId}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicableArticles: [] }),
        }
      );
      if (!genRes.ok) throw new Error('AI 生成请求失败，请稍后重试');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : '重新生成失败，请稍后重试';
      setRetryError(msg);
      console.error('重新生成失败:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* 重试失败错误提示 */}
      {retryError && (
        <div className='flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20'>
          <svg
            className='mt-0.5 h-4 w-4 shrink-0 text-red-500'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
            />
          </svg>
          <div className='flex-1'>
            <p className='text-sm text-red-700 dark:text-red-300'>
              {retryError}
            </p>
          </div>
          <button
            onClick={() => setRetryError(null)}
            className='text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300'
            aria-label='关闭'
          >
            <svg
              className='h-4 w-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>
      )}

      {/* FAILED 轮次横幅：提示用户此轮生成失败，可点击重试 */}
      {roundFailed && !isRetrying && (
        <div className='flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20'>
          <svg
            className='mt-0.5 h-4 w-4 shrink-0 text-red-500'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
            />
          </svg>
          <div className='flex-1'>
            <p className='text-sm font-medium text-red-700 dark:text-red-300'>
              本轮 AI 生成失败
            </p>
            <p className='mt-0.5 text-xs text-red-600 dark:text-red-400'>
              论点未能成功生成，点击下方按钮重新生成本轮内容。
            </p>
          </div>
          <button
            onClick={() => void handleRetryGeneration()}
            className='shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600'
          >
            重新生成
          </button>
        </div>
      )}

      {/* 轮次时间轴 */}
      <RoundTimeline
        rounds={rounds}
        currentRoundId={selectedRoundId}
        onRoundChange={handleRoundChange}
        arguments={argumentsList}
      />

      {/* 辩论主展示区 */}
      {selectedRoundId && currentRound && (
        <div className='space-y-4'>
          {/* ── 流式输出区（轮次进行中 或 正在重试时展示）── */}
          {showStreamingArea && (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h3 className='text-sm font-semibold text-zinc-700 dark:text-zinc-300'>
                  {isRetrying ? 'AI 重新生成中' : 'AI 实时生成'}
                </h3>
                {streamProgress > 0 && (
                  <span className='text-xs tabular-nums text-zinc-500 dark:text-zinc-400'>
                    {Math.round(streamProgress)}%
                  </span>
                )}
              </div>

              {/* 原始 token 流预览（SSE 路径有内容时展示） */}
              {rawStreamContent && (
                <StreamingOutput
                  content={rawStreamContent}
                  isStreaming={showStreamingArea}
                  side='NEUTRAL'
                  accentColor='gray'
                  stage={generationStage}
                  progress={streamProgress || undefined}
                />
              )}

              {/* 双方论点流式展示 */}
              <div className='grid gap-3 md:grid-cols-2'>
                <StreamingOutput
                  content={plaintiffStreamContent}
                  isStreaming={showStreamingArea}
                  side='PLAINTIFF'
                  accentColor='blue'
                  stage={generationStage}
                  progress={streamProgress || undefined}
                />
                <StreamingOutput
                  content={defendantStreamContent}
                  isStreaming={showStreamingArea}
                  side='DEFENDANT'
                  accentColor='red'
                  stage={generationStage}
                  progress={streamProgress || undefined}
                />
              </div>
            </div>
          )}

          {/* 辩论推荐法条 */}
          <DebateRecommendations debateId={debateId} showFilter={true} />

          {/* 法条推荐列表 */}
          <LawArticleList debateId={debateId} roundId={selectedRoundId} />

          {/* ── 论点展示区（轮次完成后显示结构化卡片）── */}
          <div className='grid gap-6 md:grid-cols-2'>
            <ArgumentColumn
              title='原告方'
              side='PLAINTIFF'
              arguments={roundArguments}
              accentColor='blue'
              roundCompleted={roundCompleted}
              onRetryGeneration={handleRetryGeneration}
              isRetrying={isRetrying}
            />
            <ArgumentColumn
              title='被告方'
              side='DEFENDANT'
              arguments={roundArguments}
              accentColor='red'
              roundCompleted={roundCompleted}
              onRetryGeneration={handleRetryGeneration}
              isRetrying={isRetrying}
            />
          </div>

          {/* 中立方论点列（如果有） */}
          {roundArguments.some(arg => arg.side === 'NEUTRAL') && (
            <ArgumentColumn
              title='中立方'
              side='NEUTRAL'
              arguments={roundArguments}
              accentColor='gray'
            />
          )}
        </div>
      )}

      {/* 无轮次选中时的提示 */}
      {!selectedRoundId && (
        <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-12 text-center dark:border-zinc-700 dark:bg-zinc-900'>
          <svg
            className='mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={1.5}
              d='M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'
            />
          </svg>
          <p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>
            点击上方轮次节点查看辩论内容
          </p>
          <p className='mt-1 text-xs text-zinc-400 dark:text-zinc-500'>
            选择任意轮次以展开论点详情与法律依据
          </p>
        </div>
      )}
    </div>
  );
}
