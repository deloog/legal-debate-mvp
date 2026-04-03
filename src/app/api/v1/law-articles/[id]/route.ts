/**
 * 法条详情API
 *
 * GET /api/v1/law-articles/[id]
 *
 * 功能：获取指定法条的详细信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 获取法条详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const article = await prisma.lawArticle.findUnique({
      where: { id },
      include: {
        guidingCases: {
          select: {
            caseNo: true,
            title: true,
            batch: true,
            holdingPoints: true,
          },
          orderBy: { caseNo: 'asc' },
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '法条不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: article });
  } catch (error) {
    logger.error('获取法条详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
