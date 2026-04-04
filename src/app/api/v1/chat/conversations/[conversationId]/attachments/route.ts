/**
 * GET /api/v1/chat/conversations/[conversationId]/attachments
 * 返回该对话所有上传文件列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

type Params = { params: Promise<{ conversationId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { conversationId } = await params;

    // 验证归属
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: authUser.userId },
      select: { id: true },
    });
    if (!conv) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    const attachments = await prisma.messageAttachment.findMany({
      where: {
        message: { conversationId, isDeleted: false },
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        fileUrl: true,
        createdAt: true,
        message: { select: { createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    logger.error('获取附件列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
