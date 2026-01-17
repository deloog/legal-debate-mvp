/**
 * 使用量查询API
 * 提供用户使用量查询、统计和限制信息查询功能
 */

import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUsageStats } from '@/lib/usage/record-usage';
import type { UsageQueryRequest } from '@/types/membership';

// =============================================================================
// GET /api/memberships/usage - 查询用户使用量
// =============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // 获取认证用户
    const user = await getAuthUser(request);

    if (!user) {
      return Response.json(
        {
          error: '未认证',
          message: '请先登录',
        },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const periodStartParam = searchParams.get('periodStart');
    const periodEndParam = searchParams.get('periodEnd');

    // 解析日期参数
    let periodStart: Date | undefined;
    let periodEnd: Date | undefined;

    if (periodStartParam) {
      const parsedDate = new Date(periodStartParam);
      if (isNaN(parsedDate.getTime())) {
        return Response.json(
          {
            error: '参数错误',
            message: 'periodStart参数格式无效',
          },
          { status: 400 }
        );
      }
      periodStart = parsedDate;
    }

    if (periodEndParam) {
      const parsedDate = new Date(periodEndParam);
      if (isNaN(parsedDate.getTime())) {
        return Response.json(
          {
            error: '参数错误',
            message: 'periodEnd参数格式无效',
          },
          { status: 400 }
        );
      }
      periodEnd = parsedDate;
    }

    // 获取使用量统计（如果用户没有活跃会员，使用默认值）
    let stats;
    try {
      stats = await getUsageStats(user.userId, periodStart, periodEnd);
    } catch (error) {
      // 如果用户没有活跃会员，使用默认的使用量统计
      if (error instanceof Error && error.message.includes('没有活跃的会员')) {
        stats = {
          userId: user.userId,
          periodStart:
            periodStart ??
            new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          periodEnd:
            periodEnd ??
            new Date(
              new Date().getFullYear(),
              new Date().getMonth() + 1,
              0,
              23,
              59,
              59
            ),
          casesCreated: 0,
          debatesGenerated: 0,
          documentsAnalyzed: 0,
          lawArticleSearches: 0,
          aiTokensUsed: 0,
          storageUsedMB: 0,
          limits: {
            tier: 'FREE' as unknown as 'FREE',
            limits: {
              MAX_CASES: null,
              MAX_DEBATES: null,
              MAX_DOCUMENTS: null,
              MAX_AI_TOKENS_MONTHLY: null,
              MAX_STORAGE_MB: null,
              MAX_LAW_ARTICLE_SEARCHES: null,
              MAX_CONCURRENT_REQUESTS: null,
            },
          },
          remaining: {
            cases: Infinity,
            debates: Infinity,
            documents: Infinity,
            lawArticleSearches: Infinity,
            aiTokens: Infinity,
            storageMB: Infinity,
          },
        };
      } else {
        throw error;
      }
    }

    // 返回成功响应
    return Response.json({
      success: true,
      message: '查询成功',
      data: {
        summary: {
          periodStart: stats.periodStart,
          periodEnd: stats.periodEnd,
          casesCreated: stats.casesCreated,
          debatesGenerated: stats.debatesGenerated,
          documentsAnalyzed: stats.documentsAnalyzed,
          lawArticleSearches: stats.lawArticleSearches,
          aiTokensUsed: stats.aiTokensUsed,
          storageUsedMB: stats.storageUsedMB,
        },
        limits: stats.limits,
        remaining: stats.remaining,
      },
    });
  } catch (error) {
    console.error('[GET /api/memberships/usage] 查询失败:', error);

    if (error instanceof Error) {
      return Response.json(
        {
          error: '查询失败',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return Response.json(
      {
        error: '查询失败',
        message: '未知错误',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/memberships/usage/query - 高级查询
// =============================================================================

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // 获取认证用户
    const user = await getAuthUser(request);

    if (!user) {
      return Response.json(
        {
          error: '未认证',
          message: '请先登录',
        },
        { status: 401 }
      );
    }

    // 解析请求体
    const body: UsageQueryRequest = await request.json();

    // 验证请求参数
    if (!body || typeof body !== 'object') {
      return Response.json(
        {
          error: '参数错误',
          message: '请求体格式无效',
        },
        { status: 400 }
      );
    }

    const { periodStart, periodEnd, page, limit } = body;

    // 验证日期参数
    if (periodStart && isNaN(new Date(periodStart).getTime())) {
      return Response.json(
        {
          error: '参数错误',
          message: 'periodStart参数格式无效',
        },
        { status: 400 }
      );
    }

    if (periodEnd && isNaN(new Date(periodEnd).getTime())) {
      return Response.json(
        {
          error: '参数错误',
          message: 'periodEnd参数格式无效',
        },
        { status: 400 }
      );
    }

    // 验证分页参数
    if (page !== undefined && (typeof page !== 'number' || page < 1)) {
      return Response.json(
        {
          error: '参数错误',
          message: 'page参数必须大于0',
        },
        { status: 400 }
      );
    }

    if (
      limit !== undefined &&
      (typeof limit !== 'number' || limit < 1 || limit > 100)
    ) {
      return Response.json(
        {
          error: '参数错误',
          message: 'limit参数必须在1-100之间',
        },
        { status: 400 }
      );
    }

    // 获取使用量统计
    const stats = await getUsageStats(
      user.userId,
      periodStart ? new Date(periodStart) : undefined,
      periodEnd ? new Date(periodEnd) : undefined
    );

    // 返回成功响应
    return Response.json({
      success: true,
      message: '查询成功',
      data: {
        summary: {
          periodStart: stats.periodStart,
          periodEnd: stats.periodEnd,
          casesCreated: stats.casesCreated,
          debatesGenerated: stats.debatesGenerated,
          documentsAnalyzed: stats.documentsAnalyzed,
          lawArticleSearches: stats.lawArticleSearches,
          aiTokensUsed: stats.aiTokensUsed,
          storageUsedMB: stats.storageUsedMB,
        },
        limits: stats.limits,
        remaining: stats.remaining,
      },
    });
  } catch (error) {
    console.error('[POST /api/memberships/usage/query] 查询失败:', error);

    if (error instanceof Error) {
      return Response.json(
        {
          error: '查询失败',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return Response.json(
      {
        error: '查询失败',
        message: '未知错误',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// OPTIONS /api/memberships/usage - CORS预检
// =============================================================================

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
