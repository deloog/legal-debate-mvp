/**
 * 合同法条关联删除API路由
 * DELETE /api/v1/contracts/[id]/law-articles/[articleId] - 删除法条关联
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * 删除合同法条关联
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; articleId: string } }
): Promise<NextResponse> {
  try {
    const { id: contractId, articleId: lawArticleId } = params;

    // 验证合同是否存在
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: '合同不存在',
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
          error: '关联记录不存在',
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
    console.error('删除法条关联失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '删除关联失败',
      },
      { status: 500 }
    );
  }
}
