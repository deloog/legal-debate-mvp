/**
 * POST /api/knowledge-graph/cache/clear
 * 清理知识图谱缓存
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createDefaultMiddlewareStack,
  createRequestContext,
} from '@/app/api/lib/middleware';
import { kgCacheService } from '@/lib/knowledge-graph/cache/service';

// 创建中间件栈
const middlewareStack = createDefaultMiddlewareStack();

/**
 * POST /api/knowledge-graph/cache/clear
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // 执行中间件
  const context = createRequestContext(request);
  const middlewareResponse = await middlewareStack.execute(request, context);

  // 解析请求体
  const body = await request.json().catch(() => ({}));
  const { cacheType } = body as { cacheType?: string };

  // 清理缓存：当 cacheType 为空字符串时传递 undefined
  const finalCacheType =
    cacheType && cacheType.length > 0 ? cacheType : undefined;
  const count = await kgCacheService.clearCache(finalCacheType);

  return NextResponse.json(
    {
      success: true,
      data: {
        clearedCount: count,
        cacheType: finalCacheType || 'all',
      },
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
