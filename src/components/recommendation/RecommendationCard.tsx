/**
 * 推荐卡片组件
 * 显示单个推荐法条的详细信息
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Eye } from 'lucide-react';
import { RecommendationFeedbackButton } from '@/components/feedback/RecommendationFeedbackButton';
import type {
  Recommendation,
  RecommendationDisplayOptions,
  RecommendationCallbacks,
} from '@/types/recommendation';

/**
 * 推荐卡片组件属性
 */
export interface RecommendationCardProps
  extends
    Partial<RecommendationDisplayOptions>,
    Partial<RecommendationCallbacks> {
  recommendation: Recommendation;
  compact?: boolean;
  userId?: string;
  contextType?: 'DEBATE' | 'CONTRACT' | 'GENERAL' | 'SEARCH';
  contextId?: string;
  showFeedback?: boolean;
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
 * 推荐卡片组件
 */
export function RecommendationCard({
  recommendation,
  showScore = true,
  showReason = true,
  showRelationType = true,
  showFullText = false,
  showKeywords = true,
  showTags = true,
  showActions = true,
  compact = false,
  userId,
  contextType = 'GENERAL',
  contextId,
  showFeedback = false,
  onSelect,
  onView,
  onExpand,
  onCollapse,
}: RecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { article, score, reason, relationType } = recommendation;

  // 处理展开/收起
  const handleToggleExpand = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);

    if (newExpandedState) {
      onExpand?.(article.id);
    } else {
      onCollapse?.(article.id);
    }
  };

  // 处理选择
  const handleSelect = () => {
    onSelect?.(article);
  };

  // 处理查看详情
  const handleView = () => {
    onView?.(article);
  };

  return (
    <div
      className={`recommendation-card ${compact ? 'compact' : ''}`}
      data-testid='recommendation-card'
    >
      {/* 头部：法律名称和条款编号 */}
      <div className='card-header'>
        <div className='article-info'>
          <h3 className='law-name'>{article.lawName}</h3>
          <span className='article-number'>{article.articleNumber}</span>
        </div>

        {/* 推荐分数 */}
        {showScore && (
          <div
            className={`score-badge ${getScoreClassName(score)}`}
            data-score={score}
          >
            {Math.round(score * 100)}%
          </div>
        )}
      </div>

      {/* 推荐原因 */}
      {showReason && reason && (
        <div className='recommendation-reason'>
          <span className='reason-text'>{reason}</span>
        </div>
      )}

      {/* 关系类型 */}
      {showRelationType && relationType && (
        <div className='relation-type' data-relation-type={relationType}>
          <span className='relation-label'>
            {RELATION_TYPE_LABELS[relationType] || relationType}
          </span>
        </div>
      )}

      {/* 关键词 */}
      {showKeywords && article.keywords && article.keywords.length > 0 && (
        <div className='keywords'>
          {article.keywords.map((keyword, index) => (
            <span key={index} className='keyword-tag'>
              {keyword}
            </span>
          ))}
        </div>
      )}

      {/* 标签 */}
      {showTags && article.tags && article.tags.length > 0 && (
        <div className='tags'>
          {article.tags.map((tag, index) => (
            <span key={index} className='tag-badge'>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 全文展示 */}
      {showFullText && (
        <div className='full-text-section'>
          {!isExpanded ? (
            <button
              onClick={handleToggleExpand}
              className='expand-button'
              aria-label='展开查看全文'
            >
              <span>查看全文</span>
              <ChevronDown size={16} />
            </button>
          ) : (
            <>
              <div className='full-text-content'>{article.fullText}</div>
              <button
                onClick={handleToggleExpand}
                className='collapse-button'
                aria-label='收起'
              >
                <span>收起</span>
                <ChevronUp size={16} />
              </button>
            </>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      {showActions && (
        <div className='card-actions'>
          {onSelect && (
            <button
              onClick={handleSelect}
              className='action-button select-button'
              aria-label='选择'
            >
              <Check size={16} />
              <span>选择</span>
            </button>
          )}
          {onView && (
            <button
              onClick={handleView}
              className='action-button view-button'
              aria-label='查看详情'
            >
              <Eye size={16} />
              <span>查看详情</span>
            </button>
          )}
        </div>
      )}

      {/* 反馈按钮 */}
      {showFeedback && userId && (
        <div className='card-feedback'>
          <RecommendationFeedbackButton
            userId={userId}
            lawArticleId={article.id}
            lawArticleName={`${article.lawName}${article.articleNumber}`}
            contextType={contextType}
            contextId={contextId}
            showCommentInput={true}
          />
        </div>
      )}
    </div>
  );
}
