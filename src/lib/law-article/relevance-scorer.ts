import type { LawArticle } from '@prisma/client';
import type {
  RelevanceScore,
  RelevanceWeightConfig,
  SearchQuery,
} from './types';

/**
 * 法条相关性评分器
 * 负责计算法条与检索查询的相关性得分
 */
export class RelevanceScorer {
  private static readonly DEFAULT_WEIGHTS: RelevanceWeightConfig = {
    keywordWeight: 0.4,
    categoryWeight: 0.3,
    tagWeight: 0.2,
    popularityWeight: 0.1,
  };

  private static readonly POPULARITY_THRESHOLD = 100; // 热度阈值

  /**
   * 计算法条的相关性得分
   */
  static calculateScore(
    article: LawArticle,
    query: SearchQuery,
    weights: RelevanceWeightConfig = RelevanceScorer.DEFAULT_WEIGHTS
  ): RelevanceScore {
    const keywordScore = this.calculateKeywordScore(article, query);
    const categoryScore = this.calculateCategoryScore(article, query);
    const tagScore = this.calculateTagScore(article, query);
    const popularityScore = this.calculatePopularityScore(article);

    const totalScore =
      keywordScore * weights.keywordWeight +
      categoryScore * weights.categoryWeight +
      tagScore * weights.tagWeight +
      popularityScore * weights.popularityWeight;

    return {
      totalScore,
      keywordScore,
      categoryScore,
      tagScore,
      popularityScore,
      details: this.calculateMatchDetails(article, query),
    };
  }

  /**
   * 计算关键词匹配得分（0-1）
   */
  private static calculateKeywordScore(
    article: LawArticle,
    query: SearchQuery
  ): number {
    if (!query.keyword || !query.keyword.trim()) {
      return 0;
    }

    const keyword = query.keyword.trim().toLowerCase();
    const searchableFields = [
      article.fullText?.toLowerCase() || '',
      article.searchableText?.toLowerCase() || '',
      article.lawName?.toLowerCase() || '',
      article.articleNumber?.toLowerCase() || '',
    ];

    // 计算关键词在各字段中的出现次数
    const matchCount = searchableFields.reduce((count, field) => {
      return count + (field.split(keyword).length - 1);
    }, 0);

    // 如果没有匹配，返回0
    if (matchCount === 0) {
      return 0;
    }

    // 基于匹配次数计算得分（最高1分）
    return Math.min(matchCount / 5, 1.0);
  }

  /**
   * 计算分类匹配得分（0-1）
   */
  private static calculateCategoryScore(
    article: LawArticle,
    query: SearchQuery
  ): number {
    let score = 0;
    let maxScore = 0;

    // 分类匹配（权重0.7）
    if (query.category) {
      maxScore += 0.7;
      if (article.category === query.category) {
        score += 0.7;
      }
    }

    // 子分类匹配（权重0.3）
    if (query.subCategory && query.subCategory.trim()) {
      maxScore += 0.3;
      if (
        article.subCategory?.toLowerCase() ===
        query.subCategory.trim().toLowerCase()
      ) {
        score += 0.3;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * 计算标签匹配得分（0-1）
   */
  private static calculateTagScore(
    article: LawArticle,
    query: SearchQuery
  ): number {
    if (!query.tags || query.tags.length === 0) {
      return 0;
    }

    const articleTags = article.tags || [];
    const articleKeywords = article.keywords || [];
    const allTags = [...articleTags, ...articleKeywords];

    // 计算匹配的标签数量
    const matchedCount = query.tags.filter(tag =>
      allTags.some(at => at.toLowerCase() === tag.toLowerCase())
    ).length;

    // 计算匹配的keywords数量
    let matchedKeywordsCount = 0;
    if (query.keywords && query.keywords.length > 0) {
      matchedKeywordsCount = query.keywords.filter(keyword =>
        articleKeywords.some(ak => ak.toLowerCase() === keyword.toLowerCase())
      ).length;
    }

    // 总匹配数
    const totalMatched = matchedCount + matchedKeywordsCount;
    const totalQueryTags = query.tags.length + (query.keywords?.length || 0);

    if (totalQueryTags === 0) {
      return 0;
    }

    return totalMatched / totalQueryTags;
  }

  /**
   * 计算热度得分（0-1）
   * 基于浏览次数和引用次数
   */
  private static calculatePopularityScore(article: LawArticle): number {
    const viewCount = article.viewCount || 0;
    const referenceCount = article.referenceCount || 0;

    // 使用对数缩放，避免极端值
    const viewScore =
      Math.log10(viewCount + 1) / Math.log10(this.POPULARITY_THRESHOLD + 1);
    const referenceScore =
      Math.log10(referenceCount + 1) /
      Math.log10(this.POPULARITY_THRESHOLD + 1);

    // 综合得分（浏览次数权重0.6，引用次数权重0.4）
    return Math.min(viewScore * 0.6 + referenceScore * 0.4, 1.0);
  }

  /**
   * 计算匹配详情
   */
  private static calculateMatchDetails(
    article: LawArticle,
    query: SearchQuery
  ): RelevanceScore['details'] {
    const matchedKeywords = this.extractMatchedKeywords(article, query);
    const matchedTags = this.extractMatchedTags(article, query);

    return {
      matchedKeywordsCount: matchedKeywords.length,
      matchedTagsCount: matchedTags.length,
      categoryMatched: query.category
        ? article.category === query.category
        : false,
      subCategoryMatched:
        query.subCategory && query.subCategory.trim()
          ? article.subCategory?.toLowerCase() ===
            query.subCategory.trim().toLowerCase()
          : false,
    };
  }

  /**
   * 提取匹配的关键词
   */
  private static extractMatchedKeywords(
    article: LawArticle,
    query: SearchQuery
  ): string[] {
    if (!query.keyword || !query.keyword.trim()) {
      return [];
    }

    const keyword = query.keyword.trim().toLowerCase();
    const matchedKeywords: string[] = [];

    // 检查法律名称
    if (article.lawName?.toLowerCase().includes(keyword)) {
      matchedKeywords.push(keyword);
    }

    // 检查条款编号
    if (article.articleNumber?.toLowerCase().includes(keyword)) {
      matchedKeywords.push(keyword);
    }

    return matchedKeywords;
  }

  /**
   * 提取匹配的标签
   */
  private static extractMatchedTags(
    article: LawArticle,
    query: SearchQuery
  ): string[] {
    if (!query.tags || query.tags.length === 0) {
      return [];
    }

    const articleTags = article.tags || [];
    const articleKeywords = article.keywords || [];
    const allTags = [...articleTags, ...articleKeywords];

    return query.tags.filter(tag =>
      allTags.some(at => at.toLowerCase() === tag.toLowerCase())
    );
  }

  /**
   * 计算两个法条之间的相似度
   */
  static calculateSimilarity(
    article1: LawArticle,
    article2: LawArticle
  ): number {
    // 分类相似度
    const categorySimilarity =
      article1.category === article2.category ? 1.0 : 0.0;

    // 标签相似度
    const tags1 = new Set(article1.tags || []);
    const tags2 = new Set(article2.tags || []);
    const intersection = new Set([...tags1].filter(tag => tags2.has(tag)));
    const union = new Set([...tags1, ...tags2]);
    const tagSimilarity = union.size > 0 ? intersection.size / union.size : 0.0;

    // 关键词相似度
    const keywords1 = new Set(article1.keywords || []);
    const keywords2 = new Set(article2.keywords || []);
    const intersectionKw = new Set(
      [...keywords1].filter(kw => keywords2.has(kw))
    );
    const unionKw = new Set([...keywords1, ...keywords2]);
    const keywordSimilarity =
      unionKw.size > 0 ? intersectionKw.size / unionKw.size : 0.0;

    // 综合相似度
    return (
      categorySimilarity * 0.4 + tagSimilarity * 0.3 + keywordSimilarity * 0.3
    );
  }

  /**
   * 排序法条列表（按相关性得分）
   */
  static sortArticlesByRelevance<T extends { relevanceScore: number }>(
    articles: T[],
    order: 'asc' | 'desc' = 'desc'
  ): T[] {
    return [...articles].sort((a, b) => {
      const scoreA = a.relevanceScore;
      const scoreB = b.relevanceScore;

      if (order === 'desc') {
        return scoreB - scoreA;
      } else {
        return scoreA - scoreB;
      }
    });
  }

  /**
   * 过滤法条列表（按最小相关性得分）
   */
  static filterArticlesByMinScore<T extends { relevanceScore: number }>(
    articles: T[],
    minScore: number
  ): T[] {
    return articles.filter(article => article.relevanceScore >= minScore);
  }

  /**
   * 验证权重配置
   */
  static validateWeights(weights: RelevanceWeightConfig): boolean {
    const totalWeight =
      weights.keywordWeight +
      weights.categoryWeight +
      weights.tagWeight +
      weights.popularityWeight;

    return Math.abs(totalWeight - 1.0) < 0.001;
  }

  /**
   * 归一化权重配置
   */
  static normalizeWeights(
    weights: RelevanceWeightConfig
  ): RelevanceWeightConfig {
    const total =
      weights.keywordWeight +
      weights.categoryWeight +
      weights.tagWeight +
      weights.popularityWeight;

    if (total === 0) {
      return { ...RelevanceScorer.DEFAULT_WEIGHTS };
    }

    return {
      keywordWeight: weights.keywordWeight / total,
      categoryWeight: weights.categoryWeight / total,
      tagWeight: weights.tagWeight / total,
      popularityWeight: weights.popularityWeight / total,
    };
  }
}
