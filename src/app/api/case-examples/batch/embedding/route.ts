import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { CaseEmbeddingServiceFactory } from '@/lib/case/embedding-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/case-examples/batch/embedding
 * 批量生成案例向量嵌入
 */
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

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
    logger.error('批量生成嵌入失败:', error);
    return NextResponse.json({ error: '批量生成嵌入失败' }, { status: 500 });
  }
}
