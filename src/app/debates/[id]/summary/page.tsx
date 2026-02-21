'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface RoundStat {
  roundNumber: number;
  roundId: string;
  startedAt: string | null;
  completedAt: string | null;
  plaintiff: {
    argumentCount: number;
    avgOverallScore: number | null;
    avgConfidence: number | null;
    topArgument: string | null;
  };
  defendant: {
    argumentCount: number;
    avgOverallScore: number | null;
    avgConfidence: number | null;
    topArgument: string | null;
  };
  citedLaws: string[];
  roundWinner: 'plaintiff' | 'defendant' | 'tie' | null;
}

interface SummaryData {
  debateId: string;
  debateTitle: string;
  caseTitle: string | null;
  caseType: string | null;
  status: string;
  roundCount: number;
  roundStats: RoundStat[];
  totals: {
    plaintiffArguments: number;
    defendantArguments: number;
    plaintiffRoundWins: number;
    defendantRoundWins: number;
    overallWinner: 'plaintiff' | 'defendant' | 'tie';
    citedLawCount: number;
  };
  generatedAt: string;
}

interface AISummary {
  verdict?: string;
  plaintiffStrengths?: string[];
  defendantStrengths?: string[];
  keyLegalIssues?: string[];
  weaknesses?: { plaintiff?: string; defendant?: string };
  recommendation?: string;
  generatedAt?: string;
  raw?: boolean;
}

/**
 * 将分数格式化为百分比（处理 null）
 */
function fmtScore(v: number | null): string {
  if (v === null) return '—';
  return `${(v * 100).toFixed(0)}%`;
}

/**
 * 置信度颜色
 */
function confColor(v: number | null): string {
  if (v === null) return 'text-zinc-400';
  if (v >= 0.85) return 'text-green-600 dark:text-green-400';
  if (v >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * 辩论摘要页
 * URL: /debates/[id]/summary
 */
export default function DebateSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const debateId = params.id as string;

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI 总结状态
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // 并行加载：统计摘要 + 已有 AI 总结
        const [statsRes, aiRes] = await Promise.all([
          fetch(`/api/v1/debates/${debateId}/summary`),
          fetch(`/api/v1/debates/${debateId}/ai-summary`),
        ]);
        const statsJson = await statsRes.json();
        if (statsJson.success) {
          setSummary(statsJson.data);
        } else {
          setError(statsJson.error || '加载摘要失败');
        }
        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          if (aiJson.success && aiJson.data) {
            setAiSummary(aiJson.data as AISummary);
          }
        }
      } catch {
        setError('网络错误，请重试');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [debateId]);

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/v1/debates/${debateId}/summary`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setAiSummary(json.data as AISummary);
      } else {
        setAiError(json.error || 'AI 总结生成失败');
      }
    } catch {
      setAiError('网络错误，请重试');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black'>
        <div className='h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent' />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black'>
        <div className='rounded-lg border border-red-200 bg-white p-8 text-center dark:border-red-800 dark:bg-zinc-950'>
          <p className='text-sm text-red-600'>{error || '未知错误'}</p>
          <button
            onClick={() => router.back()}
            className='mt-4 rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600'
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const { totals, roundStats } = summary;

  const winnerLabel = {
    plaintiff: '原告方优势',
    defendant: '被告方优势',
    tie: '势均力敌',
  }[totals.overallWinner];

  const winnerColor = {
    plaintiff: 'text-blue-600 dark:text-blue-400',
    defendant: 'text-red-600 dark:text-red-400',
    tie: 'text-zinc-600 dark:text-zinc-400',
  }[totals.overallWinner];

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black print:bg-white'>
      {/* 页面头部（打印时隐藏操作按钮） */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 print:border-none dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-4xl items-center justify-between'>
          <div>
            <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
              辩论摘要报告
            </h1>
            <p className='mt-0.5 text-sm text-zinc-500 dark:text-zinc-400'>
              {summary.caseTitle || summary.debateTitle}
            </p>
          </div>
          <div className='flex gap-2 print:hidden'>
            <button
              onClick={() => router.push(`/debates/${debateId}`)}
              className='rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
            >
              返回辩论
            </button>
            <a
              href={`/api/v1/debates/${debateId}/export?format=markdown`}
              download
              className='inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
            >
              导出 MD
            </a>
            <button
              onClick={handlePrint}
              className='rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600'
            >
              打印 / PDF
            </button>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-4xl space-y-6 px-6 py-6 print:px-0 print:py-4'>
        {/* AI 总结分析卡 */}
        <div className='rounded-xl border border-violet-200 bg-white shadow-sm dark:border-violet-700 dark:bg-zinc-900'>
          <div className='flex items-center justify-between border-b border-violet-100 px-5 py-3 dark:border-violet-800'>
            <div className='flex items-center gap-2'>
              <svg
                className='h-4 w-4 text-violet-500'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                />
              </svg>
              <h2 className='text-sm font-semibold text-violet-800 dark:text-violet-300'>
                AI 专家分析
              </h2>
              {aiSummary?.generatedAt && (
                <span className='text-xs text-violet-400'>
                  {new Date(aiSummary.generatedAt).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  生成
                </span>
              )}
            </div>
            <button
              onClick={() => void handleGenerateAI()}
              disabled={isGeneratingAI}
              className='rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-700 dark:hover:bg-violet-600'
            >
              {isGeneratingAI ? (
                <span className='flex items-center gap-1.5'>
                  <svg
                    className='h-3 w-3 animate-spin'
                    viewBox='0 0 24 24'
                    fill='none'
                  >
                    <circle
                      className='opacity-25'
                      cx='12'
                      cy='12'
                      r='10'
                      stroke='currentColor'
                      strokeWidth='4'
                    />
                    <path
                      className='opacity-75'
                      fill='currentColor'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z'
                    />
                  </svg>
                  生成中…
                </span>
              ) : aiSummary ? (
                '重新生成'
              ) : (
                '生成 AI 分析'
              )}
            </button>
          </div>

          {aiError && (
            <div className='mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'>
              {aiError}
            </div>
          )}

          {aiSummary && !isGeneratingAI ? (
            <div className='space-y-4 p-5'>
              {/* 综合评估 */}
              {aiSummary.verdict && (
                <div className='rounded-lg bg-violet-50 p-4 dark:bg-violet-900/20'>
                  <div className='mb-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300'>
                    综合评估
                  </div>
                  <p className='text-sm leading-relaxed text-violet-900 dark:text-violet-100'>
                    {aiSummary.verdict}
                  </p>
                </div>
              )}

              <div className='grid gap-4 sm:grid-cols-2'>
                {/* 原告优势 */}
                {aiSummary.plaintiffStrengths &&
                  aiSummary.plaintiffStrengths.length > 0 && (
                    <div className='rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20'>
                      <div className='mb-2 text-xs font-semibold text-blue-700 dark:text-blue-300'>
                        原告方优势
                      </div>
                      <ul className='space-y-1'>
                        {aiSummary.plaintiffStrengths.map((s, i) => (
                          <li
                            key={i}
                            className='flex items-start gap-1.5 text-xs text-blue-800 dark:text-blue-200'
                          >
                            <span className='mt-0.5 shrink-0 text-blue-400'>
                              •
                            </span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {/* 被告优势 */}
                {aiSummary.defendantStrengths &&
                  aiSummary.defendantStrengths.length > 0 && (
                    <div className='rounded-lg bg-red-50 p-3 dark:bg-red-900/20'>
                      <div className='mb-2 text-xs font-semibold text-red-700 dark:text-red-300'>
                        被告方优势
                      </div>
                      <ul className='space-y-1'>
                        {aiSummary.defendantStrengths.map((s, i) => (
                          <li
                            key={i}
                            className='flex items-start gap-1.5 text-xs text-red-800 dark:text-red-200'
                          >
                            <span className='mt-0.5 shrink-0 text-red-400'>
                              •
                            </span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {/* 核心法律争议 */}
              {aiSummary.keyLegalIssues &&
                aiSummary.keyLegalIssues.length > 0 && (
                  <div>
                    <div className='mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400'>
                      核心法律争议
                    </div>
                    <div className='flex flex-wrap gap-2'>
                      {aiSummary.keyLegalIssues.map((issue, i) => (
                        <span
                          key={i}
                          className='rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* 不足与建议 */}
              {(aiSummary.weaknesses || aiSummary.recommendation) && (
                <div className='rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800'>
                  {aiSummary.weaknesses && (
                    <div className='mb-3 grid gap-3 sm:grid-cols-2'>
                      {aiSummary.weaknesses.plaintiff && (
                        <div>
                          <div className='mb-1 text-xs font-medium text-zinc-500'>
                            原告方不足
                          </div>
                          <p className='text-xs text-zinc-700 dark:text-zinc-300'>
                            {aiSummary.weaknesses.plaintiff}
                          </p>
                        </div>
                      )}
                      {aiSummary.weaknesses.defendant && (
                        <div>
                          <div className='mb-1 text-xs font-medium text-zinc-500'>
                            被告方不足
                          </div>
                          <p className='text-xs text-zinc-700 dark:text-zinc-300'>
                            {aiSummary.weaknesses.defendant}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {aiSummary.recommendation && (
                    <div>
                      <div className='mb-1 text-xs font-medium text-zinc-500'>
                        改进建议
                      </div>
                      <p className='text-xs text-zinc-700 dark:text-zinc-300'>
                        {aiSummary.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            !isGeneratingAI && (
              <div className='flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-zinc-400'>
                <svg
                  className='h-8 w-8 text-violet-200 dark:text-violet-800'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={1.5}
                    d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                  />
                </svg>
                <p>点击上方按钮生成 AI 专家分析报告</p>
              </div>
            )
          )}
        </div>

        {/* 总体结论卡 */}
        <div className='rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900'>
          <h2 className='mb-4 text-base font-semibold text-zinc-800 dark:text-zinc-200'>
            总体结论
          </h2>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
            <div className='text-center'>
              <div className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>
                {summary.roundCount}
              </div>
              <div className='mt-0.5 text-xs text-zinc-500'>已完成轮次</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                {totals.plaintiffArguments}
              </div>
              <div className='mt-0.5 text-xs text-zinc-500'>原告方论点</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                {totals.defendantArguments}
              </div>
              <div className='mt-0.5 text-xs text-zinc-500'>被告方论点</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-amber-600 dark:text-amber-400'>
                {totals.citedLawCount}
              </div>
              <div className='mt-0.5 text-xs text-zinc-500'>引用法条数</div>
            </div>
          </div>

          {/* 综合判断 */}
          <div className='mt-5 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800'>
            <div className='flex items-center justify-between'>
              <div>
                <div className='text-xs text-zinc-500'>综合判断</div>
                <div className={`mt-0.5 text-lg font-semibold ${winnerColor}`}>
                  {winnerLabel}
                </div>
              </div>
              <div className='flex items-center gap-3 text-sm'>
                <span className='text-zinc-500'>原告胜轮</span>
                <span className='text-xl font-bold text-blue-600'>
                  {totals.plaintiffRoundWins}
                </span>
                <span className='text-zinc-400'>vs</span>
                <span className='text-xl font-bold text-red-600'>
                  {totals.defendantRoundWins}
                </span>
                <span className='text-zinc-500'>被告胜轮</span>
              </div>
            </div>

            {/* 胜率条 */}
            <div className='mt-3 h-3 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700'>
              <div className='flex h-full'>
                <div
                  className='bg-blue-500 transition-all'
                  style={{
                    width: `${
                      summary.roundCount > 0
                        ? (totals.plaintiffRoundWins / summary.roundCount) * 100
                        : 50
                    }%`,
                  }}
                />
                <div
                  className='bg-red-500 transition-all'
                  style={{
                    width: `${
                      summary.roundCount > 0
                        ? (totals.defendantRoundWins / summary.roundCount) * 100
                        : 50
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className='mt-1 flex justify-between text-[10px] text-zinc-400'>
              <span>原告方</span>
              <span>被告方</span>
            </div>
          </div>
        </div>

        {/* 逐轮详情 */}
        <div className='space-y-4'>
          <h2 className='text-base font-semibold text-zinc-800 dark:text-zinc-200'>
            逐轮详情
          </h2>
          {roundStats.map(round => (
            <div
              key={round.roundId}
              className='rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900'
            >
              {/* 轮次标题行 */}
              <div className='mb-4 flex items-center justify-between'>
                <h3 className='font-semibold text-zinc-800 dark:text-zinc-200'>
                  第{round.roundNumber}轮
                </h3>
                <div className='flex items-center gap-2'>
                  {round.roundWinner && (
                    <span
                      className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                        round.roundWinner === 'plaintiff'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : round.roundWinner === 'defendant'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {round.roundWinner === 'plaintiff'
                        ? '原告占优'
                        : round.roundWinner === 'defendant'
                          ? '被告占优'
                          : '平局'}
                    </span>
                  )}
                  {round.completedAt && (
                    <span className='text-xs text-zinc-400'>
                      {new Date(round.completedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* 正反方数据对比 */}
              <div className='grid gap-4 sm:grid-cols-2'>
                {/* 原告方 */}
                <div className='rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20'>
                  <div className='mb-2 flex items-center justify-between'>
                    <span className='text-xs font-semibold text-blue-700 dark:text-blue-300'>
                      原告方
                    </span>
                    <span className='text-xs text-blue-600 dark:text-blue-400'>
                      {round.plaintiff.argumentCount} 个论点
                    </span>
                  </div>
                  <div className='flex gap-3 text-xs'>
                    <span className='text-zinc-500'>
                      综合分{' '}
                      <span
                        className={confColor(round.plaintiff.avgConfidence)}
                      >
                        {fmtScore(round.plaintiff.avgConfidence)}
                      </span>
                    </span>
                  </div>
                  {round.plaintiff.topArgument && (
                    <p className='mt-2 text-xs leading-relaxed text-blue-700 dark:text-blue-300'>
                      {round.plaintiff.topArgument}
                    </p>
                  )}
                </div>

                {/* 被告方 */}
                <div className='rounded-lg bg-red-50 p-3 dark:bg-red-900/20'>
                  <div className='mb-2 flex items-center justify-between'>
                    <span className='text-xs font-semibold text-red-700 dark:text-red-300'>
                      被告方
                    </span>
                    <span className='text-xs text-red-600 dark:text-red-400'>
                      {round.defendant.argumentCount} 个论点
                    </span>
                  </div>
                  <div className='flex gap-3 text-xs'>
                    <span className='text-zinc-500'>
                      综合分{' '}
                      <span
                        className={confColor(round.defendant.avgConfidence)}
                      >
                        {fmtScore(round.defendant.avgConfidence)}
                      </span>
                    </span>
                  </div>
                  {round.defendant.topArgument && (
                    <p className='mt-2 text-xs leading-relaxed text-red-700 dark:text-red-300'>
                      {round.defendant.topArgument}
                    </p>
                  )}
                </div>
              </div>

              {/* 本轮引用法条 */}
              {round.citedLaws.length > 0 && (
                <div className='mt-3 flex flex-wrap gap-1.5'>
                  {round.citedLaws.map((law, i) => (
                    <span
                      key={i}
                      className='rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    >
                      {law}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 页脚（报告生成时间） */}
        <div className='border-t border-zinc-200 pt-3 text-center text-xs text-zinc-400 dark:border-zinc-700'>
          报告生成时间：
          {new Date(summary.generatedAt).toLocaleString('zh-CN')}
        </div>
      </main>
    </div>
  );
}
