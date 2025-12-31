import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import { createSuccessResponse } from "@/app/api/lib/responses/api-response";
import { LawArticleSearchService } from "@/lib/law-article/search-service";
import type { SearchQuery } from "@/lib/law-article/types";
import { LawCategory, LawStatus } from "@prisma/client";

/**
 * POST /api/v1/law-articles/search
 * 法条检索API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

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
          code: "INVALID_PARAMS",
          message: "keywords参数必填且必须是数组",
        },
      },
      { status: 400 },
    );
  }

  const keywords: string[] = body.keywords;
  const keyword = keywords.join(" ");

  // 构建查询参数
  const query: SearchQuery = {
    keyword,
    keywords,
    category: body.category ? (body.category as LawCategory) : undefined,
    tags: body.tags,
    status: body.status ? (body.status as LawStatus) : LawStatus.VALID,
    pagination: {
      page: body.page || 1,
      pageSize: Math.min(body.limit || 20, 100),
    },
    sort: {
      field: body.sortField || "relevance",
      order: body.sortOrder || "desc",
    },
  };

  // 调用检索服务
  const response = await LawArticleSearchService.search(query);

  // 转换结果格式
  const articles = response.results.map((result) => ({
    id: result.article.id,
    lawName: result.article.lawName,
    articleNumber: result.article.articleNumber,
    fullText: result.article.fullText,
    category: result.article.category,
    lawType: result.article.lawType,
    relevanceScore: result.relevanceScore,
    matchedKeywords: result.matchedKeywords,
  }));

  return createSuccessResponse(
    {
      articles,
      total: response.pagination.total,
      relevanceScores: articles.map((a) => a.relevanceScore),
    },
    {
      pagination: {
        page: response.pagination.page,
        limit: response.pagination.pageSize,
        hasMore: response.pagination.hasNext,
      },
    },
  );
});

/**
 * OPTIONS /api/v1/law-articles/search
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
});
