import { prisma } from '../db/prisma';
import { SearchQueryBuilder } from './search-query-builder';
import { RelevanceScorer } from './relevance-scorer';
import { SearchCacheManager } from './search-cache';
import { LawCategory } from '@prisma/client';
import { logger } from '@/lib/logger';
import type {
  SearchQuery,
  SearchResult,
  SearchResponse,
  SimilarArticle,
  RelevanceWeightConfig,
} from './types';

/**
 * 法条检索服务
 * 提供法条检索的核心功能
 */
export class LawArticleSearchService {
  /**
   * 检索法条
   */
  static async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // 清理和验证查询参数
      const sanitizedQuery = SearchQueryBuilder.sanitizeQuery(query);
      const validation = SearchQueryBuilder.validateQuery(sanitizedQuery);

      if (!validation.valid) {
        throw new Error(`查询参数验证失败: ${validation.errors.join(', ')}`);
      }

      // 构建缓存键
      const cacheKey: Parameters<
        typeof SearchCacheManager.generateCacheKey
      >[0] = {
        keyword: sanitizedQuery.keyword,
        category: sanitizedQuery.category,
        subCategory: sanitizedQuery.subCategory,
        tags: sanitizedQuery.tags,
        sortField: sanitizedQuery.sort?.field,
        sortOrder: sanitizedQuery.sort?.order,
        page: sanitizedQuery.pagination?.page,
        pageSize: sanitizedQuery.pagination?.pageSize,
      };

      // 尝试从缓存获取
      const cached = await SearchCacheManager.getCache(cacheKey);
      if (cached) {
        await SearchCacheManager.recordCacheHit();

        const pagination = SearchQueryBuilder.calculatePagination(
          cached.total,
          sanitizedQuery.pagination?.page || 1,
          sanitizedQuery.pagination?.pageSize || 20
        );

        return {
          results: cached.results,
          pagination,
          executionTime: Date.now() - startTime,
          cached: true,
        };
      }

      // 构建查询参数
      const queryParams = SearchQueryBuilder.buildQueryParams(sanitizedQuery);

      // 查询法条
      const [articles, total] = await Promise.all([
        prisma.lawArticle.findMany({
          where: queryParams.where,
          orderBy: queryParams.orderBy,
          skip: queryParams.skip,
          take: queryParams.take,
          include: queryParams.include,
        }),
        prisma.lawArticle.count({ where: queryParams.where }),
      ]);

      // 计算相关性得分
      const results: SearchResult[] = articles.map(article => {
        const score = RelevanceScorer.calculateScore(article, sanitizedQuery);

        // 提取匹配的关键词
        const matchedKeywords: string[] = [];
        if (sanitizedQuery.keyword) {
          const keyword = sanitizedQuery.keyword.trim().toLowerCase();
          const searchableText = [
            article.fullText?.toLowerCase() || '',
            article.searchableText?.toLowerCase() || '',
            article.lawName?.toLowerCase() || '',
          ];

          if (searchableText.some(text => text.includes(keyword))) {
            matchedKeywords.push(sanitizedQuery.keyword);
          }
        }

        // 确保relevanceScore是有效数字且在[0,1]范围内
        const relevanceScore =
          typeof score.totalScore === 'number'
            ? Math.max(0, Math.min(1, score.totalScore))
            : 0;

        return {
          article,
          relevanceScore,
          matchDetails: {
            keywordScore:
              typeof score.keywordScore === 'number' ? score.keywordScore : 0,
            categoryScore:
              typeof score.categoryScore === 'number' ? score.categoryScore : 0,
            tagScore: typeof score.tagScore === 'number' ? score.tagScore : 0,
            popularityScore:
              typeof score.popularityScore === 'number'
                ? score.popularityScore
                : 0,
          },
          matchedKeywords,
        };
      });

      // 如果需要按相关性排序
      if (sanitizedQuery.sort?.field === 'relevance') {
        const order = sanitizedQuery.sort.order || 'desc';
        results.sort((a, b) => {
          return order === 'desc'
            ? b.relevanceScore - a.relevanceScore
            : a.relevanceScore - b.relevanceScore;
        });
      }

      // 过滤最小相关性得分
      if (sanitizedQuery.minRelevanceScore !== undefined) {
        const minScore = sanitizedQuery.minRelevanceScore;
        for (let i = results.length - 1; i >= 0; i--) {
          if (results[i].relevanceScore < minScore) {
            results.splice(i, 1);
          }
        }
      }

      // 计算分页信息
      const pagination = SearchQueryBuilder.calculatePagination(
        total,
        queryParams.page,
        queryParams.pageSize
      );

      const executionTime = Date.now() - startTime;

      // 缓存结果
      await SearchCacheManager.setCache(cacheKey, {
        results,
        cachedAt: new Date(),
        executionTime,
        total,
      });

      // 记录检索统计
      await SearchCacheManager.recordSearch(sanitizedQuery.keyword);

      return {
        results,
        pagination,
        executionTime,
        cached: false,
      };
    } catch (error) {
      console.error('法条检索失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取法条详情
   */
  static async getArticleById(id: string) {
    try {
      const article = await prisma.lawArticle.findUnique({
        where: { id },
        include: {
          children: true,
          parent: true,
        },
      });

      if (article) {
        // 增加浏览计数
        await SearchCacheManager.incrementViewCount(id);
      }

      return article;
    } catch (error) {
      console.error('获取法条详情失败:', error);
      throw error;
    }
  }

  /**
   * 根据法律名称和法条编号获取法条
   */
  static async getArticleByLawNameAndNumber(
    lawName: string,
    articleNumber: string
  ) {
    try {
      // 唯一约束已变更为 (lawName, articleNumber, effectiveDate)，取最新有效版本
      const article = await prisma.lawArticle.findFirst({
        where: { lawName, articleNumber },
        orderBy: { effectiveDate: 'desc' },
        include: {
          children: true,
          parent: true,
        },
      });

      if (article) {
        await SearchCacheManager.incrementViewCount(article.id);
      }

      return article;
    } catch (error) {
      logger.error('获取法条详情失败', { error });
      throw error;
    }
  }

  /**
   * 查找相似法条
   */
  static async findSimilarArticles(
    articleId: string,
    limit: number = 10
  ): Promise<SimilarArticle[]> {
    try {
      const targetArticle = await prisma.lawArticle.findUnique({
        where: { id: articleId },
      });

      if (!targetArticle) {
        return [];
      }

      // 获取同一分类的法条
      const articles = await prisma.lawArticle.findMany({
        where: {
          id: { not: articleId },
          category: targetArticle.category,
        },
        take: limit * 2, // 获取更多候选结果
      });

      // 计算相似度并排序
      const similarArticles: SimilarArticle[] = articles
        .map(article => {
          const similarityScore = RelevanceScorer.calculateSimilarity(
            targetArticle,
            article
          );

          const reasons: string[] = [];
          if (targetArticle.category === article.category) {
            reasons.push('同一法律分类');
          }

          const commonTags = (targetArticle.tags || []).filter(tag =>
            (article.tags || []).includes(tag)
          );
          if (commonTags.length > 0) {
            reasons.push(`共有标签: ${commonTags.join(', ')}`);
          }

          return {
            article,
            similarityScore,
            reasons,
          };
        })
        .filter(item => item.similarityScore > 0.3) // 过滤低相似度
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit);

      return similarArticles;
    } catch (error) {
      console.error('查找相似法条失败:', error);
      throw error;
    }
  }

  /**
   * 获取热门法条（按浏览次数排序）
   */
  static async getPopularArticles(category?: LawCategory, limit: number = 10) {
    try {
      const where: { category?: LawCategory } = category ? { category } : {};

      return await prisma.lawArticle.findMany({
        where,
        orderBy: [{ viewCount: 'desc' }, { referenceCount: 'desc' }],
        take: limit,
      });
    } catch (error) {
      console.error('获取热门法条失败:', error);
      throw error;
    }
  }

  /**
   * 获取法律分类统计
   */
  static async getCategoryStats() {
    try {
      const stats = await prisma.lawArticle.groupBy({
        by: ['category'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });

      return stats.map(item => ({
        category: item.category,
        count: item._count.id,
      }));
    } catch (error) {
      console.error('获取分类统计失败:', error);
      throw error;
    }
  }

  /**
   * 批量获取法条
   */
  static async getArticlesByIds(ids: string[]) {
    try {
      return await prisma.lawArticle.findMany({
        where: {
          id: { in: ids },
        },
      });
    } catch (error) {
      console.error('批量获取法条失败:', error);
      throw error;
    }
  }

  /**
   * 搜索建议（自动完成）
   */
  static async getSuggestions(
    prefix: string,
    category?: string,
    limit: number = 10
  ) {
    try {
      const where: Record<string, unknown> = {
        lawName: {
          contains: prefix,
          mode: 'insensitive',
        },
      };

      if (category) {
        (where as { category: string }).category = category;
      }

      const articles = await prisma.lawArticle.findMany({
        where,
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          category: true,
        },
        take: limit,
        orderBy: {
          viewCount: 'desc',
        },
      });

      return articles.map(article => ({
        id: article.id,
        label: `${article.lawName} ${article.articleNumber}`,
        value: article.articleNumber,
        category: article.category,
      }));
    } catch (error) {
      console.error('获取搜索建议失败:', error);
      throw error;
    }
  }

  /**
   * 验证权重配置
   */
  static validateWeights(weights: RelevanceWeightConfig): boolean {
    return RelevanceScorer.validateWeights(weights);
  }

  /**
   * 归一化权重配置
   */
  static normalizeWeights(
    weights: RelevanceWeightConfig
  ): RelevanceWeightConfig {
    return RelevanceScorer.normalizeWeights(weights);
  }
}
