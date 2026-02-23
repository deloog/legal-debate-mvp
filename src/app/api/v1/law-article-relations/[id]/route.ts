/**
 * 法条关系验证和删除API
 * 提供关系的验证和删除功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/law-article-relations/[id]
 * 验证关系（通过或拒绝）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // 验证必需字段
    if (!body.verifiedBy) {
      return NextResponse.json(
        { error: '缺少必需字段: verifiedBy' },
        { status: 400 }
      );
    }

    if (typeof body.isApproved !== 'boolean') {
      return NextResponse.json(
        { error: '缺少必需字段: isApproved' },
        { status: 400 }
      );
    }

    // 验证关系
    const relation = await LawArticleRelationService.verifyRelation(
      params.id,
      body.verifiedBy,
      body.isApproved
    );

    return NextResponse.json(relation);
  } catch (error: unknown) {
    logger.error('验证关系失败:', error);

    const errorMessage = error instanceof Error ? error.message : '服务器错误';

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

/**
 * DELETE /api/v1/law-article-relations/[id]
 * 删除关系
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await LawArticleRelationService.deleteRelation(params.id);

    return NextResponse.json({
      message: '成功删除关系',
      id: params.id,
    });
  } catch (error: unknown) {
    logger.error('删除关系失败:', error);

    const errorMessage = error instanceof Error ? error.message : '服务器错误';

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}
