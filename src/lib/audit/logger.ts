/**
 * 操作审计日志系统
 * 记录系统重要操作，用于安全追踪和问题排查
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { ActionLogCategory, ActionLogType, Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 审计日志数据接口
 */
export interface AuditLogData {
  userId: string;
  actionType: ActionLogType;
  actionCategory: ActionLogCategory;
  description: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  requestParams?: Record<string, unknown>;
  responseStatus?: number;
  executionTime?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 创建操作审计日志
 *
 * @param data - 审计日志数据
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.actionLog.create({
      data: {
        userId: data.userId,
        actionType: data.actionType,
        actionCategory: data.actionCategory,
        description: data.description,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestMethod: data.requestMethod,
        requestPath: data.requestPath,
        requestParams: data.requestParams as Prisma.InputJsonValue,
        responseStatus: data.responseStatus,
        executionTime: data.executionTime,
        metadata: data.metadata as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    logger.error('创建审计日志失败:', error);
    // 不抛出错误，避免影响主流程
  }
}

// =============================================================================
// 便捷操作记录函数
// =============================================================================

/**
 * 记录创建操作
 */
export async function logCreateAction(params: {
  userId: string;
  category: ActionLogCategory;
  resourceType: string;
  resourceId: string;
  description: string;
  request?: NextRequest;
  responseStatus?: number;
  executionTime?: number;
}): Promise<void> {
  const { request, ...rest } = params;
  const context = extractRequestContext(request);
  const actionType = `CREATE_${params.category}` as ActionLogType;

  await createAuditLog({
    ...rest,
    actionType,
    actionCategory: params.category,
    ...context,
  });
}

/**
 * 记录更新操作
 */
export async function logUpdateAction(params: {
  userId: string;
  category: ActionLogCategory;
  resourceType: string;
  resourceId: string;
  description: string;
  changes?: Record<string, unknown>;
  request?: NextRequest;
  responseStatus?: number;
  executionTime?: number;
}): Promise<void> {
  const { request, changes, ...rest } = params;
  const context = extractRequestContext(request);
  const actionType = `UPDATE_${params.category}` as ActionLogType;

  await createAuditLog({
    ...rest,
    actionType,
    actionCategory: params.category,
    metadata: { changes, ...context.metadata },
    ...context,
  });
}

/**
 * 记录删除操作
 */
export async function logDeleteAction(params: {
  userId: string;
  category: ActionLogCategory;
  resourceType: string;
  resourceId: string;
  description: string;
  request?: NextRequest;
  responseStatus?: number;
  executionTime?: number;
}): Promise<void> {
  const { request, ...rest } = params;
  const context = extractRequestContext(request);
  const actionType = `DELETE_${params.category}` as ActionLogType;

  await createAuditLog({
    ...rest,
    actionType,
    actionCategory: params.category,
    ...context,
  });
}

/**
 * 记录查看操作
 */
export async function logViewAction(params: {
  userId: string;
  category: ActionLogCategory;
  resourceType: string;
  resourceId: string;
  description: string;
  request?: NextRequest;
}): Promise<void> {
  const { request, ...rest } = params;
  const context = extractRequestContext(request);
  const actionType = `VIEW_${params.category}` as ActionLogType;

  await createAuditLog({
    ...rest,
    actionType,
    actionCategory: params.category,
    ...context,
  });
}

/**
 * 记录AI相关操作
 */
export async function logAIAction(params: {
  userId: string;
  actionType: 'ANALYZE_DOCUMENT' | 'GENERATE_ARGUMENT' | 'GENERATE_DEBATE';
  resourceId?: string;
  description: string;
  request?: NextRequest;
  responseStatus?: number;
  executionTime?: number;
}): Promise<void> {
  const { request, ...rest } = params;
  const context = extractRequestContext(request);

  await createAuditLog({
    ...rest,
    userId: params.userId,
    actionCategory: 'DEBATE',
    resourceType: 'DEBATE',
    actionType: params.actionType as ActionLogType,
    ...context,
  });
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 从请求中提取上下文信息
 */
function extractRequestContext(request?: NextRequest): {
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  metadata?: Record<string, unknown>;
} {
  if (!request) {
    return {};
  }

  const ipAddress = extractIpAddress(request);
  const userAgent = request.headers.get('user-agent') || undefined;
  const requestMethod = request.method;
  const requestPath = request.nextUrl.pathname;

  return {
    ipAddress,
    userAgent,
    requestMethod,
    requestPath,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 提取客户端IP地址
 */
function extractIpAddress(request: NextRequest): string | undefined {
  // 尝试从多个header获取IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  if (forwarded) {
    // x-forwarded-for可能包含多个IP，取第一个
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return undefined;
}

/**
 * 创建操作计时器
 * 返回一个函数，调用时记录执行时间
 */
export function createActionTimer(): (
  callback: (duration: number) => Promise<void>
) => Promise<void> {
  const startTime = Date.now();

  return async (callback: (duration: number) => Promise<void>) => {
    const duration = Date.now() - startTime;
    await callback(duration);
  };
}
