import { NextRequest, NextResponse } from 'next/server';
import { SimilarCaseServiceFactory } from '@/lib/case/similar-case-service';
import type { SimilaritySearchParams } from '@/types/case-example';
import type { CaseType, CaseResult } from '@prisma/client';
import { logger } from '@/lib/agent/security/logger';

/**
 * GET /api/cases/[id]/similar
 * 检索相似案例
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const caseId = params.id;

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const topK = parseInt(searchParams.get('topK') || '10', 10);
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');
    const caseType = searchParams.get('caseType');
    const result = searchParams.get('result');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // 构建检索参数
    const searchParamsTyped: SimilaritySearchParams = {
      caseId,
      topK,
      threshold,
      ...(caseType && { caseType: caseType as CaseType }),
      ...(result && { result: result as CaseResult }),
      ...(startDateStr && { startDate: new Date(startDateStr) }),
      ...(endDateStr && { endDate: new Date(endDateStr) }),
    };

    // 执行检索
    const service = SimilarCaseServiceFactory.getInstance();
    const searchResult = await service.searchSimilarCases(searchParamsTyped);

    return NextResponse.json({
      success: true,
      data: searchResult,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to search similar cases', new Error(errorMessage), {
      caseId: params.id,
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
