import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import { createHealthResponse } from "@/app/api/lib/responses/api-response";
import {
  createDefaultMiddlewareStack,
  createRequestContext,
} from "@/app/api/lib/middleware";

// 创建中间件栈
const middlewareStack = createDefaultMiddlewareStack();

/**
 * GET /api/health
 * 健康检查端点
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. 执行中间件栈获取累积的headers
  const context = createRequestContext(request);
  const middlewareResponse = await middlewareStack.execute(request, context);

  // 2. 检查数据库连接状态
  let dbStatus = "healthy";
  let dbResponseTime = 0;

  try {
    const startTime = Date.now();
    // 这里应该检查实际的数据库连接
    // await prisma.$queryRaw`SELECT 1`;
    dbResponseTime = Date.now() - startTime;
  } catch (error) {
    dbStatus = "unhealthy";
  }

  // 3. 检查AI服务状态
  let aiStatus = "healthy";
  try {
    // 这里应该检查AI服务的连接状态
    // await aiService.checkHealth();
  } catch (error) {
    aiStatus = "unhealthy";
  }

  const overallStatus =
    dbStatus === "healthy" && aiStatus === "healthy" ? "healthy" : "unhealthy";

  // 4. 手动合并headers到新响应
  const healthData = {
    success: true,
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbStatus,
          responseTime: `${dbResponseTime}ms`,
        },
        ai: {
          status: aiStatus,
        },
      },
      system: {
        uptime: process.uptime(),
        memory: {
          used:
            Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
            100,
          total:
            Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
            100,
        },
        nodeVersion: process.version,
        environment: process.env.NODE_ENV,
      },
    },
    meta: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: "v1",
    },
  };

  // 创建新的响应并手动复制所有中间件headers
  const response = NextResponse.json(healthData, {
    status: overallStatus === "healthy" ? 200 : 503,
  });

  // 手动复制中间件headers
  middlewareResponse.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  // 确保Content-Type正确设置
  response.headers.set("Content-Type", "application/json");

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

  // 2. 创建HEAD响应并手动复制headers
  const response = new NextResponse(null, { status: 200 });

  // 手动复制中间件headers，但排除Content-Type（HEAD请求不应该有Content-Type）
  middlewareResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "content-type") {
      response.headers.set(key, value);
    }
  });

  return response;
});
