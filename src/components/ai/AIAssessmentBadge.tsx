'use client';

/**
 * AI内容标识组件
 *
 * 用于在UI层明确标识AI生成内容，符合《长期演进指南》P0-2任务要求
 *
 * 功能特性：
 * - 在所有AI生成输出添加"AI生成"标识
 * - 显示置信度分数（高≥80%/中≥50%/低）
 * - 显示验证状态（待验证/已验证/未通过验证）
 * - 提供来源链接入口
 *
 * @module AIAssessmentBadge
 * @version 1.0.0
 * @date 2026-02-25
 */

import {
  Sparkles,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { AIAssessment } from '@/types/consultation';

/**
 * AI内容验证状态类型
 */
export type AIVerificationStatus = 'pending' | 'verified' | 'rejected';

/**
 * AI内容类型
 */
export type AIContentType =
  | 'assessment'
  | 'legal_analysis'
  | 'document'
  | 'recommendation'
  | 'general';

/**
 * AI评估徽章组件属性
 */
interface AIAssessmentBadgeProps {
  assessment: AIAssessment;
  showBadge?: boolean;
  showConfidence?: boolean;
  confidence?: number;
  showVerificationStatus?: boolean;
  verificationStatus?: AIVerificationStatus;
  showSourceLink?: boolean;
  sourceUrl?: string;
  className?: string;
}

/**
 * 内容类型标签映射
 */
const CONTENT_TYPE_LABELS: Record<AIContentType, string> = {
  assessment: 'AI评估',
  legal_analysis: 'AI法律分析',
  document: 'AI文书生成',
  recommendation: 'AI推荐',
  general: 'AI生成',
};

/**
 * 验证状态标签映射
 */
const VERIFICATION_STATUS_LABELS: Record<AIVerificationStatus, string> = {
  pending: '待验证',
  verified: '已验证',
  rejected: '未通过验证',
};

/**
 * 获取验证状态样式
 */
function getVerificationStatusStyle(status: AIVerificationStatus): {
  color: string;
  bg: string;
  icon: React.ComponentType<{ className?: string }>;
} {
  switch (status) {
    case 'verified':
      return {
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20',
        icon: CheckCircle,
      };
    case 'rejected':
      return {
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        icon: AlertCircle,
      };
    case 'pending':
    default:
      return {
        color: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: Clock,
      };
  }
}

/**
 * 获取置信度样式
 */
function getConfidenceStyle(confidence: number): string {
  if (confidence >= 0.8) return 'confidence-high';
  if (confidence >= 0.5) return 'confidence-medium';
  return 'confidence-low';
}

/**
 * AI评估徽章组件
 *
 * 用于在AI评估内容上显示标识、置信度、验证状态等信息
 */
export function AIAssessmentBadge({
  assessment,
  showBadge = true,
  showConfidence = false,
  confidence,
  showVerificationStatus = false,
  verificationStatus,
  showSourceLink = false,
  sourceUrl,
  className = '',
}: AIAssessmentBadgeProps) {
  // 如果不需要显示任何标识，返回空
  if (
    !showBadge &&
    !showConfidence &&
    !showVerificationStatus &&
    !showSourceLink
  ) {
    return null;
  }

  const confidenceValue = confidence ?? assessment.winRate;

  return (
    <div
      className={`ai-assessment-badge flex flex-wrap items-center gap-2 ${className}`}
    >
      {/* AI生成标识 */}
      {showBadge && (
        <div className='inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'>
          <Sparkles className='h-3 w-3' />
          <span>AI生成</span>
        </div>
      )}

      {/* 置信度 */}
      {showConfidence && confidenceValue !== undefined && (
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getConfidenceStyle(confidenceValue)}`}
        >
          <span>置信度: {Math.round(confidenceValue * 100)}%</span>
        </div>
      )}

      {/* 验证状态 */}
      {showVerificationStatus && verificationStatus && (
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getVerificationStatusStyle(verificationStatus).bg} ${getVerificationStatusStyle(verificationStatus).color}`}
        >
          {(() => {
            const Icon = getVerificationStatusStyle(verificationStatus).icon;
            return <Icon className='h-3 w-3' />;
          })()}
          <span>{VERIFICATION_STATUS_LABELS[verificationStatus]}</span>
        </div>
      )}

      {/* 来源链接 */}
      {showSourceLink && sourceUrl && (
        <a
          href={sourceUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:bg-gray-900/20 dark:text-gray-300 dark:hover:bg-gray-900/40'
        >
          <ExternalLink className='h-3 w-3' />
          <span>来源</span>
        </a>
      )}
    </div>
  );
}

/**
 * AI内容标识组件属性
 */
interface AIContentIndicatorProps {
  contentType?: AIContentType;
  showBadge?: boolean;
  showConfidence?: boolean;
  confidence?: number;
  verificationStatus?: AIVerificationStatus;
  showVerificationStatus?: boolean;
  className?: string;
}

/**
 * AI内容标识组件
 *
 * 通用的AI内容标识组件，可用于各种AI生成内容的标识
 */
export function AIContentIndicator({
  contentType = 'general',
  showBadge = true,
  showConfidence = false,
  confidence,
  verificationStatus,
  showVerificationStatus = false,
  className = '',
}: AIContentIndicatorProps) {
  // 如果不显示标识，返回空
  if (!showBadge && !showConfidence && !showVerificationStatus) {
    return null;
  }

  return (
    <div
      className={`ai-content-indicator flex flex-wrap items-center gap-2 ${className}`}
    >
      {/* AI生成标识 */}
      {showBadge && (
        <div className='inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'>
          <Sparkles className='h-3 w-3' />
          <span>{CONTENT_TYPE_LABELS[contentType]}</span>
        </div>
      )}

      {/* 置信度 */}
      {showConfidence && confidence !== undefined && (
        <div
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getConfidenceStyle(confidence)}`}
        >
          <span>置信度: {Math.round(confidence * 100)}%</span>
        </div>
      )}

      {/* 验证状态 */}
      {showVerificationStatus && verificationStatus && (
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${getVerificationStatusStyle(verificationStatus).bg} ${getVerificationStatusStyle(verificationStatus).color}`}
        >
          {(() => {
            const Icon = getVerificationStatusStyle(verificationStatus).icon;
            return <Icon className='h-3 w-3' />;
          })()}
          <span>{VERIFICATION_STATUS_LABELS[verificationStatus]}</span>
        </div>
      )}
    </div>
  );
}
