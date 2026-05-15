import { NextRequest, NextResponse } from 'next/server';
import { SimilarCaseServiceFactory } from '@/lib/case/similar-case-service';
import type { CaseResult, CaseType } from '@prisma/client';
import { logger } from '@/lib/agent/security/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/cases/[id]/similar
 * 检索相似案例
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const caseId = (await params).id;

    // 验证用户是否有权访问该案件（所有者或管理员）
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
        type: true,
        cause: true,
        court: true,
      },
    });
    if (!caseRecord) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '案件不存在' } },
        { status: 404 }
      );
    }
    const dbUser = prisma.user?.findUnique
      ? await prisma.user.findUnique({
          where: { id: authUser.userId },
          select: { role: true },
        })
      : null;
    const isAdmin =
      dbUser?.role === 'ADMIN' ||
      dbUser?.role === 'SUPER_ADMIN' ||
      authUser.role === 'ADMIN' ||
      authUser.role === 'SUPER_ADMIN';
    if (caseRecord.userId !== authUser.userId && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '无权访问此案件' },
        },
        { status: 403 }
      );
    }

    // 获取查询参数（带范围校验，防止 DoS）
    const { searchParams } = new URL(request.url);
    const topKRaw = parseInt(searchParams.get('topK') || '10', 10);
    const topK = isNaN(topKRaw) || topKRaw < 1 || topKRaw > 50 ? 10 : topKRaw;
    const thresholdRaw = parseFloat(searchParams.get('threshold') || '0.7');
    const threshold =
      isNaN(thresholdRaw) || thresholdRaw < 0 || thresholdRaw > 1
        ? 0.7
        : thresholdRaw;
    const caseType = searchParams.get('caseType');
    const result = searchParams.get('result');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const service = SimilarCaseServiceFactory.getInstance();
    const searchResult = await service.searchSimilarCases({
      caseId,
      topK,
      threshold,
      ...(caseType ? { caseType: caseType as CaseType } : {}),
      ...(result ? { result: result as CaseResult } : {}),
      ...(startDateStr ? { startDate: new Date(startDateStr) } : {}),
      ...(endDateStr ? { endDate: new Date(endDateStr) } : {}),
    });

    return NextResponse.json({
      success: true,
      data: searchResult,
    });
  } catch (_error) {
    const errorMessage =
      _error instanceof Error ? _error.message : 'Unknown error';
    logger.error('Failed to search similar cases', new Error(errorMessage), {
      caseId: (await params).id,
    });

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '检索失败，请稍后重试' },
      },
      { status: 500 }
    );
  }
}
