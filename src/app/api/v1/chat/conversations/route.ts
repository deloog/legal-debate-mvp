/**
 * GET  /api/v1/chat/conversations  — 获取当前用户的对话列表（含分支层级）
 * POST /api/v1/chat/conversations  — 新建对话
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    // 只取顶层对话（无父对话），再递归查分支
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: authUser.userId,
        isArchived: false,
        parentConversationId: null,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
        branches: {
          where: { isArchived: false },
          orderBy: { createdAt: 'asc' },
          include: {
            _count: { select: { messages: true } },
            branches: {
              where: { isArchived: false },
              orderBy: { createdAt: 'asc' },
              include: {
                _count: { select: { messages: true } },
                branches: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: conversations });
  } catch (error) {
    logger.error('获取对话列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as { title?: string };
    const conversation = await prisma.conversation.create({
      data: {
        userId: authUser.userId,
        title: (body.title ?? '新对话').slice(0, 100),
      },
    });

    return NextResponse.json(
      { success: true, data: conversation },
      { status: 201 }
    );
  } catch (error) {
    logger.error('新建对话失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
