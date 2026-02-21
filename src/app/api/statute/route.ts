/**
 * 时效计算API路由
 *
 * GET /api/statute - 获取时效计算列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { statuteCalculationService } from '@/lib/calculation/statute-calculation-service';
import { getAuthUser } from '@/lib/middleware/auth';
import type { StatuteCalculationQueryParams } from '@/types/statute';

/**
 * GET /api/statute
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const params: StatuteCalculationQueryParams = {
    caseId: searchParams.get('caseId') || undefined,
    statuteType: (searchParams.get('statuteType') as never) || undefined,
    caseType: (searchParams.get('caseType') as never) || undefined,
    startDate: searchParams.get('startDate')
      ? new Date(searchParams.get('startDate') as string)
      : undefined,
    endDate: searchParams.get('endDate')
      ? new Date(searchParams.get('endDate') as string)
      : undefined,
    isExpired: searchParams.get('isExpired')
      ? searchParams.get('isExpired') === 'true'
      : undefined,
    isApproaching: searchParams.get('isApproaching')
      ? searchParams.get('isApproaching') === 'true'
      : undefined,
    page: searchParams.get('page')
      ? parseInt(searchParams.get('page') as string)
      : 1,
    limit: searchParams.get('limit')
      ? parseInt(searchParams.get('limit') as string)
      : 20,
    sortBy: (searchParams.get('sortBy') as never) || undefined,
    sortOrder: (searchParams.get('sortOrder') as never) || undefined,
  };

  const result = await statuteCalculationService.getCalculationList(
    authUser.userId,
    params
  );

  return createSuccessResponse(result.calculations, {
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit),
      hasNext: result.page * result.limit < result.total,
      hasPrevious: result.page > 1,
    },
    statistics: result.statistics,
  });
});

/**
 * OPTIONS /api/statute
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
