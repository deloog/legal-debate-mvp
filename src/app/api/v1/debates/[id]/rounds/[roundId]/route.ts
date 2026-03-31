import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { RoundStatus } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
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

    const dbUserGet = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdminGet =
      dbUserGet?.role === 'ADMIN' || dbUserGet?.role === 'SUPER_ADMIN';
    if (debate.userId !== authUser.userId && !isAdminGet) {
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
 * 更新轮次状态，遵守状态机约束。
 *
 * 合法转换（非管理员）：
 *   PENDING     → IN_PROGRESS  （SSE 激活，一般不由前端直接调用）
 *   IN_PROGRESS → IN_PROGRESS  （重置软锁 + 清空论点，用于中断轮次重试）
 *   IN_PROGRESS → FAILED       （标记生成失败）
 *   FAILED      → IN_PROGRESS  （用户重试，清空论点 + 重置锁）
 *   COMPLETED 不允许任何降级
 *
 * 管理员可绕过状态机约束。
 */

/** 合法状态转换表 */
const ALLOWED_TRANSITIONS: Partial<Record<RoundStatus, RoundStatus[]>> = {
  [RoundStatus.PENDING]: [RoundStatus.IN_PROGRESS],
  [RoundStatus.IN_PROGRESS]: [RoundStatus.IN_PROGRESS, RoundStatus.FAILED],
  [RoundStatus.FAILED]: [RoundStatus.IN_PROGRESS],
  // COMPLETED 无合法转换，防止已完成的数据被覆盖
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
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

    // 验证所有权并查询当前轮次状态（合并两次查询为一次）
    const roundWithDebate = await prisma.debateRound.findUnique({
      where: { id: roundId, debateId: id },
      select: {
        status: true,
        debate: { select: { userId: true } },
      },
    });

    if (!roundWithDebate) {
      return NextResponse.json(
        { success: false, error: '轮次不存在' },
        { status: 404 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
    if (roundWithDebate.debate.userId !== authUser.userId && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '无权操作' },
        { status: 403 }
      );
    }

    // 状态机校验（管理员绕过）
    if (!isAdmin) {
      const allowedTargets =
        ALLOWED_TRANSITIONS[roundWithDebate.status as RoundStatus] ?? [];
      if (!allowedTargets.includes(status as RoundStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_TRANSITION',
              message: `不允许从 ${roundWithDebate.status} 转换到 ${status}`,
            },
          },
          { status: 409 }
        );
      }
    }

    await prisma.$transaction(async tx => {
      // 转换到 IN_PROGRESS 时：删除现有论点 + 清除生成锁
      if (status === RoundStatus.IN_PROGRESS) {
        await tx.argument.deleteMany({ where: { roundId } });
      }
      await tx.debateRound.update({
        where: { id: roundId, debateId: id },
        data: {
          status: status as RoundStatus,
          completedAt: status === RoundStatus.IN_PROGRESS ? null : undefined,
          // 重置为 IN_PROGRESS 时清除软锁，SSE 可重新声明生成权
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
