import { NextResponse } from "next/server";

/**
 * API错误类，用于标准化API错误响应
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public correlationId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /**
   * 转换为NextResponse格式
   */
  toResponse(correlationId?: string): NextResponse {
    const finalCorrelationId = this.correlationId || correlationId;

    return NextResponse.json(
      {
        success: false,
        error: {
          code: this.code,
          message: this.message,
          details: this.details,
          timestamp: new Date().toISOString(),
          correlationId: finalCorrelationId,
        },
      },
      {
        status: this.statusCode,
        headers: finalCorrelationId
          ? {
              "X-Correlation-ID": finalCorrelationId,
            }
          : undefined,
      },
    );
  }
}

/**
 * 常用API错误类型
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = "Resource") {
    super(404, "NOT_FOUND", `${resource} not found`);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden") {
    super(403, "FORBIDDEN", message);
  }
}

export class InternalServerError extends ApiError {
  constructor(
    message: string = "Internal server error",
    details?: Record<string, unknown>,
  ) {
    super(500, "INTERNAL_SERVER_ERROR", message, details);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message: string = "Too many requests", retryAfter?: number) {
    super(
      429,
      "TOO_MANY_REQUESTS",
      message,
      retryAfter ? { retryAfter } : undefined,
    );
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(
    message: string = "Service temporarily unavailable",
    retryAfter?: number,
  ) {
    super(
      503,
      "SERVICE_UNAVAILABLE",
      message,
      retryAfter ? { retryAfter } : undefined,
    );
  }
}

export class ConflictError extends ApiError {
  constructor(
    message: string = "Resource conflict",
    details?: Record<string, unknown>,
  ) {
    super(409, "CONFLICT", message, details);
  }
}

export class UnprocessableEntityError extends ApiError {
  constructor(
    message: string = "Unprocessable entity",
    details?: Record<string, unknown>,
  ) {
    super(422, "UNPROCESSABLE_ENTITY", message, details);
  }
}
