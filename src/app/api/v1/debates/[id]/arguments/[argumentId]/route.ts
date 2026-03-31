/**
 * PATCH /api/v1/debates/[id]/arguments/[argumentId] — 编辑论点内容
 * DELETE /api/v1/debates/[id]/arguments/[argumentId] — 删除论点
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

async function resolveAccess(
  debateId: string,
  argumentId: string,
  userId: string,
  isAdmin: boolean
): Promise<{ argument: { id: string } | null; allowed: boolean }> {
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    include: {
      round: {
        select: { debateId: true, debate: { select: { userId: true } } },
      },
    },
  });

  if (!argument) return { argument: null, allowed: false };
  if (argument.round.debateId !== debateId)
    return { argument: null, allowed: false };

  const isOwner = argument.round.debate.userId === userId;
  return { argument, allowed: isOwner || isAdmin };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; argumentId: string }> }
): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, message: '未认证' },
      { status: 401 }
    );
  }

  const { id: debateId, argumentId } = await params;

  try {
    const body = await request.json();
    const { content } = body as { content?: string };

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { success: false, message: '内容不能为空' },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
    const { argument, allowed } = await resolveAccess(
      debateId,
      argumentId,
      authUser.userId,
      isAdmin
    );

    if (!argument) {
      return NextResponse.json(
        { success: false, message: '论点不存在' },
        { status: 404 }
      );
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: '无权修改此论点' },
        { status: 403 }
      );
    }

    const updated = await prisma.argument.update({
      where: { id: argumentId },
      data: { content: content.trim() },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('更新论点失败:', error);
    return NextResponse.json(
      { success: false, message: '更新论点失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; argumentId: string }> }
): Promise<NextResponse> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, message: '未认证' },
      { status: 401 }
    );
  }

  const { id: debateId, argumentId } = await params;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
    const { argument, allowed } = await resolveAccess(
      debateId,
      argumentId,
      authUser.userId,
      isAdmin
    );

    if (!argument) {
      return NextResponse.json(
        { success: false, message: '论点不存在' },
        { status: 404 }
      );
    }
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: '无权删除此论点' },
        { status: 403 }
      );
    }

    await prisma.argument.delete({ where: { id: argumentId } });
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    logger.error('删除论点失败:', error);
    return NextResponse.json(
      { success: false, message: '删除论点失败' },
      { status: 500 }
    );
  }
}
