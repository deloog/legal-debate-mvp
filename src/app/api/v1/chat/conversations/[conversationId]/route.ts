/**
 * GET    /api/v1/chat/conversations/[conversationId]  — 获取对话详情（含案情晶体）
 * PATCH  /api/v1/chat/conversations/[conversationId]  — 重命名 / 归档
 * DELETE /api/v1/chat/conversations/[conversationId]  — 删除对话
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

type Params = { params: Promise<{ conversationId: string }> };

async function getOwnConversation(userId: string, conversationId: string) {
  return prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });
}

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
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: authUser.userId },
      select: {
        id: true,
        title: true,
        caseContext: true,
        caseId: true,
        updatedAt: true,
        case: { select: { id: true, title: true } },
      },
    });
    if (!conv) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: conv });
  } catch (error) {
    logger.error('获取对话详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { conversationId } = await params;
    const conv = await getOwnConversation(authUser.userId, conversationId);
    if (!conv) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      title?: string;
      isArchived?: boolean;
      caseId?: string | null;
    };
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...(body.title !== undefined && { title: body.title.slice(0, 100) }),
        ...(body.isArchived !== undefined && { isArchived: body.isArchived }),
        ...(body.caseId !== undefined && { caseId: body.caseId }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error('更新对话失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { conversationId } = await params;
    const conv = await getOwnConversation(authUser.userId, conversationId);
    if (!conv) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '对话不存在' } },
        { status: 404 }
      );
    }

    await prisma.conversation.delete({ where: { id: conversationId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('删除对话失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
