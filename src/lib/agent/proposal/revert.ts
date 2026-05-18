import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

// 每种 actionType 的补偿操作
async function compensate(action: {
  actionType: string;
  resourceType: string | null;
  resourceId: string | null;
  idempotencyKey: string;
  params: unknown;
}): Promise<void> {
  const { actionType, resourceId, idempotencyKey, params } = action;

  switch (actionType) {
    case 'CREATE_CASE':
      if (!resourceId) return;
      await prisma.case.update({
        where: { id: resourceId },
        data: { deletedAt: new Date() },
      });
      break;

    case 'CREATE_CLIENT': {
      if (!resourceId) return;
      const caseCount = await prisma.case.count({
        where: { clientId: resourceId, deletedAt: null },
      });
      if (caseCount === 0) {
        await prisma.client.update({
          where: { id: resourceId },
          data: { deletedAt: new Date() },
        });
      } else {
        throw new Error(
          `客户 ${resourceId} 已有 ${caseCount} 个关联案件，无法自动撤销`
        );
      }
      break;
    }

    case 'ADD_TIMELINE_EVENT': {
      // dispatcher 按 `${idempotencyKey}-{i}` 创建多条事件，全部删除
      const events =
        ((params as Record<string, unknown>)?.events as unknown[]) ?? [];
      const eventCount = Math.max(events.length, 1);
      const keys = Array.from(
        { length: eventCount },
        (_, i) => `${idempotencyKey}-${i}`
      );
      for (const key of keys) {
        await prisma.caseTimeline.deleteMany({
          where: { metadata: { path: ['idempotencyKey'], equals: key } },
        });
      }
      break;
    }

    case 'CREATE_REMINDER':
      if (!resourceId) return;
      await prisma.reminder.deleteMany({ where: { id: resourceId } });
      break;

    default:
      // NOT_APPLICABLE 类型跳过，不报错
      break;
  }
}

export async function revertProposal(
  proposalId: string,
  reason: string
): Promise<{ reverted: number; skipped: number; failed: number }> {
  const actions = await prisma.proposalAction.findMany({
    where: { proposalId, status: 'COMPLETED' },
    orderBy: { sequence: 'desc' }, // 反向顺序执行补偿
  });

  let reverted = 0;
  let skipped = 0;
  let failed = 0;

  for (const action of actions) {
    if (action.revertStatus === 'NOT_APPLICABLE') {
      skipped++;
      continue;
    }

    try {
      await compensate(action);

      await prisma.proposalAction.update({
        where: { id: action.id },
        data: { revertStatus: 'COMPLETED', revertedAt: new Date() },
      });

      reverted++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(
        `revert: action ${action.id} (${action.actionType}) 撤销失败`,
        {
          error: errorMsg,
          proposalId,
        }
      );

      await prisma.proposalAction.update({
        where: { id: action.id },
        data: { revertStatus: 'FAILED', revertError: errorMsg },
      });

      failed++;
    }
  }

  await prisma.agentProposal.update({
    where: { id: proposalId },
    data: { status: 'REVERTED', revertedAt: new Date(), revertReason: reason },
  });

  return { reverted, skipped, failed };
}
