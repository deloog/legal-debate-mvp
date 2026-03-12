/**
 * 合同法条关联删除API路由
 * DELETE /api/v1/contracts/[id]/law-articles/[articleId] - 删除法条关联
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  resolveContractUserId,
  unauthorizedResponse,
} from '@/app/api/lib/middleware/contract-auth';

/**
 * 删除合同法条关联
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; articleId: string }> }
): Promise<NextResponse> {
  // ─── 认证 ─────────────────────────────────────────────────────────────────
  const userId = resolveContractUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const { id: contractId, articleId: lawArticleId } = await params;

    // 验证合同是否存在
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CONTRACT_NOT_FOUND', message: '合同不存在' },
        },
        { status: 404 }
      );
    }

    // 查找关联记录
    const association = await prisma.contractLawArticle.findUnique({
      where: {
        contractId_lawArticleId: {
          contractId,
          lawArticleId,
        },
      },
    });

    if (!association) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'ASSOCIATION_NOT_FOUND', message: '关联记录不存在' },
        },
        { status: 404 }
      );
    }

    // 删除关联
    await prisma.contractLawArticle.delete({
      where: {
        contractId_lawArticleId: {
          contractId,
          lawArticleId,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: '关联已删除',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('删除法条关联失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '删除关联失败' },
      },
      { status: 500 }
    );
  }
}
