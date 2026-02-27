'use client';

import { useState } from 'react';
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Scale,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { AIAssessment } from '@/types/consultation';
import { AIAssessmentBadge } from '@/components/ai/AIAssessmentBadge';

/**
 * AI评估卡片组件属性
 */
interface AIAssessmentCardProps {
  consultationId?: string;
  assessment: AIAssessment | null;
  onRefresh?: () => void;
  isLoading?: boolean;
}

/**
 * AI案件评估展示卡片组件
 */
export function AIAssessmentCard({
  assessment,
  onRefresh,
  isLoading = false,
}: AIAssessmentCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 处理刷新评估
  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // 获取难度颜色和图标
  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY':
        return {
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-900/20',
          label: '简单',
          icon: CheckCircle,
        };
      case 'MEDIUM':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          label: '中等',
          icon: Scale,
        };
      case 'HARD':
        return {
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-900/20',
          label: '复杂',
          icon: AlertTriangle,
        };
      default:
        return {
          color: 'text-gray-600 dark:text-gray-400',
          bg: 'bg-gray-50 dark:bg-gray-900/20',
          label: '未知',
          icon: Scale,
        };
    }
  };

  // 获取风险颜色
  const getRiskStyle = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW':
        return {
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-900/20',
          label: '低风险',
        };
      case 'MEDIUM':
        return {
          color: 'text-yellow-600 dark:text-yellow-400',
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          label: '中风险',
        };
      case 'HIGH':
        return {
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-900/20',
          label: '高风险',
        };
      default:
        return {
          color: 'text-gray-600 dark:text-gray-400',
          bg: 'bg-gray-50 dark:bg-gray-900/20',
          label: '未知',
        };
    }
  };

  // 获取胜诉率颜色
  const getWinRateColor = (rate: number) => {
    if (rate >= 0.7) return 'bg-green-500';
    if (rate >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='animate-pulse space-y-4'>
          <div className='h-6 w-32 rounded bg-zinc-200 dark:bg-zinc-800' />
          <div className='h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800' />
          <div className='h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800' />
          <div className='grid grid-cols-2 gap-4'>
            <div className='h-20 rounded bg-zinc-200 dark:bg-zinc-800' />
            <div className='h-20 rounded bg-zinc-200 dark:bg-zinc-800' />
          </div>
        </div>
      </div>
    );
  }

  // 未评估状态
  if (!assessment) {
    return (
      <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
            AI案件评估
          </h2>
        </div>
        <div className='rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900'>
          <TrendingUp className='mx-auto h-12 w-12 text-zinc-400' />
          <p className='mt-3 text-sm text-zinc-600 dark:text-zinc-400'>
            暂无评估数据
          </p>
          <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-500'>
            点击下方按钮进行AI智能评估
          </p>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className='mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isRefreshing ? (
              <>
                <RefreshCw className='h-4 w-4 animate-spin' />
                评估中...
              </>
            ) : (
              <>
                <TrendingUp className='h-4 w-4' />
                立即评估
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const difficultyStyle = getDifficultyStyle(assessment.difficulty);
  const riskStyle = getRiskStyle(assessment.riskLevel);
  const DifficultyIcon = difficultyStyle.icon;

  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
      {/* 头部 */}
      <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-2'>
          <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
            AI案件评估
          </h2>
          {/* AI生成标识 */}
          <AIAssessmentBadge
            assessment={assessment}
            showBadge
            showConfidence
            showVerificationStatus
            verificationStatus={assessment.verifiedStatus || 'pending'}
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className='flex items-center gap-1 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
          title='重新评估'
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* 胜诉率 */}
      <div className='mb-6'>
        <div className='mb-2 flex items-center justify-between'>
          <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            胜诉率评估
          </span>
          <span className='text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
            {Math.round(assessment.winRate * 100)}%
          </span>
        </div>
        <div className='h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700'>
          <div
            className={`h-full rounded-full transition-all duration-500 ${getWinRateColor(assessment.winRate)}`}
            style={{ width: `${Math.round(assessment.winRate * 100)}%` }}
          />
        </div>
        <p className='mt-2 text-xs text-zinc-500 dark:text-zinc-400'>
          {assessment.winRateReasoning}
        </p>
      </div>

      {/* 难度和风险 */}
      <div className='mb-6 grid grid-cols-2 gap-4'>
        <div className={`rounded-lg p-3 ${difficultyStyle.bg}`}>
          <div className='flex items-center gap-2'>
            <DifficultyIcon className={`h-5 w-5 ${difficultyStyle.color}`} />
            <div>
              <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                案件难度
              </p>
              <p className={`font-semibold ${difficultyStyle.color}`}>
                {difficultyStyle.label}
              </p>
            </div>
          </div>
        </div>
        <div className={`rounded-lg p-3 ${riskStyle.bg}`}>
          <div className='flex items-center gap-2'>
            <AlertTriangle className={`h-5 w-5 ${riskStyle.color}`} />
            <div>
              <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                风险等级
              </p>
              <p className={`font-semibold ${riskStyle.color}`}>
                {riskStyle.label}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 费用建议 */}
      <div className='mb-6 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900'>
        <div className='flex items-center gap-2'>
          <DollarSign className='h-5 w-5 text-green-500' />
          <div className='flex-1'>
            <p className='text-xs text-zinc-500 dark:text-zinc-400'>
              建议收费区间
            </p>
            <p className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
              ¥{assessment.suggestedFeeMin.toLocaleString()} - ¥
              {assessment.suggestedFeeMax.toLocaleString()}
            </p>
          </div>
        </div>
        <p className='mt-2 text-xs text-zinc-500 dark:text-zinc-400'>
          {assessment.feeReasoning}
        </p>
      </div>

      {/* 难度因素 */}
      {assessment.difficultyFactors.length > 0 && (
        <div className='mb-4'>
          <h3 className='mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            <Scale className='h-4 w-4' />
            难度因素
          </h3>
          <ul className='space-y-1'>
            {assessment.difficultyFactors.map((factor, index) => (
              <li
                key={index}
                className='flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400'
              >
                <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400' />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 风险因素 */}
      {assessment.riskFactors.length > 0 && (
        <div className='mb-4'>
          <h3 className='mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            <AlertTriangle className='h-4 w-4' />
            风险因素
          </h3>
          <ul className='space-y-1'>
            {assessment.riskFactors.map((factor, index) => (
              <li
                key={index}
                className='flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400'
              >
                <span className='mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400' />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 关键法律点 */}
      {assessment.keyLegalPoints.length > 0 && (
        <div className='mb-4'>
          <h3 className='mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            <BookOpen className='h-4 w-4' />
            关键法律点
          </h3>
          <div className='space-y-2'>
            {assessment.keyLegalPoints.map((point, index) => (
              <div
                key={index}
                className='rounded-md bg-blue-50 p-2 dark:bg-blue-900/20'
              >
                <p className='text-sm font-medium text-blue-700 dark:text-blue-300'>
                  {point.point}
                </p>
                <p className='text-xs text-blue-600 dark:text-blue-400'>
                  {point.relevantLaw}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 建议 */}
      {assessment.suggestions.length > 0 && (
        <div className='mb-4'>
          <h3 className='mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            <Lightbulb className='h-4 w-4' />
            律师建议
          </h3>
          <ul className='space-y-2'>
            {assessment.suggestions.map((suggestion, index) => (
              <li
                key={index}
                className='flex items-start gap-2 rounded-md bg-green-50 p-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300'
              >
                <CheckCircle className='mt-0.5 h-4 w-4 shrink-0' />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 类似案例 */}
      {assessment.similarCases && assessment.similarCases.length > 0 && (
        <div>
          <h3 className='mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300'>
            <TrendingUp className='h-4 w-4' />
            类似案例参考
          </h3>
          <div className='space-y-2'>
            {assessment.similarCases.map((caseItem, index) => (
              <div
                key={index}
                className='flex items-center justify-between rounded-md border border-zinc-200 p-2 dark:border-zinc-700'
              >
                <div className='flex-1'>
                  <p className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                    {caseItem.caseName}
                  </p>
                  <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                    相似度：{Math.round(caseItem.similarity * 100)}%
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    caseItem.result === '胜诉'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                      : caseItem.result === '败诉'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                  }`}
                >
                  {caseItem.result}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
