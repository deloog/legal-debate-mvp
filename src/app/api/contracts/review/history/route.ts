/**
 * 审查历史API
 * GET /api/contracts/review/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type {
  ReviewHistoryResponse,
  ReviewHistoryItem,
} from '@/types/contract-review';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

export async function GET(
  request: NextRequest
): Promise<NextResponse<ReviewHistoryResponse>> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '未授权，请先登录' },
      },
      { status: 401 }
    ) as NextResponse<ReviewHistoryResponse>;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    const skip = (page - 1) * pageSize;

    // 仅返回当前用户相关合同（作为律师或案件所有人）
    const userFilter = {
      OR: [
        { lawyerId: authUser.userId },
        { case: { userId: authUser.userId } },
      ],
    };

    // 查询合同列表（已审查的）
    const contracts = await prisma.contract.findMany({
      where: {
        status: {
          not: 'DRAFT',
        },
        ...userFilter,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip,
      take: pageSize,
      select: {
        id: true,
        contractNumber: true,
        filePath: true,
        updatedAt: true,
      },
    });

    // 获取总数
    const total = await prisma.contract.count({
      where: {
        status: {
          not: 'DRAFT',
        },
        ...userFilter,
      },
    });

    // 构建历史记录列表
    const items: ReviewHistoryItem[] = contracts.map(contract => ({
      id: `review-${contract.id}`,
      contractId: contract.id,
      fileName: contract.filePath?.split('/').pop() || 'unknown',
      reviewedAt: contract.updatedAt,
      overallScore: 75, // 实际项目中应该从数据库读取
      totalRisks: 3,
      criticalRisks: 0,
      status: 'COMPLETED',
    }));

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    logger.error('获取审查历史失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_HISTORY_FAILED',
          message: '获取审查历史失败',
        },
      },
      { status: 500 }
    );
  }
}
