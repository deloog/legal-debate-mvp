import { NextRequest, NextResponse } from 'next/server';
import { SimilarCaseServiceFactory } from '@/lib/case/similar-case-service';
import type { SuccessRateAnalysisParams } from '@/types/case-example';
import { logger } from '@/lib/agent/security/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/cases/[id]/success-rate
 * 分析案件胜败率
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
      select: { userId: true },
    });
    if (!caseRecord) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '案件不存在' } },
        { status: 404 }
      );
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
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
    const minSimilarityRaw = searchParams.get('minSimilarity');
    const maxCasesRaw = searchParams.get('maxCases');
    const includePartialStr = searchParams.get('includePartial');
    const includeWithdrawStr = searchParams.get('includeWithdraw');

    const minSimilarityParsed = minSimilarityRaw
      ? parseFloat(minSimilarityRaw)
      : 0.6;
    const minSimilarity =
      isNaN(minSimilarityParsed) ||
      minSimilarityParsed < 0 ||
      minSimilarityParsed > 1
        ? 0.6
        : minSimilarityParsed;

    const maxCasesParsed = maxCasesRaw ? parseInt(maxCasesRaw, 10) : 20;
    const maxCases =
      isNaN(maxCasesParsed) || maxCasesParsed < 1 || maxCasesParsed > 200
        ? 20
        : maxCasesParsed;

    const includePartial = includePartialStr === 'true';
    const includeWithdraw = includeWithdrawStr === 'true';

    // 构建分析参数
    const analysisParams: SuccessRateAnalysisParams = {
      caseId,
      minSimilarity,
      maxCases,
      includePartial,
      includeWithdraw,
    };

    // 执行分析
    const service = SimilarCaseServiceFactory.getInstance();
    const analysisResult = await service.analyzeSuccessRate(analysisParams);

    return NextResponse.json({
      success: true,
      data: analysisResult,
    });
  } catch (_error) {
    const errorMessage = 'Unknown error';
    logger.error('Failed to analyze success rate', new Error(errorMessage), {
      caseId: (await params).id,
    });

    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '分析失败，请稍后重试' },
      },
      { status: 500 }
    );
  }
}
