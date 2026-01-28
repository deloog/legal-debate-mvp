'use client';

import { useState, type ReactElement } from 'react';
import { Argument, ArgumentType } from '@prisma/client';
import type { JsonValue } from '@prisma/client/runtime/library';
import { AIThinkingInline } from '@/components/ai/AIThinkingIndicator';

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
  argument: Argument;
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
 * 论点卡片组件
 * 功能：展示单个论点的内容、类型和AI信息
 */
export function ArgumentCard({
  argument,
  isStreaming = false,
}: ArgumentCardProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className='group rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900'>
      {/* 头部：论点类型和时间 */}
      <div className='mb-3 flex items-center justify-between'>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${typeColors[argument.type]}`}
        >
          {typeLabels[argument.type]}
        </span>
        <span className='text-xs text-zinc-500 dark:text-zinc-400'>
          {new Date(argument.createdAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* 论点内容 */}
      <div className='mb-3'>
        {isStreaming ? (
          <AIThinkingInline message='正在生成论点' />
        ) : (
          <p className='text-sm leading-relaxed text-zinc-800 dark:text-zinc-200'>
            {argument.content}
          </p>
        )}
      </div>

      {/* AI信息 */}
      {argument.aiProvider && (
        <div className='mb-3 rounded bg-zinc-50 px-3 py-2 dark:bg-zinc-800'>
          <div className='flex items-center gap-4 text-xs'>
            <span className='flex items-center gap-1'>
              <span className='text-zinc-500 dark:text-zinc-400'>AI:</span>
              <span className='font-medium text-zinc-700 dark:text-zinc-300'>
                {argument.aiProvider}
              </span>
            </span>
            {argument.generationTime && (
              <span className='text-zinc-500 dark:text-zinc-400'>
                {argument.generationTime}ms
              </span>
            )}
            {argument.confidence && (
              <span className='flex items-center gap-1'>
                <span className='text-zinc-500 dark:text-zinc-400'>
                  置信度:
                </span>
                <span
                  className={`font-medium ${
                    argument.confidence >= 0.8
                      ? 'text-green-600'
                      : argument.confidence >= 0.5
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                >
                  {(argument.confidence * 100).toFixed(0)}%
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* 展开按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex w-full items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
      >
        <span>详细信息</span>
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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

      {/* 展开内容 */}
      {isExpanded && (
        <div className='mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700'>
          <div className='space-y-2 text-xs text-zinc-600 dark:text-zinc-400'>
            <div className='flex'>
              <span className='w-20 font-medium'>论点ID:</span>
              <span className='font-mono'>{argument.id}</span>
            </div>
            <div className='flex'>
              <span className='w-20 font-medium'>论点方:</span>
              <span>
                {argument.side === 'PLAINTIFF'
                  ? '原告'
                  : argument.side === 'DEFENDANT'
                    ? '被告'
                    : '中立'}
              </span>
            </div>
            {argument.updatedAt && (
              <div className='flex'>
                <span className='w-20 font-medium'>更新时间:</span>
                <span>
                  {new Date(argument.updatedAt).toLocaleString('zh-CN')}
                </span>
              </div>
            )}
          </div>

          {/* 推理逻辑 */}
          {argument.reasoning && (
            <div className='mt-3 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20'>
              <div className='flex items-center gap-2 mb-2'>
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
                    d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                  />
                </svg>
                <span className='text-xs font-medium text-blue-800 dark:text-blue-300'>
                  推理逻辑
                </span>
              </div>
              <p className='text-xs text-blue-700 dark:text-blue-300'>
                {argument.reasoning}
              </p>
            </div>
          )}

          {/* 法律依据 */}
          {argument.legalBasis &&
            isLegalBasisArray(argument.legalBasis) &&
            argument.legalBasis.length > 0 && (
              <div className='mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20'>
                <div className='flex items-center gap-2 mb-2'>
                  <svg
                    className='h-4 w-4 text-amber-600 dark:text-amber-400'
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
                  <span className='text-xs font-medium text-amber-800 dark:text-amber-300'>
                    法律依据来源
                  </span>
                </div>
                <div className='space-y-2'>
                  {argument.legalBasis.map((basis, index) => (
                    <div
                      key={index}
                      className='rounded border border-amber-200 bg-white p-2 dark:border-amber-700 dark:bg-amber-900/30'
                    >
                      <div className='flex items-center justify-between mb-1'>
                        <span className='text-xs font-medium text-amber-900 dark:text-amber-200'>
                          《{basis.lawName}》第{basis.articleNumber}条
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            basis.relevance >= 0.8
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : basis.relevance >= 0.5
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          相关度: {(basis.relevance * 100).toFixed(0)}%
                        </span>
                      </div>
                      {basis.explanation && (
                        <p className='text-xs text-amber-700 dark:text-amber-300 line-clamp-2'>
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
            <div className='mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800'>
              <div className='flex items-center gap-2 mb-2'>
                <svg
                  className='h-4 w-4 text-zinc-600 dark:text-zinc-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
                  />
                </svg>
                <span className='text-xs font-medium text-zinc-700 dark:text-zinc-300'>
                  论点评分
                </span>
              </div>
              <div className='grid grid-cols-3 gap-2'>
                {argument.logicScore && (
                  <div className='text-center'>
                    <div className='text-xs text-zinc-500 dark:text-zinc-400'>
                      逻辑清晰度
                    </div>
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
                  <div className='text-center'>
                    <div className='text-xs text-zinc-500 dark:text-zinc-400'>
                      法律准确性
                    </div>
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
                  <div className='text-center'>
                    <div className='text-xs text-zinc-500 dark:text-zinc-400'>
                      综合评分
                    </div>
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
