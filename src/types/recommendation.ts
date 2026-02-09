/**
 * 推荐组件共享类型定义
 * 用于推荐卡片、推荐列表、推荐原因等组件
 */

/**
 * 法条信息
 */
export interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  category: string;
  effectiveDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  keywords?: string[];
  tags?: string[];
}

/**
 * 推荐结果
 */
export interface Recommendation {
  article: LawArticle;
  score: number;
  reason: string;
  relationType?: string;
}

/**
 * 推荐卡片操作类型
 */
export type RecommendationAction = 'select' | 'view' | 'expand' | 'collapse';

/**
 * 推荐卡片回调函数
 */
export interface RecommendationCallbacks {
  onSelect?: (article: LawArticle) => void;
  onView?: (article: LawArticle) => void;
  onExpand?: (articleId: string) => void;
  onCollapse?: (articleId: string) => void;
}

/**
 * 推荐显示选项
 */
export interface RecommendationDisplayOptions {
  showScore?: boolean;
  showReason?: boolean;
  showRelationType?: boolean;
  showFullText?: boolean;
  showKeywords?: boolean;
  showTags?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

/**
 * 推荐过滤选项
 */
export interface RecommendationFilterOptions {
  minScore?: number;
  maxScore?: number;
  categories?: string[];
  relationTypes?: string[];
  keywords?: string[];
  searchText?: string;
}

/**
 * 推荐排序选项
 */
export type RecommendationSortBy = 'score' | 'date' | 'relevance' | 'name';
export type RecommendationSortOrder = 'asc' | 'desc';

export interface RecommendationSortOptions {
  sortBy: RecommendationSortBy;
  sortOrder: RecommendationSortOrder;
}
