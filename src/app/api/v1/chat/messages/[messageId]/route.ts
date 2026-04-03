/**
 * DELETE /api/v1/chat/messages/[messageId]
 *
 * 删除消息。
 * body.withSubsequent = true  → 软删除该条及之后所有消息
 * body.withSubsequent = false → 仅软删除该条消息
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

type Params = { params: Promise<{ messageId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { messageId } = await params;

    // 找到消息，并验证归属（通过 conversation.userId）
    const message = await prisma.message.findFirst({
      where: { id: messageId },
      include: {
        conversation: { select: { userId: true, id: true } },
      },
    });

    if (!message || message.conversation.userId !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '消息不存在' } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as { withSubsequent?: boolean };
    const withSubsequent = body.withSubsequent !== false; // 默认 true

    if (withSubsequent) {
      // 软删除该条及之后所有消息
      await prisma.message.updateMany({
        where: {
          conversationId: message.conversation.id,
          createdAt: { gte: message.createdAt },
          isDeleted: false,
        },
        data: { isDeleted: true },
      });
    } else {
      await prisma.message.update({
        where: { id: messageId },
        data: { isDeleted: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('删除消息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
