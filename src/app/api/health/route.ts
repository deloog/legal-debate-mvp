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
  SystemHealth,
} from '@/types/health';

// 创建中间件栈
const middlewareStack = createDefaultMiddlewareStack();

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
      availableModels: ['deepseek-chat', 'glm-4'], // 可从配置中获取
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
 * 获取系统健康信息
 */
function getSystemHealth(): SystemHealth {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  return {
    uptime,
    memory: {
      used: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      external: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100,
    },
    cpu: {
      usage: process.cpuUsage().user / 1000000, // 转换为秒
    },
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    environment: process.env.NODE_ENV || 'development',
  };
}

/**
 * GET /api/health
 * 健康检查端点
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. 执行中间件栈获取累积的headers
  const context = createRequestContext(request);
  const middlewareResponse = await middlewareStack.execute(request, context);

  // 2. 并行检查所有服务
  const [databaseHealth, aiServiceHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkAIServiceHealth(),
  ]);

  // 3. 计算整体状态
  const overallStatus = calculateOverallStatus({
    database: databaseHealth,
    ai: aiServiceHealth,
  });

  // 4. 构建响应数据
  const healthData = {
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: databaseHealth,
        ai: aiServiceHealth,
      },
      system: getSystemHealth(),
    },
    meta: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: 'v1',
    },
  };

  // 5. 创建响应并手动复制中间件headers
  const response = NextResponse.json(healthData, {
    status: overallStatus === 'healthy' ? 200 : 503,
  });

  // 手动复制中间件headers
  middlewareResponse.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  // 确保Content-Type正确设置
  response.headers.set('Content-Type', 'application/json');

  return response;
});

/**
 * HEAD /api/health
 * 简单健康检查（仅状态）
 */
export const HEAD = withErrorHandler(async (request: NextRequest) => {
  // 1. 执行中间件栈获取累积的headers
  const context = createRequestContext(request);
  const middlewareResponse = await middlewareStack.execute(request, context);

  // 2. 快速检查核心服务
  const [dbConnected, aiHealthy] = await Promise.all([
    checkDatabaseConnection().catch(() => false),
    AIServiceFactory.getInstance()
      .then(service => service.healthCheck())
      .catch(() => false),
  ]);

  const status = dbConnected && aiHealthy ? 200 : 503;

  // 3. 创建HEAD响应并手动复制headers
  const response = new NextResponse(null, { status });

  // 手动复制中间件headers，但排除Content-Type（HEAD请求不应该有Content-Type）
  middlewareResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'content-type') {
      response.headers.set(key, value);
    }
  });

  return response;
});
