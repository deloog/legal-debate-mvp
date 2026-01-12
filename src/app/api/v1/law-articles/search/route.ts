import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { LawArticleSearchService } from '@/lib/law-article/search-service';
import type { SearchQuery } from '@/lib/law-article/types';
import { LawCategory, LawStatus } from '@prisma/client';
import { cache } from '@/lib/cache/manager';
import { measurePerformance } from '@/lib/middleware/performance-monitor';

/**
 * 有效的法条分类枚举值
 */
const VALID_CATEGORIES: LawCategory[] = [
  'CIVIL',
  'CRIMINAL',
  'ADMINISTRATIVE',
  'COMMERCIAL',
  'ECONOMIC',
  'LABOR',
  'INTELLECTUAL_PROPERTY',
  'PROCEDURE',
  'OTHER',
];

/**
 * 缓存响应数据类型
 */
interface CachedResponseData {
  articles: Array<{
    id: string;
    lawName: string;
    articleNumber: string;
    fullText: string;
    category: LawCategory;
    lawType: string;
    relevanceScore: number;
    matchedKeywords: string[];
  }>;
  total: number;
  relevanceScores: number[];
}

/**
 * 缓存元数据类型
 */
interface CachedResponseMeta {
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

/**
 * 缓存响应类型
 */
interface CachedResponse {
  data: CachedResponseData;
  meta: CachedResponseMeta;
}

/**
 * POST /api/v1/law-articles/search
 * 法条检索API - 优化版本
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const startTime = Date.now();
  const body = await request.json();

  // 生成缓存键
  const cacheKey = `law-articles:${JSON.stringify(body)}`;

  // 参数验证
  if (
    !body.keywords ||
    !Array.isArray(body.keywords) ||
    body.keywords.length === 0
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'keywords参数必填且必须是数组',
        },
      },
      { status: 400 }
    );
  }

  // 验证category参数（如果提供）
  if (body.category && !VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: `无效的法条分类: ${body.category}。有效值为: ${VALID_CATEGORIES.join(', ')}`,
        },
      },
      { status: 400 }
    );
  }

  const keywords: string[] = body.keywords || [];

  console.log('法条搜索请求参数:', {
    keywords,
    category: body.category,
    tags: body.tags,
    page: body.page,
    limit: body.limit,
  });

  // 构建查询参数
  // 注意：keywords作为全文搜索关键词数组，不作为标签筛选
  const query: SearchQuery = {
    keyword: keywords.join(' '), // 用空格连接关键词进行全文搜索
    category: body.category ? (body.category as LawCategory) : undefined,
    tags: body.tags,
    status: body.status ? (body.status as LawStatus) : LawStatus.VALID,
    pagination: {
      page: body.page || 1,
      pageSize: Math.min(body.limit || 20, 100),
    },
    sort: {
      field: body.sortField || 'relevance',
      order: body.sortOrder || 'desc',
    },
  };

  // 尝试从缓存获取结果
  const cachedResponse = await cache.get<CachedResponse>(cacheKey, {
    ttl: 900, // 15分钟缓存
  });

  if (cachedResponse) {
    // 验证缓存数据格式完整性
    const isValid = cachedResponse.data.articles.every(
      (article: { relevanceScore?: unknown }) =>
        typeof article.relevanceScore === 'number' &&
        article.relevanceScore >= 0 &&
        article.relevanceScore <= 1
    );

    if (!isValid) {
      console.warn('缓存数据格式不匹配，重新查询');
    } else {
      const response = createSuccessResponse(
        cachedResponse.data,
        cachedResponse.meta
      );
      response.headers.set('X-Cache', 'HIT');
      await measurePerformance(request, response, startTime, { enabled: true });
      return response;
    }
  }

  // 调用检索服务
  const response = await LawArticleSearchService.search(query);

  // 转换结果格式
  const articles = response.results.map(result => ({
    id: result.article.id,
    lawName: result.article.lawName,
    articleNumber: result.article.articleNumber,
    fullText: result.article.fullText,
    category: result.article.category,
    lawType: result.article.lawType,
    relevanceScore:
      typeof result.relevanceScore === 'number'
        ? Math.max(0, Math.min(1, result.relevanceScore))
        : 0,
    matchedKeywords: result.matchedKeywords || [],
  }));

  const responseData = {
    articles,
    total: response.pagination.total,
    relevanceScores: articles.map(a => a.relevanceScore),
  };

  const responseMeta = {
    pagination: {
      page: response.pagination.page,
      limit: response.pagination.pageSize,
      hasMore: response.pagination.hasNext,
    },
  };

  // 缓存结果（仅缓存第一页，避免缓存过多数据）
  if (query.pagination.page === 1) {
    await cache.set(
      cacheKey,
      {
        data: responseData,
        meta: responseMeta,
      },
      {
        ttl: 900,
      }
    );
  }

  const apiResponse = createSuccessResponse(responseData, responseMeta);
  apiResponse.headers.set('X-Cache', 'MISS');
  await measurePerformance(request, apiResponse, startTime, { enabled: true });
  return apiResponse;
});

/**
 * OPTIONS /api/v1/law-articles/search
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
