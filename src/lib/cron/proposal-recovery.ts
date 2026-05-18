import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 分钟

export async function recoverStuckProposals(): Promise<number> {
  const cutoff = new Date(Date.now() - TIMEOUT_MS);

  const result = await prisma.agentProposal.updateMany({
    where: {
      status: 'EXECUTING',
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'FAILED',
      revertReason: 'EXECUTING_TIMEOUT: 进程可能已崩溃，请重试',
    },
  });

  if (result.count > 0) {
    logger.warn(`proposal-recovery: 恢复了 ${result.count} 个卡死的提案`);
  }

  return result.count;
}
