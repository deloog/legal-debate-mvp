import { CasePermission, CaseRole } from '@/types/case-collaboration';
import {
  canAccessSharedCase,
  normalizeCasePermissions,
} from '@/lib/case/share-permission-validator';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

export function parseScheduleDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildScheduleOverlapWhere(
  caseId: string,
  startTime: Date,
  endTime: Date,
  excludeScheduleId?: string
): Prisma.CourtScheduleWhereInput {
  return {
    caseId,
    ...(excludeScheduleId && { id: { not: excludeScheduleId } }),
    status: { notIn: ['CANCELLED'] },
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  };
}

export async function buildScheduleAccessWhere(
  userId: string,
  permission: CasePermission
): Promise<Prisma.CourtScheduleWhereInput> {
  const memberships = await prisma.caseTeamMember.findMany({
    where: {
      userId,
      deletedAt: null,
      case: {
        deletedAt: null,
      },
    },
    select: {
      caseId: true,
      role: true,
      permissions: true,
    },
  });

  const accessibleCaseIds = memberships
    .filter(member =>
      normalizeCasePermissions(
        member.permissions,
        member.role as CaseRole
      ).includes(permission)
    )
    .map(member => member.caseId);

  return {
    OR: [
      {
        case: {
          userId,
          deletedAt: null,
        },
      },
      ...(accessibleCaseIds.length > 0
        ? [{ caseId: { in: accessibleCaseIds } }]
        : []),
    ],
  };
}

export async function checkCaseSchedulePermission(
  userId: string,
  caseId: string,
  permission: CasePermission
): Promise<
  { hasAccess: true } | { hasAccess: false; status: 403 | 404; message: string }
> {
  const access = await canAccessSharedCase(userId, caseId, permission);

  if (access.hasAccess) {
    return { hasAccess: true };
  }

  if (access.reason === '案件不存在' || access.reason === '无权访问此案件') {
    return {
      hasAccess: false,
      status: 404,
      message: '案件不存在或无权访问',
    };
  }

  return {
    hasAccess: false,
    status: 403,
    message: access.reason || '无权操作该案件日程',
  };
}
