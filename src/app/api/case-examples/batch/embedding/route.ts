import { NextRequest, NextResponse } from 'next/server';
import { CaseEmbeddingServiceFactory } from '@/lib/case/embedding-service';

/**
 * POST /api/case-examples/batch/embedding
 * 批量生成案例向量嵌入
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      caseIds: string[];
    };

    if (!body.caseIds || !Array.isArray(body.caseIds)) {
      return NextResponse.json(
        { error: 'Invalid request: caseIds array required' },
        { status: 400 }
      );
    }

    if (body.caseIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: caseIds cannot be empty' },
        { status: 400 }
      );
    }

    if (body.caseIds.length > 50) {
      return NextResponse.json(
        { error: 'Invalid request: maximum 50 caseIds allowed' },
        { status: 400 }
      );
    }

    const embeddingService = CaseEmbeddingServiceFactory.getInstance();
    const result = await embeddingService.batchGenerateAndStore(body.caseIds);

    return NextResponse.json({
      success: true,
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      results: result.results,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
