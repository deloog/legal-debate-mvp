'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { DebateRound, Argument } from '@prisma/client';
import { RoundTimeline } from './round-timeline';
import { ArgumentCard } from './argument-card';
import { StreamingOutput } from './streaming-output';
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
  /** 辩论所属案件ID（用于读取证据链分析结果） */
  caseId?: string;
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
  caseId,
}: DebateArenaProps) {
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(
    currentRound?.id || null
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // 开始新轮次
  const [isStartingRound, setIsStartingRound] = useState(false);
  const [startRoundError, setStartRoundError] = useState<string | null>(null);
  // 法条检索进度提示（在"开始辩论"流程中展示）
  const [lawSearchMessage, setLawSearchMessage] = useState<string | null>(null);
  // SSE 实时返回的法条列表（逐条流式显示后固定展示）
  const [streamingLawArticles, setStreamingLawArticles] = useState<
    Array<{ lawName: string; articleNumber: string }>
  >([]);
  // 当前已显示的法条数量（用于逐条流式出现效果）
  const [visibleArticleCount, setVisibleArticleCount] = useState(0);
  // 法条区是否折叠
  const [lawArticlesCollapsed, setLawArticlesCollapsed] = useState(false);
  // SSE 手动触发开关：用户点击"开始辩论"后打开，SSE 连接并激活 PENDING 轮次
  const [isSSEManuallyEnabled, setIsSSEManuallyEnabled] = useState(false);
  // 用户确认恢复进行中轮次的开关（防止页面加载时自动连接 SSE）
  const [userConfirmedResume, setUserConfirmedResume] = useState(false);
  // 下一轮对话框状态
  const [showNextRoundDialog, setShowNextRoundDialog] = useState(false);
  const [nextRoundContext, setNextRoundContext] = useState('');
  const [pendingNextRoundContext, setPendingNextRoundContext] = useState('');
  // 是否还有更多轮次可继续（由 completed 事件携带）
  const [hasMoreRounds, setHasMoreRounds] = useState(false);

  // 证据链分析提示（从 localStorage 读取）
  const [chainAnalysisBadge, setChainAnalysisBadge] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!caseId) return;
    try {
      const raw = localStorage.getItem(`ec-latest-${caseId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          completeness: number;
          timestamp: string;
        };
        if (parsed.completeness !== undefined) {
          setChainAnalysisBadge(
            `已有证据链分析（完整性 ${parsed.completeness.toFixed(0)}%）`
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, [caseId]);

  // AI 生成阶段（用于 StreamingOutput 的 stage 动画）
  const [generationStage, setGenerationStage] =
    useState<GenerationStage>('analyzing');

  // SSE 流式内容：先由 ai_stream 实时累加 token（给用户即时反馈），
  // 收到第一个 argument 事件后切换为干净的已解析论点文本。
  const [plaintiffStreamContent, setPlaintiffStreamContent] = useState('');
  const [defendantStreamContent, setDefendantStreamContent] = useState('');
  // 标记各方是否已开始接收 argument 事件（用于从 token 流切换到干净内容）
  const plaintiffGotArgRef = useRef(false);
  const defendantGotArgRef = useRef(false);
  // 当前正在生成的方（从 ai_stream 事件的 side 字段获取）
  const [currentStreamingSide, setCurrentStreamingSide] = useState<
    'PLAINTIFF' | 'DEFENDANT' | null
  >(null);

  // 根据选中的轮次筛选论点
  const roundArguments = useArgumentsByRound(argumentsList, selectedRoundId);

  // 从论点 legalBasis 字段提取本轮实际引用的法条（去重，持久化来源，刷新不丢失）
  const derivedLawArticles = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ lawName: string; articleNumber: string }> = [];
    for (const arg of roundArguments) {
      let basis: Array<{ lawName?: string; articleNumber?: string }> = [];
      try {
        basis =
          typeof arg.legalBasis === 'string'
            ? (JSON.parse(arg.legalBasis) as typeof basis)
            : Array.isArray(arg.legalBasis)
              ? (arg.legalBasis as typeof basis)
              : [];
      } catch {
        basis = [];
      }
      for (const b of basis) {
        if (!b.lawName) continue;
        const key = `${b.lawName}|${b.articleNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            lawName: b.lawName,
            articleNumber: b.articleNumber ?? '',
          });
        }
      }
    }
    return result;
  }, [roundArguments]);

  // 展示的法条：SSE 生成中用检索结果（有动画），完成后用从论点提取的实际引用法条（持久化）
  const displayedLawArticles =
    roundArguments.length > 0 ? derivedLawArticles : streamingLawArticles;

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

  // 同步当前轮次（用 useEffect 避免 render 中直接 setState 引发抖动）
  useEffect(() => {
    if (currentRound && selectedRoundId === null) {
      setSelectedRoundId(currentRound.id);
    }
    // 仅在没有选中轮次时自动跳转到当前轮次；用户手动切换后不强制覆盖
  }, [currentRound?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 轮次变化时重置流式内容（不在此处重置 SSE 状态，防止切换回进行中轮次时断开连接）
  useEffect(() => {
    setPlaintiffStreamContent('');
    setDefendantStreamContent('');
    setCurrentStreamingSide(null);
    setGenerationStage('analyzing');
    plaintiffGotArgRef.current = false;
    defendantGotArgRef.current = false;
    setStreamingLawArticles([]);
    setVisibleArticleCount(0);
    setLawArticlesCollapsed(false);
  }, [selectedRoundId]);

  // 仅当轮次已完成或失败时，才重置 SSE 确认状态
  // PENDING / IN_PROGRESS 不重置，否则刚设为 true 的 isSSEManuallyEnabled 会被立即覆盖
  useEffect(() => {
    const selected = rounds.find(r => r.id === selectedRoundId);
    if (
      selected &&
      (selected.status === 'COMPLETED' || selected.status === 'FAILED')
    ) {
      setUserConfirmedResume(false);
      setIsSSEManuallyEnabled(false);
    }
  }, [selectedRoundId, rounds]);

  // 法条显示逻辑：
  //   - 已有论点（完成轮次）→ 直接显示全部，无需动画（避免轮询刷新时反复重置）
  //   - SSE 流式检索中（无论点）→ 每 300ms 逐条出现（给用户实时反馈）
  useEffect(() => {
    if (displayedLawArticles.length === 0) {
      setVisibleArticleCount(0);
      return;
    }
    if (roundArguments.length > 0) {
      // 已完成轮次：立即显示全部法条
      setVisibleArticleCount(displayedLawArticles.length);
      return;
    }
    // SSE 流式检索阶段：逐条动画
    setVisibleArticleCount(0);
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      setVisibleArticleCount(count);
      if (count >= displayedLawArticles.length) clearInterval(timer);
    }, 300);
    return () => clearInterval(timer);
  }, [displayedLawArticles, roundArguments.length]);

  // 轮次进行中时循环切换 AI 生成阶段（每 4 秒一个阶段）
  useEffect(() => {
    if (!isCurrentRoundInProgress && !isSSEManuallyEnabled) return;

    let stageIndex = 0;
    const interval = setInterval(() => {
      stageIndex = (stageIndex + 1) % GENERATION_STAGES.length;
      setGenerationStage(GENERATION_STAGES[stageIndex]);
    }, 4000);

    return () => clearInterval(interval);
  }, [isCurrentRoundInProgress]);

  // SSE 连接条件：
  //   - 用户手动点击"开始辩论"（isSSEManuallyEnabled）→ SSE 激活 PENDING/IN_PROGRESS 轮次
  //   - 中断轮次用户已确认（userConfirmedResume）→ SSE 恢复生成
  //   - 重试时 isSSEManuallyEnabled 已设为 true（不被 isRetrying 阻断）
  //   - 不在创建新轮次中（isStartingRound）
  const sseEnabled =
    ((isCurrentRoundInProgress && userConfirmedResume) ||
      isSSEManuallyEnabled) &&
    !isStartingRound;

  // 流式展示区可见条件
  const showStreamingArea =
    (isCurrentRoundInProgress && userConfirmedResume) ||
    isRetrying ||
    isSSEManuallyEnabled;

  // 接入 SSE 流式输出
  const { progress: streamProgress } = useDebateStream({
    debateId,
    roundId: selectedRoundId,
    enabled: sseEnabled,
    userContext: nextRoundContext || undefined,
    onError: err => {
      let msg = 'AI 生成出错，请重试';
      if (err instanceof Error) {
        msg = err.message;
      } else if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>;
        if (typeof e.message === 'string' && e.message) {
          msg = e.message;
        } else {
          msg = JSON.stringify(err);
        }
      }
      setRetryError(msg);
    },
    onMessage: message => {
      // ── ai_stream：仅更新当前生成方指示器，不累加原始 token ──
      // AI 输出 JSON 格式，原始 token 是乱码（大括号、引号等），不适合直接展示。
      // 待 argument 事件到达后再展示干净的解析内容。
      if (message.event === 'ai_stream') {
        const streamData = message.data as AIStreamEventData;
        if (streamData.side === 'plaintiff') {
          setCurrentStreamingSide('PLAINTIFF');
        } else if (streamData.side === 'defendant') {
          setCurrentStreamingSide('DEFENDANT');
        }
      }

      // ── argument：收到解析后论点，切换为干净内容展示 ──
      if (message.event === 'argument') {
        const argData = message.data as ArgumentEventData;
        const text = argData.content?.trim();
        if (!text) return;
        if (argData.side === 'PLAINTIFF') {
          if (!plaintiffGotArgRef.current) {
            // 第一个论点：替换掉原始 token 流
            plaintiffGotArgRef.current = true;
            setPlaintiffStreamContent(text);
          } else {
            setPlaintiffStreamContent(prev => `${prev}\n\n${text}`);
          }
        } else if (argData.side === 'DEFENDANT') {
          if (!defendantGotArgRef.current) {
            defendantGotArgRef.current = true;
            setDefendantStreamContent(text);
          } else {
            setDefendantStreamContent(prev => `${prev}\n\n${text}`);
          }
        }
      }
    },
    onLawSearchComplete: articles => {
      setStreamingLawArticles(articles);
    },
    onComplete: data => {
      // 流完成后延迟重置（等待页面轮询刷新论点卡片）
      setTimeout(() => {
        setPlaintiffStreamContent('');
        setDefendantStreamContent('');
        setCurrentStreamingSide(null);
        // 法条不清除，保持固定展示在页面上
        setNextRoundContext('');
        setIsSSEManuallyEnabled(false);
        setUserConfirmedResume(false);
        plaintiffGotArgRef.current = false;
        defendantGotArgRef.current = false;
        // 如果还有更多轮次，弹出对话框让用户决定
        if (data?.hasMoreRounds) {
          setHasMoreRounds(true);
        }
      }, 1500);
    },
  });

  // 重新生成当前轮次（FAILED → IN_PROGRESS → SSE 接管生成）
  const handleRetryGeneration = async () => {
    if (!selectedRoundId || isRetrying) return;
    setIsRetrying(true);
    setRetryError(null);
    setPlaintiffStreamContent('');
    setDefendantStreamContent('');
    setCurrentStreamingSide(null);
    setGenerationStage('analyzing');
    try {
      // PATCH：FAILED → IN_PROGRESS（删除旧论点 + 清除软锁，状态机允许此转换）
      const resetRes = await fetch(
        `/api/v1/debates/${debateId}/rounds/${selectedRoundId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'IN_PROGRESS' }),
        }
      );
      if (!resetRes.ok) throw new Error('重置轮次状态失败，请稍后重试');
      // 通过 SSE 触发重新生成（/generate 已废弃）
      setIsSSEManuallyEnabled(true);
    } catch (err) {
      setRetryError(
        err instanceof Error ? err.message : '重新生成失败，请稍后重试'
      );
    } finally {
      setIsRetrying(false);
    }
  };

  // 找到待开始的轮次（辩论创建时预建但尚未启动生成）
  const pendingRound = rounds.find(r => r.status === 'PENDING');

  // IN_PROGRESS 但 0 论点：说明上次 SSE 连接被中断，生成未真正开始
  // 从用户角度看等同于"未开始"，应显示"开始辩论"按钮而不是自动恢复
  const isInterruptedRound =
    isCurrentRoundInProgress &&
    roundArguments.length === 0 &&
    !userConfirmedResume;

  // 开始辩论（统一入口）：
  //   - 中断轮次（IN_PROGRESS + 0论点）→ 设置 userConfirmedResume，SSE 接管
  //   - 有 PENDING 轮次 → 直接开启 SSE（SSE 负责激活轮次）
  //   - 无可用轮次 → POST 创建新轮次，再开启 SSE
  const handleStartNewRound = async () => {
    if (isStartingRound || isSSEManuallyEnabled) return;
    setStartRoundError(null);
    setIsStartingRound(true);

    // ── 阶段1：检索本案相关法条（让用户看到进度）──
    setLawSearchMessage('正在为本案检索相关法条...');
    try {
      const recRes = await fetch(
        `/api/v1/debates/${debateId}/recommendations?limit=6`
      );
      if (recRes.ok) {
        const recData = (await recRes.json()) as {
          recommendations?: unknown[];
        };
        const count = recData.recommendations?.length ?? 0;
        if (count > 0) {
          setLawSearchMessage(`已检索到 ${count} 条相关法条，准备开始辩论...`);
          await new Promise<void>(resolve => setTimeout(resolve, 1200));
        }
      }
    } catch {
      // 法条检索失败不阻断辩论，静默继续
    }
    setLawSearchMessage(null);

    // ── 阶段2：启动轮次 ──
    // 情况A：IN_PROGRESS 中断轮次（0论点）→ 先 PATCH 清除软锁，再让 SSE 接管
    if (
      isCurrentRoundInProgress &&
      roundArguments.length === 0 &&
      currentRound?.id
    ) {
      try {
        // IN_PROGRESS → IN_PROGRESS：清除 startedAt 软锁 + 删除空论点
        // 状态机允许此自转换（用于中断轮次的锁重置）
        await fetch(`/api/v1/debates/${debateId}/rounds/${currentRound.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'IN_PROGRESS' }),
        });
      } catch {
        // 清锁失败不阻断，SSE 会在3分钟超时后自动可重试
      }
      setIsStartingRound(false);
      setUserConfirmedResume(true);
      return;
    }

    // 情况B：有 PENDING 轮次 → 直接开启 SSE
    if (pendingRound) {
      setIsStartingRound(false);
      setSelectedRoundId(pendingRound.id);
      setIsSSEManuallyEnabled(true);
      return;
    }

    // 情况C：无可用轮次 → 创建新轮次
    try {
      const res = await fetch(`/api/v1/debates/${debateId}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const roundData = (await res.json()) as {
        error?: string;
        data?: { id: string };
      };
      if (!res.ok) {
        throw new Error(roundData.error ?? '创建轮次失败');
      }
      if (roundData.data?.id) {
        setSelectedRoundId(roundData.data.id);
      }
      setIsSSEManuallyEnabled(true);
    } catch (err) {
      setStartRoundError(
        err instanceof Error ? err.message : '操作失败，请稍后重试'
      );
    } finally {
      setIsStartingRound(false);
    }
  };

  // 是否显示"开始辩论"按钮：
  //   - 轮次待开始（PENDING）
  //   - 或轮次被中断（IN_PROGRESS + 0论点，视为未真正开始）
  //   - 且当前无 SSE 运行、无重试、无创建中、非 FAILED
  const canStartNewRound =
    (selectedRound?.status === 'PENDING' || isInterruptedRound) &&
    !isRetrying &&
    !isStartingRound &&
    !isSSEManuallyEnabled;

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

      {/* 证据链分析提示 */}
      {chainAnalysisBadge && (
        <div className='flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'>
          <svg
            className='h-4 w-4 shrink-0'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
            />
          </svg>
          <span>{chainAnalysisBadge} — AI 将在生成论点时参考案件证据链</span>
        </div>
      )}

      {/* 法条检索进度提示（点击开始辩论后显示，替代按钮） */}
      {lawSearchMessage && (
        <div className='flex items-center justify-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-6 py-3 dark:border-blue-800 dark:bg-blue-900/20'>
          <div className='h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent' />
          <span className='text-sm text-blue-700 dark:text-blue-300'>
            {lawSearchMessage}
          </span>
        </div>
      )}

      {/* 开始辩论按钮（法条检索期间隐藏） */}
      {canStartNewRound && !lawSearchMessage && (
        <div className='flex flex-col items-center gap-2'>
          <button
            onClick={() => void handleStartNewRound()}
            disabled={isStartingRound}
            className='rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600'
          >
            {isStartingRound
              ? '正在启动...'
              : isInterruptedRound
                ? `开始第 ${currentRound?.roundNumber} 轮辩论`
                : pendingRound
                  ? `开始第 ${pendingRound.roundNumber} 轮辩论`
                  : rounds.length === 0
                    ? '开始第一轮辩论'
                    : `开始第 ${rounds.length + 1} 轮辩论`}
          </button>
          {startRoundError && (
            <p className='text-xs text-red-600 dark:text-red-400'>
              {startRoundError}
            </p>
          )}
        </div>
      )}

      {/* ── 适用法条：逐条流式出现，固定在辩论内容上方，可折叠 ── */}
      {displayedLawArticles.length > 0 && (
        <div className='rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20'>
          {/* 标题栏（点击折叠/展开） */}
          <button
            className='flex w-full items-center justify-between px-4 py-2.5 text-left'
            onClick={() => setLawArticlesCollapsed(v => !v)}
          >
            <div className='flex items-center gap-2'>
              <svg
                className='h-4 w-4 text-blue-600 dark:text-blue-400'
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
              <span className='text-xs font-semibold text-blue-700 dark:text-blue-400'>
                {roundArguments.length > 0
                  ? '本轮适用法条'
                  : '检索到的相关法条'}
                <span className='ml-1 font-normal text-blue-500'>
                  {visibleArticleCount < displayedLawArticles.length
                    ? `（正在加载 ${visibleArticleCount}/${displayedLawArticles.length}）`
                    : `（共 ${displayedLawArticles.length} 条）`}
                </span>
              </span>
            </div>
            <svg
              className={`h-4 w-4 text-blue-400 transition-transform ${lawArticlesCollapsed ? '' : 'rotate-180'}`}
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
          {/* 法条列表（折叠时隐藏） */}
          {!lawArticlesCollapsed && (
            <div className='flex flex-wrap gap-2 border-t border-blue-100 px-4 py-3 dark:border-blue-900/30'>
              {displayedLawArticles
                .slice(0, visibleArticleCount)
                .map((a, i) => (
                  <span
                    key={i}
                    className='inline-flex items-center rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-800 shadow-sm dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200'
                    style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                  >
                    《{a.lawName}》{a.articleNumber}
                  </span>
                ))}
              {visibleArticleCount < displayedLawArticles.length && (
                <span className='animate-pulse text-xs text-blue-400'>···</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 流式输出区（SSE 激活后立即展示，不依赖父组件轮询刷新）── */}
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

          {/* 流式指示器：只显示当前正在生成的一方 */}
          <div className='space-y-3'>
            {/* 原告已完成时展示结果，被告生成中时展示原告结果 + 被告指示器 */}
            {plaintiffStreamContent && (
              <StreamingOutput
                content={plaintiffStreamContent}
                isStreaming={currentStreamingSide === 'PLAINTIFF'}
                side='PLAINTIFF'
                accentColor='blue'
                stage={generationStage}
                progress={
                  currentStreamingSide === 'PLAINTIFF'
                    ? streamProgress || undefined
                    : 100
                }
              />
            )}
            {(currentStreamingSide === 'DEFENDANT' ||
              defendantStreamContent) && (
              <StreamingOutput
                content={defendantStreamContent}
                isStreaming={currentStreamingSide === 'DEFENDANT'}
                side='DEFENDANT'
                accentColor='red'
                stage={generationStage}
                progress={
                  currentStreamingSide === 'DEFENDANT'
                    ? streamProgress || undefined
                    : 100
                }
              />
            )}
            {/* 尚未收到任何 argument 事件时的初始等待状态 */}
            {!plaintiffStreamContent && !defendantStreamContent && (
              <StreamingOutput
                content=''
                isStreaming={true}
                side='PLAINTIFF'
                accentColor='blue'
                stage={generationStage}
                progress={streamProgress || undefined}
              />
            )}
          </div>
        </div>
      )}

      {/* 辩论主展示区（论点 + 法条，等待父组件轮询确认轮次后展示）*/}
      {selectedRoundId && currentRound && (
        <div className='space-y-4'>
          {/* ── 论点瀑布流（按时间排序，原被告交替展示）── */}
          <ArgumentWaterfall
            arguments={roundArguments}
            roundCompleted={roundCompleted}
            onRetryGeneration={handleRetryGeneration}
            isRetrying={isRetrying}
          />

          {/* ── 本轮结束后的下一步操作区 ── */}
          {roundCompleted && hasMoreRounds && !showStreamingArea && (
            <div className='rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900'>
              {!showNextRoundDialog ? (
                <div className='flex flex-col items-center gap-3 text-center'>
                  <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                    本轮辩论已结束。如需继续，请说明开启下一轮的理由（新证据、新主张等）。
                  </p>
                  <button
                    onClick={() => setShowNextRoundDialog(true)}
                    className='rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700'
                  >
                    开始下一轮辩论
                  </button>
                </div>
              ) : (
                <div className='space-y-3'>
                  <p className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                    请说明开启下一轮辩论的理由：
                  </p>
                  <textarea
                    value={pendingNextRoundContext}
                    onChange={e => setPendingNextRoundContext(e.target.value)}
                    placeholder='例如：补充了银行转账记录作为新证据，原告借款事实更加清晰；或：对被告利息计算方式提出异议...'
                    className='w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
                    rows={3}
                  />
                  <div className='flex justify-end gap-2'>
                    <button
                      onClick={() => {
                        setShowNextRoundDialog(false);
                        setPendingNextRoundContext('');
                      }}
                      className='rounded-lg border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    >
                      取消
                    </button>
                    <button
                      onClick={() => {
                        if (!pendingNextRoundContext.trim()) return;
                        setNextRoundContext(pendingNextRoundContext.trim());
                        setHasMoreRounds(false);
                        setShowNextRoundDialog(false);
                        setPendingNextRoundContext('');
                        void handleStartNewRound();
                      }}
                      disabled={!pendingNextRoundContext.trim()}
                      className='rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
                    >
                      确认，开始辩论
                    </button>
                  </div>
                </div>
              )}
            </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// 瀑布流论点展示组件
// ─────────────────────────────────────────────────────────────────────────────

interface ArgumentWaterfallProps {
  arguments: Argument[];
  roundCompleted?: boolean;
  onRetryGeneration?: () => void;
  isRetrying?: boolean;
}

function ArgumentWaterfall({
  arguments: args,
  roundCompleted,
  onRetryGeneration,
  isRetrying,
}: ArgumentWaterfallProps) {
  if (args.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white py-10 text-center dark:border-zinc-700 dark:bg-zinc-900'>
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
        <p className='text-sm text-zinc-500 dark:text-zinc-400'>暂无论点</p>
      </div>
    );
  }

  const sorted = [...args].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const plaintiffArgs = sorted.filter(a => a.side === 'PLAINTIFF');
  const defendantArgs = sorted.filter(a => a.side === 'DEFENDANT');

  const looksLikeFallback = (list: Argument[]) =>
    list.length > 0 && list.every(a => !a.reasoning);
  const showFallbackWarning =
    roundCompleted &&
    (looksLikeFallback(plaintiffArgs) || looksLikeFallback(defendantArgs));

  return (
    <div className='space-y-4'>
      {showFallbackWarning && onRetryGeneration && (
        <div className='flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/20'>
          <div className='flex-1 text-xs font-medium text-amber-800 dark:text-amber-300'>
            论点内容不完整，AI 未能生成完整推理
          </div>
          <button
            onClick={onRetryGeneration}
            disabled={isRetrying}
            className='shrink-0 rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50'
          >
            {isRetrying ? '重新生成中…' : '重新生成本轮'}
          </button>
        </div>
      )}

      <div className='space-y-5'>
        {/* 原告方：一个整块 */}
        {plaintiffArgs.length > 0 && (
          <div className='overflow-hidden rounded-xl border-2 border-blue-200 bg-white shadow-sm dark:border-blue-900/50 dark:bg-zinc-900'>
            <div className='flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2.5 dark:border-blue-900/30 dark:bg-blue-950/30'>
              <span className='h-3 w-3 rounded-full bg-blue-500' />
              <span className='text-sm font-semibold text-blue-700 dark:text-blue-400'>
                原告方主张
              </span>
              <span className='ml-auto text-xs text-blue-400'>
                {plaintiffArgs.length} 条论点
              </span>
            </div>
            <div className='divide-y divide-zinc-100 dark:divide-zinc-800'>
              {plaintiffArgs.map(arg => (
                <div key={arg.id} className='px-4 py-4'>
                  <ArgumentCard argument={arg} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 被告方：一个整块 */}
        {defendantArgs.length > 0 && (
          <div className='overflow-hidden rounded-xl border-2 border-red-200 bg-white shadow-sm dark:border-red-900/50 dark:bg-zinc-900'>
            <div className='flex items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5 dark:border-red-900/30 dark:bg-red-950/30'>
              <span className='h-3 w-3 rounded-full bg-red-500' />
              <span className='text-sm font-semibold text-red-700 dark:text-red-400'>
                被告方回应
              </span>
              <span className='ml-auto text-xs text-red-400'>
                {defendantArgs.length} 条论点
              </span>
            </div>
            <div className='divide-y divide-zinc-100 dark:divide-zinc-800'>
              {defendantArgs.map(arg => (
                <div key={arg.id} className='px-4 py-4'>
                  <ArgumentCard argument={arg} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
