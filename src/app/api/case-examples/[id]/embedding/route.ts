import { NextRequest, NextResponse } from 'next/server';
import { CaseEmbeddingServiceFactory } from '@/lib/case/embedding-service';

/**
 * GET /api/case-examples/[id]/embedding
 * 获取案例的向量嵌入
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const embeddingService = CaseEmbeddingServiceFactory.getInstance();
    const result = await embeddingService.getEmbedding(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        embedding: result.embedding,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/case-examples/[id]/embedding
 * 为案例生成向量嵌入
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const embeddingService = CaseEmbeddingServiceFactory.getInstance();
    const result = await embeddingService.generateAndStoreEmbedding(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        embedding: result.embedding,
        dimension: result.embedding?.length || 0,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/case-examples/[id]/embedding
 * 删除案例的向量嵌入
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const embeddingService = CaseEmbeddingServiceFactory.getInstance();
    const result = await embeddingService.deleteEmbedding(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Embedding deleted successfully',
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
