import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "./api-error";

/**
 * 从请求中提取关联ID
 */
function extractCorrelationId(request: NextRequest): string | undefined {
  // 从请求头获取
  const headerCorrelationId =
    request.headers.get("X-Correlation-ID") ||
    request.headers.get("x-correlation-id");
  if (headerCorrelationId) {
    return headerCorrelationId;
  }

  // 从查询参数获取
  const url = new URL(request.url);
  const queryCorrelationId = url.searchParams.get("correlationId");
  if (queryCorrelationId) {
    return queryCorrelationId;
  }

  return undefined;
}

/**
 * 生产环境安全的错误消息
 */
function getSecureErrorMessage(error: Error, isProduction: boolean): string {
  if (!isProduction) {
    return error.message;
  }

  // 生产环境下隐藏敏感错误信息
  const safeMessages = [
    "Internal server error",
    "Service temporarily unavailable",
    "Request processing failed",
    "Database connection error",
  ];

  return safeMessages.includes(error.message)
    ? error.message
    : "Internal server error";
}

/**
 * 全局错误处理中间件
 * 统一处理所有API错误，返回标准格式
 */
export function handleApiError(
  error: unknown,
  request: NextRequest,
): NextResponse {
  const correlationId = extractCorrelationId(request);
  const isProduction = process.env.NODE_ENV === "production";

  // 记录错误日志
  console.error("API Error:", {
    error: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
    url: request.url,
    method: request.method,
    correlationId,
    timestamp: new Date().toISOString(),
  });

  // 如果是API错误，直接返回
  if (error instanceof ApiError) {
    // 在生产环境中确保错误消息安全
    if (isProduction && error.statusCode >= 500) {
      error.message = getSecureErrorMessage(error, isProduction);
    }
    return error.toResponse(correlationId);
  }

  // 处理Zod验证错误
  if (error && typeof error === "object" && "issues" in error) {
    const response = NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: {
            validationErrors: error.issues,
          },
          timestamp: new Date().toISOString(),
          correlationId,
        },
      },
      {
        status: 400,
        headers: correlationId
          ? {
              "X-Correlation-ID": correlationId,
            }
          : undefined,
      },
    );
    return response;
  }

  // 处理Prisma错误
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as { code: string; message: string };

    switch (prismaError.code) {
      case "P2002":
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "DUPLICATE_ENTRY",
              message: "Resource already exists",
              timestamp: new Date().toISOString(),
              correlationId,
            },
          },
          {
            status: 409,
            headers: correlationId
              ? {
                  "X-Correlation-ID": correlationId,
                }
              : undefined,
          },
        );
      case "P2025":
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Resource not found",
              timestamp: new Date().toISOString(),
              correlationId,
            },
          },
          {
            status: 404,
            headers: correlationId
              ? {
                  "X-Correlation-ID": correlationId,
                }
              : undefined,
          },
        );
      default:
        break;
    }
  }

  // 默认内部服务器错误
  const errorMessage = isProduction
    ? "Internal server error"
    : error instanceof Error
      ? error.message
      : "Unknown error";

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: errorMessage,
        timestamp: new Date().toISOString(),
        correlationId,
      },
    },
    {
      status: 500,
      headers: correlationId
        ? {
            "X-Correlation-ID": correlationId,
          }
        : undefined,
    },
  );
}

/**
 * API路由包装器，统一处理错误
 */
export function withErrorHandler(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    ...args: any[]
  ): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return handleApiError(error, request);
    }
  };
}

/**
 * 异步错误处理包装器
 */
export async function withErrorHandling<T>(
  promise: Promise<T>,
  request: NextRequest,
): Promise<[T | null, NextResponse | null]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    return [null, handleApiError(error, request)];
  }
}
