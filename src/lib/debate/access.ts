import { prisma } from '@/lib/db/prisma';
import {
  checkResourceOwnership,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { canAccessSharedCase } from '@/lib/case/share-permission-validator';
import { CasePermission } from '@/types/case-collaboration';

export async function getDebateAccessContext(
  userId: string,
  debateId: string
): Promise<{
  found: boolean;
  debate?: {
    id: string;
    userId: string;
    caseId: string;
  };
}> {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    select: { id: true, userId: true, caseId: true },
  });

  if (!debate) return { found: false };
  return { found: true, debate };
}

export async function canAccessDebateByCasePermission(
  userId: string,
  debateId: string,
  permission: CasePermission
): Promise<{
  allowed: boolean;
  reason?: string;
  debate?: { id: string; userId: string; caseId: string };
}> {
  const ctx = await getDebateAccessContext(userId, debateId);
  if (!ctx.found || !ctx.debate) {
    return { allowed: false, reason: '辩论不存在' };
  }

  const ownership = await checkResourceOwnership(
    userId,
    debateId,
    ResourceType.DEBATE
  );
  if (ownership.hasPermission) {
    return { allowed: true, debate: ctx.debate };
  }

  const shared = await canAccessSharedCase(
    userId,
    ctx.debate.caseId,
    permission
  );
  return {
    allowed: shared.hasAccess,
    reason: shared.reason,
    debate: ctx.debate,
  };
}
