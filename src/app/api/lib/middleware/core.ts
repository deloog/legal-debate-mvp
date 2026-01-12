import { NextRequest, NextResponse } from 'next/server';

/**
 * 请求上下文接口
 */
export interface RequestContext {
  request: NextRequest;
  startTime: number;
  requestId: string;
  correlationId: string;
  userId?: string;
  role?: string;
}

/**
 * 全局中间件类型
 */
export type Middleware = (
  request: NextRequest,
  context: RequestContext,
  response: NextResponse
) => Promise<void | NextResponse>;

/**
 * 中间件栈执行器
 */
export class MiddlewareStack {
  private middlewares: Middleware[] = [];

  /**
   * 添加中间件
   */
  use(middleware: Middleware): MiddlewareStack {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * 执行中间件栈
   */
  async execute(
    request: NextRequest,
    context: RequestContext
  ): Promise<NextResponse> {
    // 1. 创建单一response实例，贯穿所有中间件
    const finalResponse = NextResponse.next();

    // 2. 依次执行中间件，共享同一个response
    for (const middleware of this.middlewares) {
      try {
        const result = await middleware(request, context, finalResponse);

        // 如果中间件返回了NextResponse，使用它并停止执行链
        if (result) {
          return result;
        }
      } catch (error) {
        const { handleApiError } = await import('../errors/error-handler');
        return handleApiError(error, request);
      }
    }

    return finalResponse;
  }
}

/**
 * 创建请求上下文
 */
export function createRequestContext(request: NextRequest): RequestContext {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 9);

  return {
    request,
    startTime: timestamp,
    requestId: `req_${timestamp}_${randomStr}`,
    correlationId: `corr_${timestamp}_${randomStr}`,
  };
}
