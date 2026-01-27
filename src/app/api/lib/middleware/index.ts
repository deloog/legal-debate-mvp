import { MiddlewareStack } from './core';
import {
  corsMiddleware,
  securityMiddleware,
  rateLimitMiddleware,
} from './security';
import {
  loggingMiddleware,
  responseTimeMiddleware,
  versionMiddleware,
} from './logging';

/**
 * 创建默认中间件栈
 */
export function createDefaultMiddlewareStack(): MiddlewareStack {
  return new MiddlewareStack()
    .use(corsMiddleware)
    .use(loggingMiddleware)
    .use(responseTimeMiddleware)
    .use(securityMiddleware)
    .use(rateLimitMiddleware)
    .use(versionMiddleware);
}

// 导出所有中间件相关
export * from './core';
export * from './security';
export * from './logging';
