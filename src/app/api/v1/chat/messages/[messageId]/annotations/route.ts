/**
 * POST /api/v1/chat/messages/[messageId]/annotations  — 创建标注
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

type Params = { params: Promise<{ messageId: string }> };

const VALID_TYPES = new Set([
  'CONFIRM',
  'QUESTION',
  'REJECT',
  'IMPORTANT',
  'USE_IN_DOC',
]);

export async function POST(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { messageId } = await params;

    // 验证消息归属
    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: { conversation: { select: { userId: true } } },
    });

    if (!message || message.conversation.userId !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '消息不存在' } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      selectedText: string;
      startOffset: number;
      endOffset: number;
      type: string;
      note?: string;
    };

    if (!body.selectedText?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: '标注内容不能为空' },
        },
        { status: 400 }
      );
    }
    if (!VALID_TYPES.has(body.type)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: '无效的标注类型' },
        },
        { status: 400 }
      );
    }

    const annotation = await prisma.annotation.create({
      data: {
        messageId,
        userId: authUser.userId,
        selectedText: body.selectedText.slice(0, 2000),
        startOffset: body.startOffset ?? 0,
        endOffset: body.endOffset ?? 0,
        type: body.type,
        note: body.note ? body.note.slice(0, 500) : null,
      },
    });

    return NextResponse.json(
      { success: true, data: annotation },
      { status: 201 }
    );
  } catch (error) {
    logger.error('创建标注失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
