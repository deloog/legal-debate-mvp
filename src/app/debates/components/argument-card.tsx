'use client';

import { useState, useRef, useCallback, type ReactElement } from 'react';
import { Argument, ArgumentType } from '@prisma/client';
import { AIThinkingInline } from '@/components/ai/AIThinkingIndicator';

type ArgumentPriority = 'primary' | 'secondary' | null;

const PRIORITY_CONFIG = {
  primary: {
    label: '主攻',
    className:
      'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
  },
  secondary: {
    label: '备用',
    className:
      'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600',
  },
} as const;

/**
 * 法律依据项接口
 */
interface LegalBasisItem {
  lawName: string;
  articleNumber: string;
  relevance: number;
  explanation: string;
}

/**
 * 检查是否为有效的法律依据数组
 */
function isLegalBasisArray(value: unknown): value is LegalBasisItem[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    item =>
      typeof item === 'object' &&
      item !== null &&
      'lawName' in item &&
      'articleNumber' in item
  );
}

export interface ArgumentCardProps {
  argument: Argument & { priority?: string | null };
  isStreaming?: boolean;
}

/**
 * 论点类型标签颜色映射
 */
const typeColors: Record<ArgumentType, string> = {
  MAIN_POINT: 'bg-blue-100 text-blue-800 border-blue-300',
  SUPPORTING: 'bg-green-100 text-green-800 border-green-300',
  REBUTTAL: 'bg-red-100 text-red-800 border-red-300',
  EVIDENCE: 'bg-purple-100 text-purple-800 border-purple-300',
  LEGAL_BASIS: 'bg-amber-100 text-amber-800 border-amber-300',
  CONCLUSION: 'bg-gray-100 text-gray-800 border-gray-300',
};

/**
 * 论点类型标签中文映射
 */
const typeLabels: Record<ArgumentType, string> = {
  MAIN_POINT: '主要论点',
  SUPPORTING: '支持论据',
  REBUTTAL: '反驳论点',
  EVIDENCE: '证据引用',
  LEGAL_BASIS: '法律依据',
  CONCLUSION: '结论',
};

/**
 * 截断文本到指定长度
 */
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}

/**
 * 论点卡片组件
 *
 * 布局：
 * - 常驻区：类型标签、时间、论点内容（完整）、法条名称标签列
 * - 展开区：推理逻辑、法条详情（相关度+解释）、评分信息
 */
export function ArgumentCard({
  argument,
  isStreaming = false,
}: ArgumentCardProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  // 优先级标记（存储在数据库）
  const [priority, setPriority] = useState<ArgumentPriority>(
    (argument.priority as ArgumentPriority) ?? null
  );
  const [isSavingPriority, setIsSavingPriority] = useState(false);

  const cyclePriority = useCallback(async () => {
    if (isSavingPriority) return;
    const next: ArgumentPriority =
      priority === null
        ? 'primary'
        : priority === 'primary'
          ? 'secondary'
          : null;
    setPriority(next); // 乐观更新
    setIsSavingPriority(true);
    try {
      await fetch(`/api/v1/arguments/${argument.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: next }),
      });
    } catch {
      setPriority(priority); // 回滚
    } finally {
      setIsSavingPriority(false);
    }
  }, [priority, argument.id, isSavingPriority]);

  // 内联编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(argument.content);
  const [editReasoning, setEditReasoning] = useState(argument.reasoning ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // 显示的当前内容（保存后更新，不刷新页面）
  const [displayContent, setDisplayContent] = useState(argument.content);
  const [displayReasoning, setDisplayReasoning] = useState(
    argument.reasoning ?? ''
  );
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const handleEditStart = () => {
    setEditContent(displayContent);
    setEditReasoning(displayReasoning);
    setEditError(null);
    setIsEditing(true);
    setTimeout(() => contentRef.current?.focus(), 0);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editContent.trim()) {
      setEditError('论点内容不能为空');
      return;
    }
    setIsSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/v1/arguments/${argument.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent.trim(),
          reasoning: editReasoning.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? '保存失败');
      }
      setDisplayContent(editContent.trim());
      setDisplayReasoning(editReasoning.trim());
      setIsEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const legalBasisList = isLegalBasisArray(argument.legalBasis)
    ? argument.legalBasis
    : [];

  const hasDetails =
    !!displayReasoning ||
    legalBasisList.length > 0 ||
    !!(argument.logicScore || argument.legalScore || argument.overallScore);

  return (
    <div className='group rounded-lg border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900'>
      {/* 头部：论点类型 + 优先级徽章 + 操作按钮 */}
      <div className='flex items-center justify-between px-4 pt-4 pb-2'>
        <div className='flex items-center gap-1.5'>
          <span
            className={`rounded border px-2 py-0.5 text-xs font-medium ${typeColors[argument.type]}`}
          >
            {typeLabels[argument.type]}
          </span>
          {priority && (
            <span
              className={`rounded border px-2 py-0.5 text-xs font-medium ${PRIORITY_CONFIG[priority].className}`}
            >
              {PRIORITY_CONFIG[priority].label}
            </span>
          )}
          {argument.overallScore != null && !isStreaming && (
            <span
              title={`综合评分：逻辑 ${argument.logicScore != null ? (argument.logicScore * 100).toFixed(0) : '-'}分 · 法律 ${argument.legalScore != null ? (argument.legalScore * 100).toFixed(0) : '-'}分`}
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                argument.overallScore >= 0.8
                  ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300'
                  : argument.overallScore >= 0.6
                    ? 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                    : 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400'
              }`}
            >
              {(argument.overallScore * 100).toFixed(0)}分
            </span>
          )}
        </div>
        <div className='flex items-center gap-1'>
          {!isStreaming && !isEditing && (
            <>
              {/* 优先级标记按钮（P3） */}
              <button
                onClick={() => void cyclePriority()}
                title={
                  priority
                    ? `当前：${PRIORITY_CONFIG[priority].label}，点击切换`
                    : '标记论点优先级'
                }
                className={`hidden rounded p-1 transition-colors group-hover:flex ${
                  priority
                    ? 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                <svg
                  className='h-3.5 w-3.5'
                  fill={priority ? 'currentColor' : 'none'}
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z'
                  />
                </svg>
              </button>
              {/* 编辑按钮（P1.1） */}
              <button
                onClick={handleEditStart}
                title='编辑此论点'
                className='hidden rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 group-hover:flex dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
              >
                <svg
                  className='h-3.5 w-3.5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                  />
                </svg>
              </button>
            </>
          )}
          <span className='text-xs text-zinc-500 dark:text-zinc-400'>
            {new Date(argument.createdAt).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* 论点内容（普通/编辑模式） */}
      <div className='px-4 pb-2'>
        {isStreaming ? (
          <AIThinkingInline message='正在生成论点' />
        ) : isEditing ? (
          <div className='space-y-3'>
            <div>
              <label className='mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400'>
                论点主张
              </label>
              <textarea
                ref={contentRef}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={4}
                className='w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
              />
            </div>
            <div>
              <label className='mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400'>
                推理过程（可选）
              </label>
              <textarea
                value={editReasoning}
                onChange={e => setEditReasoning(e.target.value)}
                rows={3}
                placeholder='描述从事实到结论的法律推理过程…'
                className='w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
              />
            </div>
            {editError && (
              <p className='text-xs text-red-600 dark:text-red-400'>
                {editError}
              </p>
            )}
            <div className='flex gap-2'>
              <button
                onClick={() => void handleEditSave()}
                disabled={isSaving}
                className='rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-600'
              >
                {isSaving ? '保存中…' : '保存'}
              </button>
              <button
                onClick={handleEditCancel}
                disabled={isSaving}
                className='rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <p className='text-sm leading-relaxed text-zinc-800 dark:text-zinc-200'>
            {displayContent}
          </p>
        )}
      </div>

      {/* 法条名称标签（常驻，点击展开查看详情） */}
      <div className='flex flex-wrap gap-1.5 px-4 pb-3'>
        {legalBasisList.length > 0
          ? legalBasisList.map((basis, index) => (
              <span
                key={index}
                title={`相关度 ${(basis.relevance * 100).toFixed(0)}%：${basis.explanation}`}
                className='inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
              >
                <svg
                  className='h-3 w-3'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
                  />
                </svg>
                《{truncate(basis.lawName, 12)}》{basis.articleNumber}
              </span>
            ))
          : !isStreaming && (
              <span
                title='此论点未引用任何法律条款，法律支撑不足'
                className='inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
              >
                <svg
                  className='h-3 w-3'
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
                缺少法律依据
              </span>
            )}
      </div>

      {/* AI信息（置信度） */}
      {argument.aiProvider && argument.confidence && (
        <div className='flex items-center gap-3 border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400'>
          <span className='font-medium'>{argument.aiProvider}</span>
          <span
            className={
              argument.confidence >= 0.8
                ? 'text-green-600 dark:text-green-400'
                : argument.confidence >= 0.5
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
            }
          >
            置信度 {(argument.confidence * 100).toFixed(0)}%
          </span>
          {argument.generationTime && <span>{argument.generationTime}ms</span>}
        </div>
      )}

      {/* 展开/收起详情按钮（仅当有详情内容时显示） */}
      {hasDetails && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className='flex w-full items-center justify-between border-t border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
        >
          <span>{isExpanded ? '收起详情' : '展开推理与法条详情'}</span>
          <svg
            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              d='M19 9l-7 7-7-7'
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
            />
          </svg>
        </button>
      )}

      {/* 展开详情区 */}
      {isExpanded && (
        <div className='space-y-3 px-4 pb-4 pt-2'>
          {/* 推理逻辑 */}
          {displayReasoning && (
            <div className='rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20'>
              <div className='mb-1.5 flex items-center gap-1.5'>
                <svg
                  className='h-3.5 w-3.5 text-blue-600 dark:text-blue-400'
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
                <span className='text-xs font-semibold text-blue-800 dark:text-blue-300'>
                  推理逻辑
                </span>
              </div>
              <p className='text-xs leading-relaxed text-blue-700 dark:text-blue-300'>
                {displayReasoning}
              </p>
            </div>
          )}

          {/* 法律依据详情 */}
          {legalBasisList.length > 0 && (
            <div className='rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20'>
              <div className='mb-2 flex items-center gap-1.5'>
                <svg
                  className='h-3.5 w-3.5 text-amber-600 dark:text-amber-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
                  />
                </svg>
                <span className='text-xs font-semibold text-amber-800 dark:text-amber-300'>
                  法律依据详情
                </span>
              </div>
              <div className='space-y-2'>
                {legalBasisList.map((basis, index) => (
                  <div
                    key={index}
                    className='rounded border border-amber-200 bg-white p-2 dark:border-amber-700 dark:bg-amber-900/30'
                  >
                    <div className='mb-1 flex items-center justify-between'>
                      <span className='text-xs font-medium text-amber-900 dark:text-amber-200'>
                        《{basis.lawName}》{basis.articleNumber}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          basis.relevance >= 0.8
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : basis.relevance >= 0.5
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        相关度 {(basis.relevance * 100).toFixed(0)}%
                      </span>
                    </div>
                    {basis.explanation && (
                      <p className='text-xs leading-relaxed text-amber-700 dark:text-amber-300'>
                        {basis.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 评分信息 */}
          {(argument.logicScore ||
            argument.legalScore ||
            argument.overallScore) && (
            <div className='rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800'>
              <p className='mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400'>
                论点评分
              </p>
              <div className='grid grid-cols-3 gap-2 text-center'>
                {argument.logicScore && (
                  <div>
                    <div className='text-xs text-zinc-500'>逻辑清晰度</div>
                    <div
                      className={`text-sm font-medium ${
                        argument.logicScore >= 0.8
                          ? 'text-green-600'
                          : argument.logicScore >= 0.5
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }`}
                    >
                      {(argument.logicScore * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
                {argument.legalScore && (
                  <div>
                    <div className='text-xs text-zinc-500'>法律准确性</div>
                    <div
                      className={`text-sm font-medium ${
                        argument.legalScore >= 0.8
                          ? 'text-green-600'
                          : argument.legalScore >= 0.5
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }`}
                    >
                      {(argument.legalScore * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
                {argument.overallScore && (
                  <div>
                    <div className='text-xs text-zinc-500'>综合评分</div>
                    <div
                      className={`text-sm font-medium ${
                        argument.overallScore >= 0.8
                          ? 'text-green-600'
                          : argument.overallScore >= 0.5
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }`}
                    >
                      {(argument.overallScore * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
