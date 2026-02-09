/**
 * 推荐原因组件
 * 显示推荐的原因、分数和详细信息
 */

'use client';

import type { RecommendationDisplayOptions } from '@/types/recommendation';

/**
 * 推荐原因组件属性
 */
export interface RecommendationReasonProps extends Partial<RecommendationDisplayOptions> {
  reason: string;
  score?: number;
  relationType?: string;
  details?: string[];
  showDetails?: boolean;
}

/**
 * 关系类型显示名称映射
 */
const RELATION_TYPE_LABELS: Record<string, string> = {
  CITES: '引用',
  CITED_BY: '被引用',
  CONFLICTS: '冲突',
  COMPLETES: '补充',
  COMPLETED_BY: '被补充',
  SUPERSEDES: '替代',
  SUPERSEDED_BY: '被替代',
  IMPLEMENTS: '实施',
  IMPLEMENTED_BY: '被实施',
  RELATED: '相关',
};

/**
 * 获取分数样式类名
 */
function getScoreClassName(score: number): string {
  if (score >= 0.8) return 'high-score';
  if (score >= 0.5) return 'medium-score';
  return 'low-score';
}

/**
 * 推荐原因组件
 */
export function RecommendationReason({
  reason,
  score,
  relationType,
  details,
  showScore = true,
  showRelationType = true,
  showDetails = true,
  compact = false,
}: RecommendationReasonProps) {
  // 如果原因为空，不渲染任何内容
  if (!reason) {
    return null;
  }

  return (
    <div
      className={`recommendation-reason ${compact ? 'compact' : ''}`}
      data-testid='recommendation-reason'
    >
      {/* 主要原因文本 */}
      <div className='reason-main'>
        <span className='reason-text'>{reason}</span>

        {/* 推荐分数 */}
        {showScore && score !== undefined && (
          <span
            className={`score-badge ${getScoreClassName(score)}`}
            data-score={score}
          >
            {Math.round(score * 100)}%
          </span>
        )}

        {/* 关系类型 */}
        {showRelationType && relationType && (
          <span
            className='relation-type-badge'
            data-relation-type={relationType}
          >
            {RELATION_TYPE_LABELS[relationType] || relationType}
          </span>
        )}
      </div>

      {/* 详细信息列表 */}
      {showDetails && details && details.length > 0 && (
        <ul className='details-list' role='list'>
          {details.map((detail, index) => (
            <li key={index} className='detail-item'>
              {detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
