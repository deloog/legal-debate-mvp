import { prisma } from '@/lib/db/prisma';

/**
 * API性能指标接口
 */
export interface APIMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  error?: string;
}

/**
 * 数据库性能指标接口
 */
export interface DatabaseMetrics {
  operation: string;
  table: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
  query?: string;
}

/**
 * AI服务性能指标接口
 */
export interface AIMetrics {
  provider: string;
  model?: string;
  operation: string;
  tokensUsed?: number;
  duration: number;
  cost?: number;
  success: boolean;
  timestamp: Date;
  error?: string;
}

/**
 * 业务事件指标接口
 */
export interface BusinessMetrics {
  eventType: string;
  entityType: string;
  entityId: string;
  userId?: string;
  details: Record<string, any>;
  timestamp: Date;
}

/**
 * API监控器
 */
export class APIMonitor {
  /**
   * 记录API请求指标
   */
  static async logRequest(
    metrics: Omit<APIMetrics, 'timestamp'>
  ): Promise<void> {
    try {
      // 记录到AIInteraction表（复用现有表结构）
      await prisma.aIInteraction.create({
        data: {
          type: 'API_REQUEST',
          provider: 'MONITOR',
          model: `${metrics.method} ${metrics.endpoint}`,
          request: {
            endpoint: metrics.endpoint,
            method: metrics.method,
            statusCode: metrics.statusCode,
            responseTime: metrics.responseTime,
            userId: metrics.userId,
            requestId: metrics.requestId,
            userAgent: metrics.userAgent,
            ip: metrics.ip,
          },
          response: metrics.error ? { error: metrics.error } : null,
          tokensUsed: Math.round(metrics.responseTime), // 复用字段存储响应时间
          duration: metrics.responseTime,
          success: metrics.statusCode < 400,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log API metrics:', error);
    }
  }

  /**
   * 记录数据库操作指标
   */
  static async logDatabaseOperation(
    metrics: Omit<DatabaseMetrics, 'timestamp'>
  ): Promise<void> {
    try {
      await prisma.aIInteraction.create({
        data: {
          type: 'DATABASE_OPERATION',
          provider: 'DATABASE',
          model: `${metrics.operation} ${metrics.table}`,
          request: {
            operation: metrics.operation,
            table: metrics.table,
            query: metrics.query,
          },
          response: metrics.error ? { error: metrics.error } : null,
          duration: metrics.duration,
          success: metrics.success,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log database metrics:', error);
    }
  }

  /**
   * 记录AI服务指标
   */
  static async logAIOperation(
    metrics: Omit<AIMetrics, 'timestamp'>
  ): Promise<void> {
    try {
      await prisma.aIInteraction.create({
        data: {
          type: 'AI_OPERATION',
          provider: metrics.provider,
          model: metrics.model,
          request: {
            operation: metrics.operation,
          },
          response: metrics.error ? { error: metrics.error } : null,
          tokensUsed: metrics.tokensUsed,
          duration: metrics.duration,
          cost: metrics.cost,
          success: metrics.success,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log AI metrics:', error);
    }
  }

  /**
   * 记录业务事件
   */
  static async logBusinessEvent(
    metrics: Omit<BusinessMetrics, 'timestamp'>
  ): Promise<void> {
    try {
      await prisma.aIInteraction.create({
        data: {
          type: 'BUSINESS_EVENT',
          provider: 'SYSTEM',
          model: metrics.eventType,
          request: {
            entityType: metrics.entityType,
            entityId: metrics.entityId,
            userId: metrics.userId,
            details: metrics.details,
          },
          success: true,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log business metrics:', error);
    }
  }

  /**
   * 获取API性能统计
   */
  static async getAPIStats(timeRange?: { start: Date; end: Date }): Promise<{
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{
      endpoint: string;
      count: number;
      avgResponseTime: number;
    }>;
  }> {
    const where = timeRange
      ? {
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        }
      : {};

    const interactions = await prisma.aIInteraction.findMany({
      where: {
        ...where,
        type: 'API_REQUEST',
      },
      orderBy: { createdAt: 'desc' },
      take: 1000, // 限制查询数量
    });

    const totalRequests = interactions.length;
    const successfulRequests = interactions.filter(i => i.success).length;
    const errorRate =
      totalRequests > 0
        ? (totalRequests - successfulRequests) / totalRequests
        : 0;

    const averageResponseTime =
      interactions.length > 0
        ? interactions.reduce((sum, i) => sum + (i.duration || 0), 0) /
          interactions.length
        : 0;

    // 统计端点性能
    const endpointStats = interactions.reduce(
      (acc, interaction) => {
        const endpoint = interaction.model || 'unknown';
        if (!acc[endpoint]) {
          acc[endpoint] = { count: 0, totalResponseTime: 0 };
        }
        acc[endpoint].count++;
        acc[endpoint].totalResponseTime += interaction.duration || 0;
        return acc;
      },
      {} as Record<string, { count: number; totalResponseTime: number }>
    );

    const topEndpoints = Object.entries(endpointStats)
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgResponseTime:
          stats.count > 0 ? stats.totalResponseTime / stats.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      topEndpoints,
    };
  }

  /**
   * 获取AI服务统计
   */
  static async getAIStats(timeRange?: { start: Date; end: Date }): Promise<{
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    totalTokens: number;
    totalCost: number;
    providerStats: Array<{
      provider: string;
      count: number;
      successRate: number;
    }>;
  }> {
    const where = timeRange
      ? {
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        }
      : {};

    const interactions = await prisma.aIInteraction.findMany({
      where: {
        ...where,
        type: 'AI_OPERATION',
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const totalOperations = interactions.length;
    const successfulOperations = interactions.filter(i => i.success).length;
    const successRate =
      totalOperations > 0 ? successfulOperations / totalOperations : 0;

    const averageDuration =
      interactions.length > 0
        ? interactions.reduce((sum, i) => sum + (i.duration || 0), 0) /
          interactions.length
        : 0;

    const totalTokens = interactions.reduce(
      (sum, i) => sum + (i.tokensUsed || 0),
      0
    );
    const totalCost = interactions.reduce((sum, i) => sum + (i.cost || 0), 0);

    // 统计提供商性能
    const providerStats = interactions.reduce(
      (acc, interaction) => {
        const provider = interaction.provider || 'unknown';
        if (!acc[provider]) {
          acc[provider] = { count: 0, successful: 0 };
        }
        acc[provider].count++;
        if (interaction.success) {
          acc[provider].successful++;
        }
        return acc;
      },
      {} as Record<string, { count: number; successful: number }>
    );

    const providerStatsArray = Object.entries(providerStats).map(
      ([provider, stats]) => ({
        provider,
        count: stats.count,
        successRate: stats.count > 0 ? stats.successful / stats.count : 0,
      })
    );

    return {
      totalOperations,
      successRate,
      averageDuration,
      totalTokens,
      totalCost,
      providerStats: providerStatsArray,
    };
  }

  /**
   * 获取业务事件统计
   */
  static async getBusinessStats(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<{
    totalEvents: number;
    eventTypeStats: Array<{ eventType: string; count: number }>;
    entityTypeStats: Array<{ entityType: string; count: number }>;
  }> {
    const where = timeRange
      ? {
          createdAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        }
      : {};

    const interactions = await prisma.aIInteraction.findMany({
      where: {
        ...where,
        type: 'BUSINESS_EVENT',
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const totalEvents = interactions.length;

    // 统计事件类型
    const eventTypeStats = interactions.reduce(
      (acc, interaction) => {
        const eventType = interaction.model || 'unknown';
        acc[eventType] = (acc[eventType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // 统计实体类型
    const entityTypeStats = interactions.reduce(
      (acc, interaction) => {
        const request = interaction.request as any;
        const entityType = request?.entityType || 'unknown';
        acc[entityType] = (acc[entityType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalEvents,
      eventTypeStats: Object.entries(eventTypeStats).map(
        ([eventType, count]) => ({
          eventType,
          count,
        })
      ),
      entityTypeStats: Object.entries(entityTypeStats).map(
        ([entityType, count]) => ({
          entityType,
          count,
        })
      ),
    };
  }

  /**
   * 清理旧的监控数据
   */
  static async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      await prisma.aIInteraction.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          type: {
            in: [
              'API_REQUEST',
              'DATABASE_OPERATION',
              'AI_OPERATION',
              'BUSINESS_EVENT',
            ],
          },
        },
      });

      console.log(`Cleaned up monitoring data older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Failed to cleanup old monitoring data:', error);
    }
  }
}

/**
 * 性能监控中间件辅助函数
 */
export function createPerformanceTracker(endpoint: string, method: string) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    requestId,
    endTime: async (
      statusCode: number,
      userId?: string,
      userAgent?: string,
      ip?: string,
      error?: string
    ) => {
      const responseTime = Date.now() - startTime;

      await APIMonitor.logRequest({
        endpoint,
        method,
        statusCode,
        responseTime,
        userId,
        requestId,
        userAgent,
        ip,
        error,
      });

      return { responseTime, requestId };
    },
  };
}

/**
 * 数据库查询性能监控装饰器
 */
export function monitorDatabaseQuery(operation: string, table: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let success = true;
      let error: string | undefined;

      try {
        const result = await method.apply(this, args);
        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : 'Unknown error';
        throw err;
      } finally {
        const duration = Date.now() - startTime;

        // 异步记录，不阻塞主流程
        APIMonitor.logDatabaseOperation({
          operation,
          table,
          duration,
          success,
          error,
        }).catch(logError => {
          console.error('Failed to log database operation:', logError);
        });
      }
    };

    return descriptor;
  };
}

/**
 * AI服务调用监控装饰器
 */
export function monitorAICall(
  provider: string,
  operation: string,
  model?: string
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let success = true;
      let error: string | undefined;
      let tokensUsed: number | undefined;
      let cost: number | undefined;

      try {
        const result = await method.apply(this, args);

        // 尝试从结果中提取token和cost信息
        if (result && typeof result === 'object') {
          tokensUsed = (result as any).tokensUsed;
          cost = (result as any).cost;
        }

        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : 'Unknown error';
        throw err;
      } finally {
        const duration = Date.now() - startTime;

        // 异步记录，不阻塞主流程
        APIMonitor.logAIOperation({
          provider,
          model,
          operation,
          tokensUsed,
          duration,
          cost,
          success,
          error,
        }).catch(logError => {
          console.error('Failed to log AI operation:', logError);
        });
      }
    };

    return descriptor;
  };
}
