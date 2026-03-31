/**
 * 论点编辑 API
 *
 * PATCH /api/v1/arguments/[id]
 * 允许律师手动修改 AI 生成的论点内容、推理过程和优先级标记
 */

import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

const VALID_PRIORITIES = ['primary', 'secondary', null] as const;
type ArgumentPriority = 'primary' | 'secondary' | null;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未认证' }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }

    const body = (await request.json()) as {
      content?: string;
      reasoning?: string;
      priority?: ArgumentPriority;
    };

    const { content, reasoning, priority } = body;

    if (!content && reasoning === undefined && priority === undefined) {
      return NextResponse.json(
        { error: '没有需要更新的内容' },
        { status: 400 }
      );
    }

    if (
      content !== undefined &&
      (typeof content !== 'string' || content.trim().length === 0)
    ) {
      return NextResponse.json({ error: '论点内容不能为空' }, { status: 400 });
    }

    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: '优先级参数无效' }, { status: 400 });
    }

    // 验证论点是否存在，并通过 round → debate 验证所有权
    const existing = await prisma.argument.findUnique({
      where: { id },
      include: {
        round: {
          select: {
            debate: { select: { userId: true } },
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: '论点不存在' }, { status: 404 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
    if (existing.round.debate.userId !== authUser.userId && !isAdmin) {
      return NextResponse.json({ error: '无权修改此论点' }, { status: 403 });
    }

    // 更新
    const updated = await prisma.argument.update({
      where: { id },
      data: {
        ...(content !== undefined ? { content: content.trim() } : {}),
        ...(reasoning !== undefined
          ? { reasoning: reasoning.trim() || null }
          : {}),
        ...(priority !== undefined ? { priority: priority ?? null } : {}),
      },
      select: {
        id: true,
        content: true,
        reasoning: true,
        priority: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    logger.error('论点更新失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
