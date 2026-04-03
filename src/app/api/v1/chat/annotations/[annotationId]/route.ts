/**
 * DELETE /api/v1/chat/annotations/[annotationId]  — 删除标注
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

type Params = { params: Promise<{ annotationId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { annotationId } = await params;

    const annotation = await prisma.annotation.findFirst({
      where: { id: annotationId, userId: authUser.userId },
    });

    if (!annotation) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '标注不存在' } },
        { status: 404 }
      );
    }

    await prisma.annotation.delete({ where: { id: annotationId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('删除标注失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
