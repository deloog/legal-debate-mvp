import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { WITNESS_STATUS_LABELS, WitnessStatistics } from '@/types/witness';
import type { WitnessStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/witnesses/statistics - 获取证人统计信息
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
  const caseId = searchParams.get('caseId');

  // 构建基础查询条件
  const whereClause = caseId
    ? {
        case: {
          userId: authUser.userId,
          id: caseId,
        },
      }
    : {
        case: {
          userId: authUser.userId,
        },
      };

  // 获取所有证人数量和状态分布
  const [totalWitnesses, witnessesByStatusRaw, testimonies] = await Promise.all(
    [
      prisma.witness.count({
        where: whereClause,
      }),
      prisma.witness.groupBy({
        by: ['status'],
        where: whereClause,
        _count: {
          id: true,
        },
      }),
      prisma.witness.findMany({
        where: whereClause,
        select: {
          testimony: true,
          status: true,
        },
      }),
    ]
  );

  // 计算各状态数量
  const witnessesByStatus: Record<WitnessStatus, number> = {
    NEED_CONTACT: 0,
    CONTACTED: 0,
    CONFIRMED: 0,
    DECLINED: 0,
    CANCELLED: 0,
  };

  witnessesByStatusRaw.forEach(item => {
    witnessesByStatus[item.status as WitnessStatus] = item._count.id;
  });

  // 计算已确认和待处理的证人数量
  const confirmedWitnesses = witnessesByStatus.CONFIRMED;
  const pendingWitnesses =
    witnessesByStatus.NEED_CONTACT + witnessesByStatus.CONTACTED;

  // 计算平均证词长度
  const testimonyLengths = testimonies
    .filter(t => t.testimony && t.testimony.length > 0)
    .map(t => t.testimony!.length);

  const averageTestimonyLength =
    testimonyLengths.length > 0
      ? Math.round(
          testimonyLengths.reduce((sum, len) => sum + len, 0) /
            testimonyLengths.length
        )
      : 0;

  const statistics: WitnessStatistics = {
    totalWitnesses,
    witnessesByStatus,
    confirmedWitnesses,
    pendingWitnesses,
    averageTestimonyLength,
  };

  return createSuccessResponse(statistics, {
    labels: WITNESS_STATUS_LABELS,
  });
});

/**
 * OPTIONS /api/witnesses/statistics - CORS预检请求
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
