import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createDefaultMiddlewareStack,
  createRequestContext,
} from '@/app/api/lib/middleware';
import { checkDatabaseConnection, getConnectionInfo } from '@/lib/db/prisma';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import type {
  HealthStatus,
  DatabaseHealth,
  AIServiceHealth,
} from '@/types/health';

// 创建中间件栈
const middlewareStack = createDefaultMiddlewareStack();

/**
 * 检查数据库健康状态
 */
async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();

  try {
    // 检查数据库连接
    const isConnected = await checkDatabaseConnection();
    const responseTime = Date.now() - startTime;

    if (!isConnected) {
      return {
        status: 'unhealthy',
        responseTime,
        message: '数据库连接失败',
      };
    }

    // 获取连接信息
    const connectionInfo = await getConnectionInfo();

    // 转换字段名以匹配类型定义
    const normalizedConnectionInfo = connectionInfo
      ? {
          activeConnections: connectionInfo.active_connections || 0,
          totalConnections: connectionInfo.total_connections,
        }
      : {
          activeConnections: 0,
        };

    return {
      status: 'healthy',
      responseTime,
      connectionInfo: normalizedConnectionInfo,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      message: error instanceof Error ? error.message : '数据库健康检查失败',
      details: {
        error: error instanceof Error ? error.stack : String(error),
      },
    };
  }
}

/**
 * 检查AI服务健康状态
 */
async function checkAIServiceHealth(): Promise<AIServiceHealth> {
  const startTime = Date.now();

  try {
    // 获取AI服务实例
    const aiService = await AIServiceFactory.getInstance();

    // 执行健康检查
    const isHealthy = await aiService.healthCheck();
    const responseTime = Date.now() - startTime;

    if (!isHealthy) {
      return {
        status: 'unhealthy',
        responseTime,
        message: 'AI服务不可用',
        providers: [],
        availableProviders: [],
      };
    }

    // 获取服务状态
    const serviceStatus = aiService.getServiceStatus();
    const providerStats = Object.values(serviceStatus.providerStatus || {});

    const providers = providerStats.map(stat => ({
      provider: stat.provider,
      status: stat.healthy ? ('healthy' as const) : ('unhealthy' as const),
      responseTime: stat.responseTime,
      lastCheck: stat.lastCheck,
    }));

    const availableProviders = aiService.getAvailableProviders();

    return {
      status: 'healthy',
      responseTime,
      providers,
      availableProviders,
      availableModels: ['deepseek-chat', 'glm-4'],
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      message: error instanceof Error ? error.message : 'AI服务健康检查失败',
      providers: [],
      availableProviders: [],
      details: {
        error: error instanceof Error ? error.stack : String(error),
      },
    };
  }
}

/**
 * 计算整体健康状态
 */
function calculateOverallStatus(services: {
  database: DatabaseHealth;
  ai: AIServiceHealth;
}): HealthStatus {
  const { database, ai } = services;

  // 如果任何服务不健康，整体状态为不健康
  if (database.status === 'unhealthy' || ai.status === 'unhealthy') {
    return 'unhealthy';
  }

  // 如果任何服务降级，整体状态为降级
  if (database.status === 'degraded' || ai.status === 'degraded') {
    return 'degraded';
  }

  // 所有服务健康，整体状态为健康
  return 'healthy';
}

/**
 * 计算服务统计摘要
 */
function calculateSummary(services: {
  database: DatabaseHealth;
  ai: AIServiceHealth;
}) {
  const { database, ai } = services;

  let healthy = 0;
  let degraded = 0;
  let unhealthy = 0;

  // 统计数据库状态
  if (database.status === 'healthy') {
    healthy += 1;
  } else if (database.status === 'degraded') {
    degraded += 1;
  } else {
    unhealthy += 1;
  }

  // 统计AI服务状态
  if (ai.status === 'healthy') {
    healthy += 1;
  } else if (ai.status === 'degraded') {
    degraded += 1;
  } else {
    unhealthy += 1;
  }

  return {
    total: 2,
    healthy,
    degraded,
    unhealthy,
  };
}

/**
 * GET /api/health/deps
 * 依赖服务检查端点
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. 执行中间件栈获取累积的headers
  const context = createRequestContext(request);
  const middlewareResponse = await middlewareStack.execute(request, context);

  // 2. 并行检查所有依赖服务
  const [databaseHealth, aiServiceHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkAIServiceHealth(),
  ]);

  // 3. 计算整体状态和摘要
  const overallStatus = calculateOverallStatus({
    database: databaseHealth,
    ai: aiServiceHealth,
  });
  const summary = calculateSummary({
    database: databaseHealth,
    ai: aiServiceHealth,
  });

  // 4. 构建响应数据（使用与/health路由相同的结构）
  const response = NextResponse.json(
    {
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: databaseHealth,
          ai: aiServiceHealth,
        },
        summary,
      },
      meta: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    },
    {
      status: overallStatus === 'healthy' ? 200 : 503,
    }
  );

  // 手动复制中间件headers
  middlewareResponse.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  // 确保Content-Type正确设置
  response.headers.set('Content-Type', 'application/json');

  return response;
});
