/**
 * GET /api/knowledge-graph/cache/stats
 * 获取知识图谱缓存统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createDefaultMiddlewareStack,
  createRequestContext,
} from '@/app/api/lib/middleware';
import { kgCacheService } from '@/lib/knowledge-graph/cache/service';
import type { CacheStats } from '@/lib/knowledge-graph/cache/types';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db';

// 创建中间件栈
const middlewareStack = createDefaultMiddlewareStack();

/**
 * GET /api/knowledge-graph/cache/stats
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '未授权，请先登录' },
      },
      { status: 401 }
    );
  }

  // 仅管理员可查看缓存统计（内部基础设施信息）
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN')) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: '权限不足' } },
      { status: 403 }
    );
  }

  // 执行中间件
  const context = createRequestContext(request);
  const middlewareResponse = await middlewareStack.execute(request, context);

  // 获取缓存统计
  const stats: CacheStats | null = await kgCacheService.getCacheStats();

  if (!stats) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CACHE_STATS_ERROR',
          message: '获取缓存统计失败',
        },
      },
      {
        status: 500,
        headers: Object.fromEntries(middlewareResponse.headers.entries()),
      }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    {
      status: 200,
      headers: Object.fromEntries(middlewareResponse.headers.entries()),
    }
  );
});
