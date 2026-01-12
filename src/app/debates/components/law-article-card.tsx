'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LawyerFeedback {
  action: 'CONFIRMED' | 'REMOVED' | 'MANUALLY_ADDED';
  removedReason?: 'NOT_RELEVANT' | 'REPEALED' | 'OTHER';
  otherReason?: string;
  timestamp: string;
}

interface LawArticleCardProps {
  article: {
    id: string;
    lawName: string;
    articleNumber: string;
    content: string;
    applicabilityScore?: number | null;
    applicabilityReason?: string | null;
    status?: string;
    metadata?: {
      lawyerFeedback?: LawyerFeedback;
    };
  };
  onConfirm?: (articleId: string) => void;
  onRemove?: (articleId: string) => void;
  onViewDetails?: (articleId: string) => void;
}

/**
 * 法条卡片组件
 * 功能：展示法条信息、适用性评分和律师干预操作
 */
export function LawArticleCard({
  article,
  onConfirm,
  onRemove,
  onViewDetails,
}: LawArticleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const feedback = article.metadata?.lawyerFeedback;
  const isConfirmed = feedback?.action === 'CONFIRMED';
  const isRemoved = feedback?.action === 'REMOVED';
  const isActionable = !feedback;

  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return 'text-zinc-500';
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusBadge = () => {
    if (isConfirmed) {
      return (
        <div className='inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300'>
          <CheckCircle2 className='h-3 w-3' />
          已确认
        </div>
      );
    }

    if (isRemoved) {
      const reasonText = {
        NOT_RELEVANT: '不相关',
        REPEALED: '已废止',
        OTHER: '其他',
      }[feedback?.removedReason || 'OTHER'];

      return (
        <div className='inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300'>
          <XCircle className='h-3 w-3' />
          已移除：{reasonText}
        </div>
      );
    }

    return null;
  };

  return (
    <div className='overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900'>
      {/* 标题栏 */}
      <div className='border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              <h3 className='font-semibold text-zinc-900 dark:text-zinc-50'>
                {article.lawName}
              </h3>
              <span className='rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300'>
                {article.articleNumber}
              </span>
              {article.status === 'REPEALED' && (
                <span className='inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300'>
                  <AlertCircle className='h-3 w-3' />
                  已废止
                </span>
              )}
            </div>
            {getStatusBadge()}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className='rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300'
          >
            {isExpanded ? (
              <ChevronUp className='h-5 w-5' />
            ) : (
              <ChevronDown className='h-5 w-5' />
            )}
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className='p-4'>
        {article.applicabilityScore !== null &&
          article.applicabilityScore !== undefined && (
            <div className='mb-3 flex items-center gap-2'>
              <span className='text-sm text-zinc-600 dark:text-zinc-400'>
                适用性评分：
              </span>
              <span
                className={`text-lg font-bold ${getScoreColor(article.applicabilityScore)}`}
              >
                {Math.round(article.applicabilityScore * 100)}%
              </span>
            </div>
          )}

        {isExpanded && (
          <>
            {/* 法条全文 */}
            <div className='mb-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800'>
              <p className='whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300'>
                {article.content}
              </p>
            </div>

            {/* 适用性理由 */}
            {article.applicabilityReason && (
              <div className='mb-3'>
                <h4 className='mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                  适用性理由：
                </h4>
                <p className='text-sm leading-relaxed text-zinc-600 dark:text-zinc-400'>
                  {article.applicabilityReason}
                </p>
              </div>
            )}

            {/* 已移除原因 */}
            {isRemoved && feedback?.otherReason && (
              <div className='mb-3 rounded-lg bg-red-50 p-3 dark:bg-red-900/20'>
                <h4 className='mb-1 text-sm font-medium text-red-900 dark:text-red-300'>
                  移除说明：
                </h4>
                <p className='text-sm leading-relaxed text-red-800 dark:text-red-400'>
                  {feedback.otherReason}
                </p>
              </div>
            )}
          </>
        )}

        {/* 操作按钮 */}
        {isActionable && (
          <div className='flex gap-2'>
            {onConfirm && (
              <button
                onClick={() => onConfirm(article.id)}
                className='flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
              >
                <CheckCircle2 className='h-4 w-4' />
                确认适用
              </button>
            )}

            {onRemove && (
              <button
                onClick={() => onRemove(article.id)}
                className='flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30'
              >
                <XCircle className='h-4 w-4' />
                移除
              </button>
            )}
          </div>
        )}

        {/* 撤销操作 */}
        {feedback && (
          <div className='mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700'>
            <p className='mb-2 text-xs text-zinc-500 dark:text-zinc-400'>
              操作时间：{new Date(feedback.timestamp).toLocaleString('zh-CN')}
            </p>
            {onViewDetails && (
              <button
                onClick={() => onViewDetails(article.id)}
                className='text-sm text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
              >
                查看详情
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
