import { NextRequest, NextResponse } from 'next/server';
import { SimilarCaseServiceFactory } from '@/lib/case/similar-case-service';
import type { SuccessRateAnalysisParams } from '@/types/case-example';
import { logger } from '@/lib/agent/security/logger';

/**
 * GET /api/cases/[id]/success-rate
 * 分析案件胜败率
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const caseId = params.id;

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const minSimilarityStr = searchParams.get('minSimilarity');
    const maxCasesStr = searchParams.get('maxCases');
    const includePartialStr = searchParams.get('includePartial');
    const includeWithdrawStr = searchParams.get('includeWithdraw');

    // 解析参数
    const minSimilarity = minSimilarityStr ? parseFloat(minSimilarityStr) : 0.6;
    const maxCases = maxCasesStr ? parseInt(maxCasesStr, 10) : 20;
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
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to analyze success rate', new Error(errorMessage), {
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
