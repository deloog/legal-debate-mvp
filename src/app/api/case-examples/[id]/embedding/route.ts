import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { CaseEmbeddingServiceFactory } from '@/lib/case/embedding-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/case-examples/[id]/embedding
 * 获取案例的向量嵌入
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { id } = await params;

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
    logger.error('获取案例嵌入失败:', error);
    return NextResponse.json({ error: '获取嵌入失败' }, { status: 500 });
  }
}

/**
 * POST /api/case-examples/[id]/embedding
 * 为案例生成向量嵌入
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { id } = await params;

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
    logger.error('生成案例嵌入失败:', error);
    return NextResponse.json({ error: '生成嵌入失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/case-examples/[id]/embedding
 * 删除案例的向量嵌入
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { id } = await params;

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
    logger.error('删除案例嵌入失败:', error);
    return NextResponse.json({ error: '删除嵌入失败' }, { status: 500 });
  }
}
