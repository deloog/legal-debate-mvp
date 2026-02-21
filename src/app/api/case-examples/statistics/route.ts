import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/case-examples/statistics
 * 获取案例统计信息
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const [total, byType, byResult, byCourt, byCause] = await Promise.all([
    prisma.caseExample.count(),
    prisma.caseExample.groupBy({
      by: ['type'],
      _count: true,
    }),
    prisma.caseExample.groupBy({
      by: ['result'],
      _count: true,
    }),
    prisma.caseExample.groupBy({
      by: ['court'],
      _count: true,
    }),
    prisma.caseExample.groupBy({
      by: ['cause'],
      _count: true,
    }),
  ]);

  // 转换为Record类型
  const typeStats: Record<string, number> = {};
  for (const item of byType) {
    typeStats[item.type] = item._count;
  }

  const resultStats: Record<string, number> = {};
  for (const item of byResult) {
    resultStats[item.result] = item._count;
  }

  const courtStats: Record<string, number> = {};
  for (const item of byCourt) {
    courtStats[item.court] = item._count;
  }

  const causeStats: Record<string, number> = {};
  for (const item of byCause) {
    if (item.cause) {
      causeStats[item.cause] = item._count;
    }
  }

  // 计算胜诉率
  const winCount = resultStats.WIN ?? 0;
  const loseCount = resultStats.LOSE ?? 0;
  const totalResultCount = winCount + loseCount;
  const winRate =
    totalResultCount > 0 ? (winCount / totalResultCount) * 100 : 0;

  return createSuccessResponse({
    total,
    byType: typeStats,
    byResult: resultStats,
    byCourt: courtStats,
    byCause: causeStats,
    winRate: Number(winRate.toFixed(2)),
  });
});

/**
 * OPTIONS /api/case-examples/statistics
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
