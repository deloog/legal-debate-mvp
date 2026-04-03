/**
 * POST /api/v1/chat/conversations/[conversationId]/branch
 *
 * 从指定消息处创建分叉对话。
 * 将原对话从头到 fromMessageId（含）的消息复制到新对话中，
 * 然后在侧边栏以子对话形式展示。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

type Params = { params: Promise<{ conversationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { conversationId } = await params;
    const body = (await request.json()) as { fromMessageId: string };
    const { fromMessageId } = body;

    if (!fromMessageId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: '缺少 fromMessageId' },
        },
        { status: 400 }
      );
    }

    // 验证原对话归属
    const original = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: authUser.userId },
    });
    if (!original) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    // 验证 fromMessageId 属于该对话
    const pivotMessage = await prisma.message.findFirst({
      where: { id: fromMessageId, conversationId },
    });
    if (!pivotMessage) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '消息不存在' } },
        { status: 404 }
      );
    }

    // 取原对话从头到 pivot（含）的所有非删除消息
    const messagesToCopy = await prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        createdAt: { lte: pivotMessage.createdAt },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 创建新（分叉）对话
    const branchTitle = `${original.title} › 分叉`;
    const branchConv = await prisma.conversation.create({
      data: {
        userId: authUser.userId,
        title: branchTitle.slice(0, 100),
        parentConversationId: conversationId,
        branchFromMessageId: fromMessageId,
      },
    });

    // 批量复制消息
    if (messagesToCopy.length > 0) {
      await prisma.message.createMany({
        data: messagesToCopy.map(m => ({
          conversationId: branchConv.id,
          role: m.role,
          content: m.content,
          isDeleted: false,
        })),
      });
    }

    return NextResponse.json(
      { success: true, data: branchConv },
      { status: 201 }
    );
  } catch (error) {
    logger.error('创建分叉对话失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
