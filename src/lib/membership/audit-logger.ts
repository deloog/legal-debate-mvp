/**
 * 会员与权限模块审计日志
 * 记录关键操作以便安全审计
 */

import { logger } from '@/lib/logger';

export interface AuditLogParams {
  action: string;
  resourceType: 'membership' | 'role' | 'permission' | 'export';
  resourceId?: string;
  userId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 记录审计日志
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    // 记录到应用日志
    logger.info(`[Audit] ${params.action}`, {
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      userId: params.userId,
      details: params.details,
    });

    // 如果数据库有审计日志表，可以持久化存储
    // await prisma.auditLog.create({...});
  } catch (error) {
    // 审计日志失败不应影响主业务流程
    logger.error('[Audit] 记录审计日志失败:', error);
  }
}

/**
 * 记录会员变更审计日志
 */
export async function logMembershipChange(
  membershipId: string,
  userId: string,
  action:
    | 'create'
    | 'update'
    | 'delete'
    | 'suspend'
    | 'resume'
    | 'upgrade'
    | 'downgrade',
  changes: Record<string, { from: unknown; to: unknown }>,
  performedBy: string
): Promise<void> {
  await logAuditEvent({
    action: `membership:${action}`,
    resourceType: 'membership',
    resourceId: membershipId,
    userId: performedBy,
    details: {
      targetUserId: userId,
      changes,
    },
  });
}

/**
 * 记录角色变更审计日志
 */
export async function logRoleChange(
  roleId: string,
  action:
    | 'create'
    | 'update'
    | 'delete'
    | 'assign_permission'
    | 'revoke_permission',
  changes: Record<string, unknown>,
  performedBy: string
): Promise<void> {
  await logAuditEvent({
    action: `role:${action}`,
    resourceType: 'role',
    resourceId: roleId,
    userId: performedBy,
    details: changes,
  });
}

/**
 * 记录导出操作审计日志
 */
export async function logExportOperation(
  exportType: string,
  filters: Record<string, unknown>,
  recordCount: number,
  performedBy: string
): Promise<void> {
  await logAuditEvent({
    action: 'export:data',
    resourceType: 'export',
    userId: performedBy,
    details: {
      exportType,
      filters,
      recordCount,
    },
  });
}
