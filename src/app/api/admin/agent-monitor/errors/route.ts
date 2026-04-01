/**
 * Agent Monitor Errors API
 * 提供 Agent 错误统计和分析
 *
 * @permission agent_monitor:read - 查看 Agent 监控
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { ActionStatus } from '@prisma/client';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { AGENT_MONITOR_PERMISSIONS } from '@/types/permission';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// =============================================================================
// 常量定义
// =============================================================================

/** 最大返回错误记录数 */
const MAX_ERROR_LIMIT = 100;

/** 最大分析记录数 */
const MAX_ANALYSIS_LIMIT = 1000;

/** 默认返回错误记录数 */
const DEFAULT_ERROR_LIMIT = 20;

/** 速率限制配置 - 每 IP 每分钟最大请求数 */
const RATE_LIMIT_MAX = 30;

/** 速率限制窗口 - 1分钟 */
const RATE_LIMIT_WINDOW = 60 * 1000;

/** 错误消息最大长度 */
const MAX_ERROR_MESSAGE_LENGTH = 200;

// =============================================================================
// 类型定义
// =============================================================================

interface ErrorCategory {
  category: string;
  count: number;
  percentage: number;
}

interface AgentError {
  agentName: string;
  errorCount: number;
  percentage: number;
}

interface RecentError {
  id: string;
  agentName: string;
  actionName: string;
  errorMessage: string;
  createdAt: string;
}

interface ErrorResponse {
  errorDistribution: ErrorCategory[];
  agentErrors: AgentError[];
  recentErrors: RecentError[];
}

// =============================================================================
// 错误类型关键词映射
// =============================================================================

const ERROR_PATTERNS: Record<string, string[]> = {
  TIMEOUT: [
    'timeout',
    'timed out',
    'connection refused',
    'ETIMEDOUT',
    'ECONNREFUSED',
  ],
  DATABASE: ['database', 'connection lost', 'query failed', 'prisma', 'sql'],
  AI_MODEL: [
    'ai',
    'model',
    'rate limit',
    'token',
    'openai',
    'claude',
    'api key',
  ],
  VALIDATION: ['validation', 'invalid', 'required', 'schema', 'parse'],
  NETWORK: ['network', 'fetch', 'axios', 'http', 'status'],
  UNKNOWN: [],
};

// =============================================================================
// 输入验证 Schema
// =============================================================================

const QuerySchema = z.object({
  agent: z.string().min(1).max(100).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_ERROR_LIMIT)
    .default(DEFAULT_ERROR_LIMIT),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

// =============================================================================
// 速率限制存储
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * 检查速率限制
 * @param identifier 标识符 (IP地址)
 * @returns 是否允许请求
 */
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 分类错误消息
 * @param errorMessage 错误消息
 * @returns 错误分类
 */
function categorizeError(errorMessage: string): string {
  const lowerMessage = errorMessage.toLowerCase();

  for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
    if (category === 'UNKNOWN') continue;
    for (const pattern of patterns) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        return category;
      }
    }
  }

  return 'UNKNOWN';
}

/**
 * 截断错误消息
 * @param message 错误消息
 * @returns 截断后的消息
 */
function truncateErrorMessage(message: string): string {
  if (message.length <= MAX_ERROR_MESSAGE_LENGTH) return message;
  return message.substring(0, MAX_ERROR_MESSAGE_LENGTH) + '...';
}

// =============================================================================
// API 处理器
// =============================================================================

/**
 * GET /api/admin/agent-monitor/errors
 * 获取错误类型分布和统计
 *
 * @requires agent_monitor:read
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // -------------------------------------------------------------------------
    // 1. 速率限制检查
    // -------------------------------------------------------------------------
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: '请求过于频繁，请稍后再试',
            retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW / 1000)),
          },
        }
      );
    }

    // -------------------------------------------------------------------------
    // 2. 权限验证
    // -------------------------------------------------------------------------
    const permissionError = await validatePermissions(
      request,
      AGENT_MONITOR_PERMISSIONS.READ
    );
    if (permissionError) {
      return permissionError;
    }

    // -------------------------------------------------------------------------
    // 3. 输入验证
    // -------------------------------------------------------------------------
    const url = new URL(request.url);
    const queryResult = QuerySchema.safeParse({
      agent: url.searchParams.get('agent') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      startTime: url.searchParams.get('startTime') ?? undefined,
      endTime: url.searchParams.get('endTime') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: '参数格式错误',
            details: queryResult.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { agent: agentFilter, limit, startTime, endTime } = queryResult.data;

    // -------------------------------------------------------------------------
    // 4. 构建查询条件
    // -------------------------------------------------------------------------
    const where: Record<string, unknown> = {
      status: ActionStatus.FAILED,
    };

    if (agentFilter) {
      where.agentName = agentFilter;
    }

    if (startTime || endTime) {
      where.createdAt = {};
      if (startTime) {
        (where.createdAt as Record<string, Date>).gte = new Date(startTime);
      }
      if (endTime) {
        (where.createdAt as Record<string, Date>).lte = new Date(endTime);
      }
    }

    // -------------------------------------------------------------------------
    // 5. 查询失败的记录
    // -------------------------------------------------------------------------
    const failedActions = await prisma.agentAction.findMany({
      where,
      select: {
        id: true,
        agentName: true,
        actionName: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: MAX_ANALYSIS_LIMIT,
    });

    // -------------------------------------------------------------------------
    // 6. 统计错误类型分布
    // -------------------------------------------------------------------------
    const categoryCounts = new Map<string, number>();
    const agentErrorCounts = new Map<string, number>();

    for (const action of failedActions) {
      const errorMessage =
        (action.metadata as { errorMessage?: string })?.errorMessage ||
        'Unknown error';
      const category = categorizeError(errorMessage);

      // 分类统计
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

      // Agent 统计
      agentErrorCounts.set(
        action.agentName,
        (agentErrorCounts.get(action.agentName) || 0) + 1
      );
    }

    // -------------------------------------------------------------------------
    // 7. 构建最近错误列表
    // -------------------------------------------------------------------------
    const recentErrors: RecentError[] = [];
    for (let i = 0; i < Math.min(failedActions.length, limit); i++) {
      const action = failedActions[i];
      const errorMessage =
        (action.metadata as { errorMessage?: string })?.errorMessage ||
        'Unknown error';

      recentErrors.push({
        id: action.id,
        agentName: action.agentName,
        actionName: action.actionName,
        errorMessage: truncateErrorMessage(errorMessage),
        createdAt: action.createdAt.toISOString(),
      });
    }

    // -------------------------------------------------------------------------
    // 8. 计算错误类型分布百分比
    // -------------------------------------------------------------------------
    const totalErrors = failedActions.length;
    const errorDistribution: ErrorCategory[] = [];

    for (const [category, count] of categoryCounts) {
      errorDistribution.push({
        category,
        count,
        percentage:
          totalErrors > 0
            ? Number(((count / totalErrors) * 100).toFixed(1))
            : 0,
      });
    }

    // 按数量排序
    errorDistribution.sort((a, b) => b.count - a.count);

    // -------------------------------------------------------------------------
    // 9. 计算各 Agent 错误分布
    // -------------------------------------------------------------------------
    const agentErrors: AgentError[] = [];
    for (const [agentName, count] of agentErrorCounts) {
      agentErrors.push({
        agentName,
        errorCount: count,
        percentage:
          totalErrors > 0
            ? Number(((count / totalErrors) * 100).toFixed(1))
            : 0,
      });
    }

    // 按错误数排序
    agentErrors.sort((a, b) => b.errorCount - a.errorCount);

    const response: ErrorResponse = {
      errorDistribution,
      agentErrors,
      recentErrors,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Agent monitor errors API error:', error);

    // 生产环境隐藏详细错误信息
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器内部错误',
          ...(isDev && {
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      },
      { status: 500 }
    );
  }
}
