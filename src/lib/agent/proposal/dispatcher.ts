import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { createCase, addTimelineEvent } from '@/lib/case/service';
import { createClient } from '@/lib/client/service';
import { reminderService } from '@/lib/notification/reminder-service';
import { ClientType } from '@/types/client';
import type { ReminderType } from '@/types/notification';
import type { ProposalActionStatus } from '@/types/proposal';
import type { Prisma } from '@prisma/client';

const VALID_REMINDER_TYPES = new Set<ReminderType>([
  'DEADLINE',
  'CASE_DEADLINE',
  'TASK_DUE',
  'HEARING_DATE',
  'PAYMENT_DUE',
  'FOLLOW_UP',
  'CUSTOM',
  'COURT_SCHEDULE',
  'CONTRACT_MILESTONE',
]);

function toReminderType(raw: unknown): ReminderType {
  if (
    typeof raw === 'string' &&
    VALID_REMINDER_TYPES.has(raw as ReminderType)
  ) {
    return raw as ReminderType;
  }
  return 'CUSTOM';
}

// AI 输出的 KeyDate.type 与 Prisma CaseTimelineEventType 不完全重叠，做安全映射
const VALID_TIMELINE_TYPES = new Set([
  'FILING',
  'PRETRIAL',
  'TRIAL',
  'JUDGMENT',
  'APPEAL',
  'EXECUTION',
  'CLOSED',
  'CUSTOM',
]);

function toTimelineEventType(raw: unknown): string {
  if (typeof raw === 'string' && VALID_TIMELINE_TYPES.has(raw)) return raw;
  return 'CUSTOM';
}

interface DispatchContext {
  userId: string;
  completedActions: Map<string, { resourceType: string; resourceId: string }>;
}

// 将前序 action 的 result（clientId 等）注入后续 action 的 params
function injectDependencyResults(
  params: Record<string, unknown>,
  dependsOnId: string | null,
  completedActions: Map<string, { resourceType: string; resourceId: string }>
): Record<string, unknown> {
  if (!dependsOnId) return params;
  const dep = completedActions.get(dependsOnId);
  if (!dep) return params;

  const resolved = { ...params };
  if (dep.resourceType === 'Client' && !resolved.clientId) {
    resolved.clientId = dep.resourceId;
  }
  if (dep.resourceType === 'Case' && !resolved.caseId) {
    resolved.caseId = dep.resourceId;
  }
  return resolved;
}

async function executeAction(
  actionId: string,
  actionType: string,
  params: Record<string, unknown>,
  idempotencyKey: string,
  ctx: DispatchContext
): Promise<{ resourceType: string; resourceId: string }> {
  switch (actionType) {
    case 'CREATE_CLIENT': {
      const client = await createClient(
        {
          userId: ctx.userId,
          name: String(params.name ?? ''),
          clientType: ClientType.INDIVIDUAL,
        },
        idempotencyKey
      );
      return { resourceType: 'Client', resourceId: client.id };
    }

    case 'CREATE_CASE': {
      const clientId = params.clientId as string | undefined;
      const caseRecord = await createCase(
        {
          userId: ctx.userId,
          title: String(params.title ?? '新案件'),
          description: String(params.description ?? ''),
          type: String(params.type ?? 'other'),
          plaintiffName: params.plaintiffName
            ? String(params.plaintiffName)
            : undefined,
          defendantName: params.defendantName
            ? String(params.defendantName)
            : undefined,
          cause: params.cause ? String(params.cause) : undefined,
          amount:
            params.amount !== undefined ? Number(params.amount) : undefined,
          metadata: clientId ? { clientId } : undefined,
        },
        idempotencyKey
      );
      // 若有 clientId，单独更新（CreateCaseServiceInput 未暴露该字段）
      if (clientId) {
        await prisma.case.update({
          where: { id: caseRecord.id },
          data: { clientId },
        });
      }
      return { resourceType: 'Case', resourceId: caseRecord.id };
    }

    case 'ADD_TIMELINE_EVENT': {
      const events = params.events as Array<{
        date: string;
        description: string;
        type: string;
      }>;
      if (!Array.isArray(events) || events.length === 0) {
        return { resourceType: 'TimelineEvent', resourceId: '' };
      }
      const caseId = String(params.caseId ?? '');
      if (!caseId) throw new Error('ADD_TIMELINE_EVENT: caseId 未注入');

      // 创建第一个事件，返回其 id；其余并发创建
      const [first, ...rest] = events;
      const firstEvent = await addTimelineEvent(
        {
          caseId,
          eventType: toTimelineEventType(first.type),
          title: first.description,
          eventDate: new Date(first.date),
        },
        `${idempotencyKey}-0`
      );

      await Promise.all(
        rest.map((ev, i) =>
          addTimelineEvent(
            {
              caseId,
              eventType: toTimelineEventType(ev.type),
              title: ev.description,
              eventDate: new Date(ev.date),
            },
            `${idempotencyKey}-${i + 1}`
          )
        )
      );

      return { resourceType: 'TimelineEvent', resourceId: firstEvent.id };
    }

    case 'CREATE_REMINDER': {
      const reminder = await reminderService.createReminder(
        {
          userId: ctx.userId,
          type: toReminderType(params.type),
          title: String(params.title ?? '提醒'),
          scheduledAt: params.reminderTime
            ? new Date(String(params.reminderTime))
            : new Date(),
          reminderTime: params.reminderTime
            ? new Date(String(params.reminderTime))
            : new Date(),
          relatedType: params.relatedType as string | undefined,
          relatedId: params.relatedId as string | undefined,
        },
        idempotencyKey
      );
      return { resourceType: 'Reminder', resourceId: reminder.id };
    }

    default:
      throw new Error(`未知 actionType: ${actionType}`);
  }
}

async function updateActionStatus(
  actionId: string,
  status: ProposalActionStatus,
  extra: Partial<{
    resourceType: string;
    resourceId: string;
    result: Prisma.InputJsonValue;
    error: string;
    executedAt: Date;
    retryCount: number;
  }>
) {
  await prisma.proposalAction.update({
    where: { id: actionId },
    data: { status, ...extra },
  });
}

export async function runDispatcher(proposalId: string): Promise<void> {
  const proposal = await prisma.agentProposal.findUnique({
    where: { id: proposalId },
    include: {
      actions: { orderBy: { sequence: 'asc' } },
    },
  });

  if (!proposal) {
    logger.error(`Dispatcher: proposal ${proposalId} 不存在`);
    return;
  }

  const ctx: DispatchContext = {
    userId: proposal.userId,
    completedActions: new Map(),
  };

  let hasFailure = false;

  for (const action of proposal.actions) {
    if (action.status === 'SKIPPED' || !action.selected) continue;
    if (action.status === 'COMPLETED') {
      if (action.resourceType && action.resourceId) {
        ctx.completedActions.set(action.id, {
          resourceType: action.resourceType,
          resourceId: action.resourceId,
        });
      }
      continue;
    }

    // 检查依赖是否完成（用运行时 completedActions，避免初始快照失效）
    if (action.dependsOnId && !ctx.completedActions.has(action.dependsOnId)) {
      await updateActionStatus(action.id, 'FAILED', {
        error: `依赖 action ${action.dependsOnId} 未完成`,
      });
      hasFailure = true;
      continue;
    }

    await updateActionStatus(action.id, 'EXECUTING', {});

    const resolvedParams = injectDependencyResults(
      action.params as Record<string, unknown>,
      action.dependsOnId,
      ctx.completedActions
    );

    try {
      const result = await executeAction(
        action.id,
        action.actionType,
        resolvedParams,
        action.idempotencyKey,
        ctx
      );

      await updateActionStatus(action.id, 'COMPLETED', {
        resourceType: result.resourceType,
        resourceId: result.resourceId,
        result: result as Prisma.InputJsonValue,
        executedAt: new Date(),
      });

      ctx.completedActions.set(action.id, result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(
        `Dispatcher: action ${action.id} (${action.actionType}) 失败`,
        {
          error: errorMsg,
          proposalId,
        }
      );

      await updateActionStatus(action.id, 'FAILED', {
        error: errorMsg,
        retryCount: action.retryCount + 1,
      });

      hasFailure = true;
    }
  }

  // 统计最终状态
  const finalActions = await prisma.proposalAction.findMany({
    where: { proposalId },
    select: { status: true, selected: true },
  });

  const selected = finalActions.filter(
    a => a.selected && a.status !== 'SKIPPED'
  );
  const completed = selected.filter(a => a.status === 'COMPLETED');

  let finalStatus: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
  if (!hasFailure) {
    finalStatus = 'COMPLETED';
  } else if (completed.length > 0) {
    finalStatus = 'PARTIALLY_COMPLETED';
  } else {
    finalStatus = 'FAILED';
  }

  await prisma.agentProposal.update({
    where: { id: proposalId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
    },
  });
}
