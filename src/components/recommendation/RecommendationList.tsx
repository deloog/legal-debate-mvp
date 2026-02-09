/**
 * 推荐列表组件
 * 显示多个推荐法条的列表，支持过滤、排序和分页
 */

'use client';

import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { RecommendationCard } from './RecommendationCard';
import type {
  Recommendation,
  RecommendationDisplayOptions,
  RecommendationCallbacks,
  RecommendationFilterOptions,
  RecommendationSortBy,
  RecommendationSortOrder,
} from '@/types/recommendation';

/**
 * 推荐列表组件属性
 */
export interface RecommendationListProps
  extends
    Partial<RecommendationDisplayOptions>,
    Partial<RecommendationCallbacks>,
    Partial<RecommendationFilterOptions> {
  recommendations: Recommendation[];
  title?: string;
  showCount?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  limit?: number;
  showLoadMore?: boolean;
  sortBy?: RecommendationSortBy;
  sortOrder?: RecommendationSortOrder;
  layout?: 'list' | 'grid';
  className?: string;
  userId?: string;
  contextType?: 'DEBATE' | 'CONTRACT' | 'GENERAL' | 'SEARCH';
  contextId?: string;
  showFeedback?: boolean;
}

/**
 * 过滤推荐列表
 */
function filterRecommendations(
  recommendations: Recommendation[],
  filters: RecommendationFilterOptions
): Recommendation[] {
  let filtered = [...recommendations];

  // 按最小分数过滤
  if (filters.minScore !== undefined) {
    filtered = filtered.filter(rec => rec.score >= filters.minScore!);
  }

  // 按最大分数过滤
  if (filters.maxScore !== undefined) {
    filtered = filtered.filter(rec => rec.score <= filters.maxScore!);
  }

  // 按分类过滤
  if (filters.categories && filters.categories.length > 0) {
    filtered = filtered.filter(rec =>
      filters.categories!.includes(rec.article.category)
    );
  }

  // 按关系类型过滤
  if (filters.relationTypes && filters.relationTypes.length > 0) {
    filtered = filtered.filter(
      rec =>
        rec.relationType && filters.relationTypes!.includes(rec.relationType)
    );
  }

  // 按关键词过滤
  if (filters.keywords && filters.keywords.length > 0) {
    filtered = filtered.filter(rec => {
      const articleKeywords = rec.article.keywords || [];
      return filters.keywords!.some(keyword =>
        articleKeywords.includes(keyword)
      );
    });
  }

  // 按搜索文本过滤
  if (filters.searchText) {
    const searchLower = filters.searchText.toLowerCase();
    filtered = filtered.filter(
      rec =>
        rec.article.lawName.toLowerCase().includes(searchLower) ||
        rec.article.articleNumber.toLowerCase().includes(searchLower) ||
        rec.article.fullText.toLowerCase().includes(searchLower) ||
        rec.reason.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
}

/**
 * 排序推荐列表
 */
function sortRecommendations(
  recommendations: Recommendation[],
  sortBy: RecommendationSortBy,
  sortOrder: RecommendationSortOrder
): Recommendation[] {
  const sorted = [...recommendations];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'score':
        comparison = a.score - b.score;
        break;
      case 'date':
        comparison =
          a.article.effectiveDate.getTime() - b.article.effectiveDate.getTime();
        break;
      case 'relevance':
        comparison = a.score - b.score; // 默认使用分数作为相关性
        break;
      case 'name':
        comparison = a.article.lawName.localeCompare(b.article.lawName);
        break;
      default:
        comparison = 0;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * 推荐列表组件
 */
export function RecommendationList({
  recommendations,
  title,
  showCount = false,
  loading = false,
  emptyMessage = '暂无推荐法条',
  limit,
  showLoadMore = false,
  sortBy = 'score',
  sortOrder = 'desc',
  layout = 'list',
  className = '',
  // 过滤选项
  minScore,
  maxScore,
  categories,
  relationTypes,
  keywords,
  searchText,
  // 显示选项
  showScore,
  showReason,
  showRelationType,
  showFullText,
  showKeywords,
  showTags,
  showActions,
  compact,
  // 反馈选项
  userId,
  contextType,
  contextId,
  showFeedback = false,
  // 回调函数
  onSelect,
  onView,
  onExpand,
  onCollapse,
}: RecommendationListProps) {
  const [displayLimit, setDisplayLimit] = useState(
    limit || recommendations.length
  );

  // 过滤和排序推荐
  const processedRecommendations = useMemo(() => {
    // 过滤
    const filtered = filterRecommendations(recommendations, {
      minScore,
      maxScore,
      categories,
      relationTypes,
      keywords,
      searchText,
    });

    // 排序
    const sorted = sortRecommendations(filtered, sortBy, sortOrder);

    // 限制数量
    if (limit !== undefined) {
      if (limit === 0) return [];
      return sorted.slice(0, displayLimit);
    }
    return sorted;
  }, [
    recommendations,
    minScore,
    maxScore,
    categories,
    relationTypes,
    keywords,
    searchText,
    sortBy,
    sortOrder,
    limit,
    displayLimit,
  ]);

  // 处理加载更多
  const handleLoadMore = () => {
    setDisplayLimit(prev => prev + (limit || 10));
  };

  // 是否显示加载更多按钮
  const showLoadMoreButton =
    showLoadMore &&
    limit &&
    displayLimit < recommendations.length &&
    processedRecommendations.length >= displayLimit;

  // 加载状态
  if (loading) {
    return (
      <div className='recommendation-list-loading'>
        <Loader2 className='animate-spin' size={24} />
        <span>加载中...</span>
      </div>
    );
  }

  // 空状态
  if (processedRecommendations.length === 0) {
    return (
      <div className='recommendation-list-empty'>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`recommendation-list ${className}`}>
      {/* 标题和数量 */}
      {(title || showCount) && (
        <div className='list-header'>
          {title && <h2 className='list-title'>{title}</h2>}
          {showCount && (
            <span className='list-count'>
              共 {processedRecommendations.length} 条推荐
            </span>
          )}
        </div>
      )}

      {/* 推荐卡片列表 */}
      <div className={`list-content ${layout}-layout`}>
        {processedRecommendations.map((recommendation, index) => (
          <RecommendationCard
            key={recommendation.article.id || index}
            recommendation={recommendation}
            showScore={showScore}
            showReason={showReason}
            showRelationType={showRelationType}
            showFullText={showFullText}
            showKeywords={showKeywords}
            showTags={showTags}
            showActions={showActions}
            compact={compact}
            userId={userId}
            contextType={contextType}
            contextId={contextId}
            showFeedback={showFeedback}
            onSelect={onSelect}
            onView={onView}
            onExpand={onExpand}
            onCollapse={onCollapse}
          />
        ))}
      </div>

      {/* 加载更多按钮 */}
      {showLoadMoreButton && (
        <div className='list-footer'>
          <button onClick={handleLoadMore} className='load-more-button'>
            加载更多
          </button>
        </div>
      )}
    </div>
  );
}
