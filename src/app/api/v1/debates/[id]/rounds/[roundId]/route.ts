import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { RoundStatus } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const { id, roundId } = await params;

    if (!id || !roundId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const debate = await prisma.debate.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!debate) {
      return NextResponse.json(
        { success: false, error: '辩论不存在' },
        { status: 404 }
      );
    }

    const isAdmin = (session.user as { role?: string }).role === 'ADMIN';
    if (debate.userId !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '无权访问' },
        { status: 403 }
      );
    }

    const round = await prisma.debateRound.findUnique({
      where: { id: roundId, debateId: id },
      include: { arguments: true },
    });

    if (!round) {
      return NextResponse.json(
        { success: false, error: '辩论轮次不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: round.id,
        debateId: round.debateId,
        roundNumber: round.roundNumber,
        status: round.status,
        startedAt: round.startedAt,
        completedAt: round.completedAt,
        createdAt: round.createdAt,
        updatedAt: round.updatedAt,
        arguments: round.arguments.map(arg => ({
          id: arg.id,
          side: arg.side,
          content: arg.content,
          type: arg.type,
        })),
      },
    });
  } catch (error) {
    logger.error('获取辩论轮次失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/debates/[id]/rounds/[roundId]
 * 重置轮次状态（用于重新生成论点）
 * 重置为 IN_PROGRESS 时同时删除该轮现有论点
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const { id, roundId } = await params;
    const body = await request.json().catch(() => ({}));
    const { status } = body as { status?: string };

    if (
      !status ||
      !Object.values(RoundStatus).includes(status as RoundStatus)
    ) {
      return NextResponse.json(
        { success: false, error: '无效的状态值' },
        { status: 400 }
      );
    }

    // 验证所有权
    const debate = await prisma.debate.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!debate) {
      return NextResponse.json(
        { success: false, error: '辩论不存在' },
        { status: 404 }
      );
    }

    const isAdmin = (session.user as { role?: string }).role === 'ADMIN';
    if (debate.userId !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '无权操作' },
        { status: 403 }
      );
    }

    await prisma.$transaction(async tx => {
      if (status === RoundStatus.IN_PROGRESS) {
        await tx.argument.deleteMany({ where: { roundId } });
      }
      await tx.debateRound.update({
        where: { id: roundId, debateId: id },
        data: {
          status: status as RoundStatus,
          completedAt: status === RoundStatus.IN_PROGRESS ? null : undefined,
          // 重置为 IN_PROGRESS 时清除生成锁，允许新的 /generate 请求声明它
          startedAt: status === RoundStatus.IN_PROGRESS ? null : undefined,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('更新辩论轮次状态失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
