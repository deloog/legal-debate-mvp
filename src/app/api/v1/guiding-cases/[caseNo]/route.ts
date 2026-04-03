/**
 * 最高法指导案例详情 API
 *
 * GET /api/v1/guiding-cases/[caseNo]
 *
 * 功能：获取指定指导案例的完整内容（裁判要旨、基本事实、裁判结果、裁判理由）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { caseNo: string } | Promise<{ caseNo: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { caseNo: caseNoStr } = await params;
    const caseNo = parseInt(caseNoStr, 10);
    if (isNaN(caseNo)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: '无效的案例编号' },
        },
        { status: 400 }
      );
    }

    const guidingCase = await prisma.guidingCase.findUnique({
      where: { caseNo },
      include: {
        lawArticles: {
          select: { id: true, lawName: true, articleNumber: true },
        },
      },
    });

    if (!guidingCase) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: '指导案例不存在' },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: guidingCase });
  } catch (error) {
    logger.error('获取指导案例详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
