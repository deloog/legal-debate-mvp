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
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { kgCacheService } from '@/lib/knowledge-graph/cache/service';

// 创建中间件栈
const middlewareStack = createDefaultMiddlewareStack();

/**
 * POST /api/knowledge-graph/cache/clear
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // 验证身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: '未登录' },
      { status: 401 }
    );
  }

  // 从 DB 实时读取角色，仅管理员可清缓存
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { role: true },
  });
  if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { success: false, error: '权限不足，仅管理员可清理缓存' },
      { status: 403 }
    );
  }

  // 执行中间件（日志、限流等），并检查是否被拦截（如限流 429）
  const context = createRequestContext(request);
  const middlewareResponse = await middlewareStack.execute(request, context);
  if (middlewareResponse.status >= 400) {
    return middlewareResponse;
  }

  // 解析请求体
  const body = await request.json().catch(() => ({}));
  const { cacheType } = body as { cacheType?: string };

  // cacheType 白名单校验，防止非法值传入缓存服务
  const validCacheTypes = ['node', 'edge', 'community', 'expert', 'query'];
  if (cacheType && !validCacheTypes.includes(cacheType)) {
    return NextResponse.json(
      {
        success: false,
        error: `不支持的缓存类型: ${cacheType}，可选: ${validCacheTypes.join(', ')}, 或不传表示清理全部`,
      },
      { status: 400 }
    );
  }

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
