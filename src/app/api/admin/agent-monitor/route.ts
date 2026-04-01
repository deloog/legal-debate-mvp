/**
 * Agent Monitor API
 * 提供 Agent 性能监控数据统计
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

/** 最大查询记录数限制 */
const MAX_QUERY_LIMIT = 10000;

/** 速率限制配置 - 每 IP 每分钟最大请求数 */
const RATE_LIMIT_MAX = 30;

/** 速率限制窗口 - 1分钟 */
const RATE_LIMIT_WINDOW = 60 * 1000;

// =============================================================================
// 类型定义
// =============================================================================

interface AgentStats {
  agentName: string;
  totalCalls: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
}

interface SummaryStats {
  totalAgents: number;
  totalCalls: number;
  overallSuccessRate: number;
  avgExecutionTime: number;
}

interface MonitorResponse {
  agents: AgentStats[];
  summary: SummaryStats;
}

// =============================================================================
// 输入验证 Schema
// =============================================================================

const QuerySchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

// =============================================================================
// 速率限制存储 (内存实现，生产环境建议使用 Redis)
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
    // 新窗口
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

/**
 * 清理过期的速率限制记录
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// 每小时清理一次
setInterval(cleanupRateLimitStore, 60 * 60 * 1000);

// =============================================================================
// API 处理器
// =============================================================================

/**
 * GET /api/admin/agent-monitor
 * 获取各 Agent 的实时性能统计
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

    const { startTime, endTime } = queryResult.data;

    // -------------------------------------------------------------------------
    // 4. 构建查询条件
    // -------------------------------------------------------------------------
    const where: Record<string, unknown> = {};
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
    // 5. 查询统计数据 (带限制)
    // -------------------------------------------------------------------------
    const stats = await prisma.agentAction.groupBy({
      by: ['agentName', 'status'],
      where,
      _count: {
        id: true,
      },
      _avg: {
        executionTime: true,
      },
      _min: {
        executionTime: true,
      },
      _max: {
        executionTime: true,
      },
      orderBy: {
        agentName: 'asc',
      },
      take: MAX_QUERY_LIMIT,
    });

    // -------------------------------------------------------------------------
    // 6. 聚合各 Agent 的数据
    // -------------------------------------------------------------------------
    const agentMap = new Map<string, AgentStats>();

    for (const stat of stats) {
      const { agentName, status } = stat;
      const count = stat._count.id;
      const avgTime = stat._avg.executionTime ?? 0;
      const minTime = stat._min.executionTime ?? 0;
      const maxTime = stat._max.executionTime ?? 0;

      if (!agentMap.has(agentName)) {
        agentMap.set(agentName, {
          agentName,
          totalCalls: 0,
          successCount: 0,
          failedCount: 0,
          pendingCount: 0,
          successRate: 0,
          avgExecutionTime: 0,
          minExecutionTime: Infinity,
          maxExecutionTime: 0,
        });
      }

      const agent = agentMap.get(agentName)!;
      agent.totalCalls += count;

      switch (status) {
        case ActionStatus.COMPLETED:
          agent.successCount += count;
          break;
        case ActionStatus.FAILED:
          agent.failedCount += count;
          break;
        case ActionStatus.PENDING:
        case ActionStatus.RUNNING:
        case ActionStatus.RETRYING:
          agent.pendingCount += count;
          break;
      }

      // 更新执行时间统计（加权平均）
      if (agent.totalCalls > 0) {
        agent.avgExecutionTime =
          (agent.avgExecutionTime * (agent.totalCalls - count) +
            avgTime * count) /
          agent.totalCalls;
      }
      agent.minExecutionTime = Math.min(agent.minExecutionTime, minTime);
      agent.maxExecutionTime = Math.max(agent.maxExecutionTime, maxTime);
    }

    // -------------------------------------------------------------------------
    // 7. 计算汇总数据
    // -------------------------------------------------------------------------
    const agents: AgentStats[] = [];
    let totalCalls = 0;
    let totalSuccess = 0;
    let totalExecutionTime = 0;
    let totalWeight = 0;

    for (const agent of agentMap.values()) {
      // 计算成功率
      const completedCalls = agent.successCount + agent.failedCount;
      agent.successRate =
        completedCalls > 0
          ? Number(((agent.successCount / completedCalls) * 100).toFixed(2))
          : 0;

      // 如果没有执行时间数据，设为0
      if (agent.minExecutionTime === Infinity) {
        agent.minExecutionTime = 0;
      }

      // 四舍五入平均执行时间
      agent.avgExecutionTime = Number(agent.avgExecutionTime.toFixed(2));

      agents.push(agent);

      // 汇总统计
      totalCalls += agent.totalCalls;
      totalSuccess += agent.successCount;
      if (agent.totalCalls > 0) {
        totalExecutionTime += agent.avgExecutionTime * agent.totalCalls;
        totalWeight += agent.totalCalls;
      }
    }

    // 按总调用数排序
    agents.sort((a, b) => b.totalCalls - a.totalCalls);

    // 计算汇总
    const summary: SummaryStats = {
      totalAgents: agents.length,
      totalCalls,
      overallSuccessRate:
        totalCalls > 0
          ? Number(((totalSuccess / totalCalls) * 100).toFixed(0))
          : 0,
      avgExecutionTime:
        totalWeight > 0
          ? Number((totalExecutionTime / totalWeight).toFixed(0))
          : 0,
    };

    const response: MonitorResponse = {
      agents,
      summary,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Agent monitor API error:', error);

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
