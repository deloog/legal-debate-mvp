import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import {
  createDefaultMiddlewareStack,
  createRequestContext,
} from "@/app/api/lib/middleware";

// 创建中间件栈
const middlewareStack = createDefaultMiddlewareStack();

/**
 * GET /api/version
 * 版本信息端点
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 1. 执行中间件栈获取累积的headers
  const context = createRequestContext(request);
  const middlewareResponse = await middlewareStack.execute(request, context);

  // 2. 获取版本信息
  const packageJson = require("../../../../package.json");

  const versionData = {
    api: {
      version: "v1",
      name: "Legal Debate API",
      description: "RESTful API for Legal Debate System",
    },
    application: {
      name: packageJson.name || "legal-debate-mvp",
      version: packageJson.version || "1.0.0",
      description: packageJson.description || "Legal Debate MVP System",
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
    },
    endpoints: {
      v1: "/api/v1",
      health: "/api/health",
      version: "/api/version",
    },
    documentation: {
      swagger: "/api/docs",
      postman: "/api/docs/postman",
    },
    support: {
      contact: "support@legaldebate.com",
      documentation: "https://docs.legaldebate.com",
      issues: "https://github.com/legaldebate/issues",
    },
  };

  // 3. 创建新的响应并手动复制所有中间件headers
  const responseData = {
    success: true,
    data: versionData,
    meta: {
      version: "v1",
      timestamp: new Date().toISOString(),
    },
  };

  const response = NextResponse.json(responseData, { status: 200 });

  // 手动复制中间件headers
  middlewareResponse.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  // 确保Content-Type正确设置
  response.headers.set("Content-Type", "application/json");

  return response;
});

/**
 * HEAD /api/version
 * 版本检查（仅状态）
 */
export const HEAD = withErrorHandler(async (request: NextRequest) => {
  // 1. 执行中间件栈获取累积的headers
  const context = createRequestContext(request);
  const middlewareResponse = await middlewareStack.execute(request, context);

  // 2. HEAD请求不应有body，但保留headers
  return new NextResponse(null, {
    status: 200,
    headers: middlewareResponse.headers, // 🔑 关键：传递中间件headers
  });
});
