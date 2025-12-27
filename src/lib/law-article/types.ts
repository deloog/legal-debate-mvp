import type { LawArticle, LawCategory, LawStatus } from '@prisma/client';

/**
 * 检索查询参数
 */
export interface SearchQuery {
  /** 搜索关键词 */
  keyword?: string;
  /** 法律分类 */
  category?: LawCategory;
  /** 子分类 */
  subCategory?: string;
  /** 标签筛选 */
  tags?: string[];
  /** 关键词筛选 */
  keywords?: string[];
  /** 法律名称（模糊匹配） */
  lawName?: string;
  /** 法条编号 */
  articleNumber?: string;
  /** 法律状态 */
  status?: LawStatus;
  /** 分页参数 */
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  /** 排序参数 */
  sort?: {
    field: 'createdAt' | 'updatedAt' | 'viewCount' | 'referenceCount' | 'relevance';
    order: 'asc' | 'desc';
  };
  /** 是否包含子法条 */
  includeChildren?: boolean;
  /** 最小相关性得分 */
  minRelevanceScore?: number;
}

/**
 * 检索结果
 */
export interface SearchResult {
  /** 法条信息 */
  article: LawArticle;
  /** 相关性得分（0-1） */
  relevanceScore: number;
  /** 匹配详情 */
  matchDetails: {
    /** 关键词匹配得分 */
    keywordScore: number;
    /** 分类匹配得分 */
    categoryScore: number;
    /** 标签匹配得分 */
    tagScore: number;
    /** 热度得分 */
    popularityScore: number;
  };
  /** 匹配的关键词位置（用于高亮） */
  matchedKeywords: string[];
}

/**
 * 检索响应
 */
export interface SearchResponse {
  /** 检索结果列表 */
  results: SearchResult[];
  /** 分页信息 */
  pagination: {
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    pageSize: number;
    /** 总数量 */
    total: number;
    /** 总页数 */
    totalPages: number;
    /** 是否有下一页 */
    hasNext: boolean;
    /** 是否有上一页 */
    hasPrev: boolean;
  };
  /** 检索耗时（毫秒） */
  executionTime: number;
  /** 是否使用了缓存 */
  cached: boolean;
}

/**
 * 相关性评分权重配置
 */
export interface RelevanceWeightConfig {
  /** 关键词匹配权重 */
  keywordWeight: number;
  /** 分类匹配权重 */
  categoryWeight: number;
  /** 标签匹配权重 */
  tagWeight: number;
  /** 热度权重 */
  popularityWeight: number;
}

/**
 * 相关性评分结果
 */
export interface RelevanceScore {
  /** 总体得分 */
  totalScore: number;
  /** 关键词匹配得分 */
  keywordScore: number;
  /** 分类匹配得分 */
  categoryScore: number;
  /** 标签匹配得分 */
  tagScore: number;
  /** 热度得分 */
  popularityScore: number;
  /** 评分详情 */
  details: {
    /** 匹配的关键词数量 */
    matchedKeywordsCount: number;
    /** 匹配的标签数量 */
    matchedTagsCount: number;
    /** 分类是否匹配 */
    categoryMatched: boolean;
    /** 子分类是否匹配 */
    subCategoryMatched: boolean;
  };
}

/**
 * 相似法条推荐结果
 */
export interface SimilarArticle {
  /** 相似法条 */
  article: LawArticle;
  /** 相似度得分（0-1） */
  similarityScore: number;
  /** 相似原因 */
  reasons: string[];
}

/**
 * 检索统计信息
 */
export interface SearchStatistics {
  /** 总检索次数 */
  totalSearches: number;
  /** 缓存命中次数 */
  cacheHits: number;
  /** 缓存命中率 */
  cacheHitRate: number;
  /** 平均检索时间（毫秒） */
  averageExecutionTime: number;
  /** 最热门的检索关键词 */
  topKeywords: Array<{
    keyword: string;
    count: number;
  }>;
  /** 最近检索时间 */
  lastSearchTime?: Date;
}

/**
 * 检索缓存键
 */
export interface SearchCacheKey {
  /** 搜索关键词 */
  keyword?: string;
  /** 分类 */
  category?: LawCategory;
  /** 子分类 */
  subCategory?: string;
  /** 标签（排序后） */
  tags?: string[];
  /** 排序字段 */
  sortField?: string;
  /** 排序方向 */
  sortOrder?: string;
  /** 分页信息 */
  page?: number;
  pageSize?: number;
}

/**
 * 检索缓存值
 */
export interface SearchCacheValue {
  /** 缓存的结果 */
  results: SearchResult[];
  /** 缓存时间 */
  cachedAt: Date;
  /** 检索耗时 */
  executionTime: number;
  /** 总数量 */
  total: number;
}
