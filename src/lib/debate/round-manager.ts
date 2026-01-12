import { prisma } from '@/lib/db/prisma';
import { RoundStatus, DebateStatus } from '@prisma/client';

/**
 * 轮次状态转换规则
 */
const VALID_TRANSITIONS: Record<RoundStatus, RoundStatus[]> = {
  [RoundStatus.PENDING]: [RoundStatus.IN_PROGRESS, RoundStatus.FAILED],
  [RoundStatus.IN_PROGRESS]: [RoundStatus.COMPLETED, RoundStatus.FAILED],
  [RoundStatus.COMPLETED]: [], // 已完成的轮次不能转换
  [RoundStatus.FAILED]: [RoundStatus.PENDING], // 失败的轮次可以重试
};

/**
 * 验证状态转换是否合法
 */
export function isValidTransition(from: RoundStatus, to: RoundStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

/**
 * 转换轮次状态
 */
export async function transitionRoundStatus(
  roundId: string,
  newStatus: RoundStatus,
  options?: {
    userId?: string;
    reason?: string;
  }
) {
  // 获取当前轮次状态
  const currentRound = await prisma.debateRound.findUnique({
    where: { id: roundId },
    include: {
      debate: true,
    },
  });

  if (!currentRound) {
    throw new Error(`轮次 ${roundId} 不存在`);
  }

  // 验证状态转换
  if (!isValidTransition(currentRound.status, newStatus)) {
    throw new Error(`无法从状态 ${currentRound.status} 转换到 ${newStatus}`);
  }

  // 更新轮次状态
  const updateData: any = {
    status: newStatus,
    updatedAt: new Date(),
  };

  // 根据状态设置相应的时间戳
  switch (newStatus) {
    case RoundStatus.IN_PROGRESS:
      updateData.startedAt = new Date();
      break;
    case RoundStatus.COMPLETED:
      updateData.completedAt = new Date();
      break;
    case RoundStatus.FAILED:
      updateData.completedAt = new Date(); // 使用completedAt记录失败时间
      break;
  }

  // 更新轮次
  const updatedRound = await prisma.debateRound.update({
    where: { id: roundId },
    data: updateData,
  });

  // 如果轮次完成，检查是否需要更新辩论状态
  if (newStatus === RoundStatus.COMPLETED) {
    await updateDebateProgress(currentRound.debateId);
  }

  // 记录状态变更日志
  await logRoundStatusChange(roundId, currentRound.status, newStatus, options);

  return updatedRound;
}

/**
 * 更新辩论进度
 */
async function updateDebateProgress(debateId: string) {
  // 获取辩论的所有轮次
  const rounds = await prisma.debateRound.findMany({
    where: { debateId },
    orderBy: { roundNumber: 'desc' },
  });

  const totalRounds = rounds.length;
  const completedRounds = rounds.filter(
    r => r.status === RoundStatus.COMPLETED
  ).length;
  const inProgressRounds = rounds.filter(
    r => r.status === RoundStatus.IN_PROGRESS
  ).length;

  // 计算当前轮次
  const currentRound = Math.max(...rounds.map(r => r.roundNumber), 0);

  // 确定辩论状态
  let debateStatus: DebateStatus;
  if (completedRounds >= totalRounds) {
    debateStatus = DebateStatus.COMPLETED;
  } else if (inProgressRounds > 0) {
    debateStatus = DebateStatus.IN_PROGRESS;
  } else {
    debateStatus = DebateStatus.DRAFT;
  }

  // 更新辩论状态
  await prisma.debate.update({
    where: { id: debateId },
    data: {
      status: debateStatus,
      currentRound,
      updatedAt: new Date(),
    },
  });
}

/**
 * 记录轮次状态变更日志
 */
async function logRoundStatusChange(
  roundId: string,
  fromStatus: RoundStatus,
  toStatus: RoundStatus,
  options?: {
    userId?: string;
    reason?: string;
  }
) {
  try {
    // 使用AIInteraction表记录状态变更（临时方案）
    await prisma.aIInteraction.create({
      data: {
        type: 'ROUND_STATUS_CHANGE',
        provider: 'SYSTEM',
        request: {
          roundId,
          from: fromStatus,
          to: toStatus,
          reason: options?.reason,
          userId: options?.userId,
        },
        success: true,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    // 日志记录失败不影响主要流程
    console.warn('Failed to log round status change:', error);
  }
}

/**
 * 开始新轮次
 */
export async function startNewRound(
  debateId: string,
  roundNumber: number,
  options?: {
    userId?: string;
  }
) {
  // 验证辩论是否存在且可以进行新轮次
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    include: {
      rounds: {
        orderBy: { roundNumber: 'desc' },
        take: 1,
      },
    },
  });

  if (!debate) {
    throw new Error(`辩论 ${debateId} 不存在`);
  }

  const maxRounds = (debate.debateConfig as any)?.maxRounds || 3;
  if (roundNumber > maxRounds) {
    throw new Error(`轮次 ${roundNumber} 超过最大限制 ${maxRounds}`);
  }

  // 如果有前一轮次，确保已完成
  if (debate.rounds.length > 0) {
    const lastRound = debate.rounds[0];
    if (lastRound.status !== RoundStatus.COMPLETED) {
      throw new Error('前一轮次尚未完成');
    }
  }

  // 创建新轮次
  const newRound = await prisma.debateRound.create({
    data: {
      debateId,
      roundNumber,
      status: RoundStatus.PENDING,
      createdAt: new Date(),
    },
  });

  // 更新辩论状态
  await prisma.debate.update({
    where: { id: debateId },
    data: {
      currentRound: roundNumber,
      status: DebateStatus.IN_PROGRESS,
      updatedAt: new Date(),
    },
  });

  // 记录创建日志
  await logRoundStatusChange(
    newRound.id,
    RoundStatus.PENDING,
    RoundStatus.PENDING,
    {
      userId: options?.userId,
      reason: `创建第${roundNumber}轮`,
    }
  );

  return newRound;
}

/**
 * 开始轮次
 */
export async function startRound(
  roundId: string,
  reason?: string,
  userId?: string
) {
  return transitionRoundStatus(roundId, RoundStatus.IN_PROGRESS, {
    userId,
    reason,
  });
}

/**
 * 完成轮次
 */
export async function completeRound(
  roundId: string,
  reason?: string,
  userId?: string
) {
  return transitionRoundStatus(roundId, RoundStatus.COMPLETED, {
    userId,
    reason,
  });
}

/**
 * 标记轮次失败
 */
export async function failRound(
  roundId: string,
  reason: string,
  userId?: string
) {
  return transitionRoundStatus(roundId, RoundStatus.FAILED, { userId, reason });
}

/**
 * 重试失败的轮次
 */
export async function retryRound(
  roundId: string,
  reason?: string,
  userId?: string
) {
  return transitionRoundStatus(roundId, RoundStatus.PENDING, {
    userId,
    reason,
  });
}

/**
 * 获取轮次状态统计
 */
export async function getRoundStatusStats(debateId: string) {
  const rounds = await prisma.debateRound.groupBy({
    by: ['status'],
    where: { debateId },
    _count: {
      status: true,
    },
  });

  return rounds.reduce(
    (acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    },
    {} as Record<string, number>
  );
}
