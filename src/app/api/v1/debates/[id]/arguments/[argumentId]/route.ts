/**
 * PATCH /api/v1/debates/[id]/arguments/[argumentId]  — 编辑论点内容
 * DELETE /api/v1/debates/[id]/arguments/[argumentId] — 删除论点
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

async function resolveAccess(
  debateId: string,
  argumentId: string,
  userId: string,
  role?: string
) {
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

  const isAdmin = role === 'ADMIN';
  const isOwner = argument.round.debate.userId === userId;
  return { argument, allowed: isOwner || isAdmin };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; argumentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json(
      { success: false, message: '未认证' },
      { status: 401 }
    );
  }

  const { id: debateId, argumentId } = params;

  try {
    const body = await request.json();
    const { content } = body as { content?: string };

    if (!content || typeof content !== 'string' || !content.trim()) {
      return Response.json(
        { success: false, message: '内容不能为空' },
        { status: 400 }
      );
    }

    const role = (session.user as { role?: string }).role;
    const { argument, allowed } = await resolveAccess(
      debateId,
      argumentId,
      session.user.id,
      role
    );

    if (!argument) {
      return Response.json(
        { success: false, message: '论点不存在' },
        { status: 404 }
      );
    }
    if (!allowed) {
      return Response.json(
        { success: false, message: '无权修改此论点' },
        { status: 403 }
      );
    }

    const updated = await prisma.argument.update({
      where: { id: argumentId },
      data: { content: content.trim() },
    });

    return Response.json(updated);
  } catch (error) {
    logger.error('更新论点失败:', error);
    return Response.json(
      { success: false, message: '更新论点失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; argumentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json(
      { success: false, message: '未认证' },
      { status: 401 }
    );
  }

  const { id: debateId, argumentId } = params;

  try {
    const role = (session.user as { role?: string }).role;
    const { argument, allowed } = await resolveAccess(
      debateId,
      argumentId,
      session.user.id,
      role
    );

    if (!argument) {
      return Response.json(
        { success: false, message: '论点不存在' },
        { status: 404 }
      );
    }
    if (!allowed) {
      return Response.json(
        { success: false, message: '无权删除此论点' },
        { status: 403 }
      );
    }

    await prisma.argument.delete({ where: { id: argumentId } });
    return Response.json({ success: true, message: '删除成功' });
  } catch (error) {
    logger.error('删除论点失败:', error);
    return Response.json(
      { success: false, message: '删除论点失败' },
      { status: 500 }
    );
  }
}
