import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/audit/logger';
import type { NextRequest } from 'next/server';
import { ActionLogCategory, ActionLogType, Prisma } from '@prisma/client';

export interface SystemConfigSnapshot {
  key: string;
  value: unknown;
  type: string;
  category: string;
  description: string | null;
  isPublic: boolean;
  isRequired: boolean;
  defaultValue: unknown;
  validationRules: unknown;
}

export interface SystemConfigHistoryRecord {
  id: string;
  configKey: string;
  operation: 'create' | 'update' | 'delete' | 'rollback';
  reason: string;
  changedBy: string;
  changedAt: Date;
  before: SystemConfigSnapshot | null;
  after: SystemConfigSnapshot | null;
  sourceHistoryId?: string | null;
}

export function snapshotSystemConfig(
  config: {
    key: string;
    value: unknown;
    type: string;
    category: string;
    description: string | null;
    isPublic: boolean;
    isRequired: boolean;
    defaultValue: unknown;
    validationRules: unknown;
  } | null
): SystemConfigSnapshot | null {
  if (!config) {
    return null;
  }

  return {
    key: config.key,
    value: config.value,
    type: config.type,
    category: config.category,
    description: config.description,
    isPublic: config.isPublic,
    isRequired: config.isRequired,
    defaultValue: config.defaultValue,
    validationRules: config.validationRules,
  };
}

export async function recordSystemConfigHistory(params: {
  userId: string;
  configKey: string;
  operation: 'create' | 'update' | 'delete' | 'rollback';
  reason: string;
  before: SystemConfigSnapshot | null;
  after: SystemConfigSnapshot | null;
  request?: NextRequest;
  sourceHistoryId?: string | null;
}): Promise<void> {
  const requestPath = params.request
    ? 'nextUrl' in params.request &&
      params.request.nextUrl &&
      typeof params.request.nextUrl.pathname === 'string'
      ? params.request.nextUrl.pathname
      : new URL(params.request.url).pathname
    : undefined;
  const requestHeaders =
    params.request && 'headers' in params.request
      ? params.request.headers
      : null;

  await createAuditLog({
    userId: params.userId,
    actionType: ActionLogType.SYSTEM_CONFIG_UPDATE,
    actionCategory: ActionLogCategory.SYSTEM,
    description: `系统配置${params.operation}: ${params.configKey}`,
    resourceType: 'SystemConfig',
    resourceId: params.configKey,
    requestMethod: params.request?.method,
    requestPath,
    ipAddress:
      requestHeaders && 'get' in requestHeaders
        ? (requestHeaders.get('x-forwarded-for') ??
          requestHeaders.get('x-real-ip') ??
          undefined)
        : undefined,
    userAgent:
      requestHeaders && 'get' in requestHeaders
        ? (requestHeaders.get('user-agent') ?? undefined)
        : undefined,
    metadata: {
      operation: params.operation,
      reason: params.reason,
      before: params.before,
      after: params.after,
      sourceHistoryId: params.sourceHistoryId ?? null,
    },
  });
}

function mapActionLogToConfigHistory(item: {
  id: string;
  userId: string;
  resourceId: string | null;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
}): SystemConfigHistoryRecord | null {
  const metadata =
    item.metadata && typeof item.metadata === 'object'
      ? (item.metadata as Record<string, unknown>)
      : null;

  if (!metadata) {
    return null;
  }

  const operation = metadata.operation;
  const reason = metadata.reason;

  if (
    operation !== 'create' &&
    operation !== 'update' &&
    operation !== 'delete' &&
    operation !== 'rollback'
  ) {
    return null;
  }

  return {
    id: item.id,
    configKey: item.resourceId ?? '',
    operation,
    reason: typeof reason === 'string' ? reason : '',
    changedBy: item.userId,
    changedAt: item.createdAt,
    before: (metadata.before as SystemConfigSnapshot | null) ?? null,
    after: (metadata.after as SystemConfigSnapshot | null) ?? null,
    sourceHistoryId:
      typeof metadata.sourceHistoryId === 'string'
        ? metadata.sourceHistoryId
        : null,
  };
}

export async function getSystemConfigHistory(
  configKey: string,
  limit = 20
): Promise<SystemConfigHistoryRecord[]> {
  const logs = await prisma.actionLog.findMany({
    where: {
      actionType: ActionLogType.SYSTEM_CONFIG_UPDATE,
      resourceType: 'SystemConfig',
      resourceId: configKey,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });

  return logs
    .map(mapActionLogToConfigHistory)
    .filter((item): item is SystemConfigHistoryRecord => item !== null);
}

export async function rollbackSystemConfigFromHistory(params: {
  configKey: string;
  historyId: string;
  userId: string;
  reason: string;
  request?: NextRequest;
}) {
  const historyLog = await prisma.actionLog.findFirst({
    where: {
      id: params.historyId,
      actionType: ActionLogType.SYSTEM_CONFIG_UPDATE,
      resourceType: 'SystemConfig',
      resourceId: params.configKey,
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  const metadata =
    historyLog?.metadata && typeof historyLog.metadata === 'object'
      ? (historyLog.metadata as Record<string, unknown>)
      : null;

  const rollbackTarget =
    (metadata?.before as SystemConfigSnapshot | null | undefined) ?? null;

  const currentConfig = await prisma.systemConfig.findUnique({
    where: { key: params.configKey },
  });

  const currentSnapshot = snapshotSystemConfig(currentConfig);

  if (!historyLog || !metadata) {
    throw new Error('配置历史记录不存在');
  }

  let resultConfig: SystemConfigSnapshot | null;

  if (!rollbackTarget) {
    if (currentConfig?.isRequired) {
      throw new Error('必填配置不能通过回滚删除');
    }

    if (currentConfig) {
      await prisma.systemConfig.delete({
        where: { key: params.configKey },
      });
    }

    resultConfig = null;
  } else {
    const saved = await prisma.systemConfig.upsert({
      where: { key: rollbackTarget.key },
      update: {
        value: rollbackTarget.value as Prisma.InputJsonValue,
        type: rollbackTarget.type as never,
        category: rollbackTarget.category,
        description: rollbackTarget.description,
        isPublic: rollbackTarget.isPublic,
        isRequired: rollbackTarget.isRequired,
        defaultValue: rollbackTarget.defaultValue as
          | Prisma.InputJsonValue
          | Prisma.NullableJsonNullValueInput,
        validationRules: rollbackTarget.validationRules as
          | Prisma.InputJsonValue
          | Prisma.NullableJsonNullValueInput,
      },
      create: {
        key: rollbackTarget.key,
        value: rollbackTarget.value as Prisma.InputJsonValue,
        type: rollbackTarget.type as never,
        category: rollbackTarget.category,
        description: rollbackTarget.description,
        isPublic: rollbackTarget.isPublic,
        isRequired: rollbackTarget.isRequired,
        defaultValue: rollbackTarget.defaultValue as
          | Prisma.InputJsonValue
          | Prisma.NullableJsonNullValueInput,
        validationRules: rollbackTarget.validationRules as
          | Prisma.InputJsonValue
          | Prisma.NullableJsonNullValueInput,
      },
    });

    resultConfig = snapshotSystemConfig(saved);
  }

  await recordSystemConfigHistory({
    userId: params.userId,
    configKey: params.configKey,
    operation: 'rollback',
    reason: params.reason,
    before: currentSnapshot,
    after: resultConfig,
    request: params.request,
    sourceHistoryId: params.historyId,
  });

  return resultConfig;
}
