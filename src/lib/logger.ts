/**
 * 统一日志工具 —— 供 API 路由使用
 *
 * 兼容 console.* 调用模式（额外参数通过 ...args 接收），
 * 底层委托给 Winston 结构化日志，生产环境不再输出裸 console。
 *
 * 用法（与 console.* 几乎一致）：
 *   import { logger } from '@/lib/logger';
 *   logger.info('获取成功', { count: 10 });
 *   logger.error('操作失败:', error);
 *   logger.warn('警告信息');
 */

import { logger as winstonLogger } from '../../config/winston.config';

function extractError(args: unknown[]): Error | undefined {
  return args.find((a): a is Error => a instanceof Error);
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    const extra = args.length
      ? { _args: args.length === 1 ? args[0] : args }
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winstonLogger.info(message, extra as any);
  },

  warn(message: string, ...args: unknown[]): void {
    const extra = args.length
      ? { _args: args.length === 1 ? args[0] : args }
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winstonLogger.warn(message, extra as any);
  },

  error(message: string, ...args: unknown[]): void {
    const err = extractError(args);
    const rest = args.filter(a => !(a instanceof Error));
    const context = rest.length
      ? { _args: rest.length === 1 ? rest[0] : rest }
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winstonLogger.error(message, err, context as any);
  },

  debug(message: string, ...args: unknown[]): void {
    const extra = args.length
      ? { _args: args.length === 1 ? args[0] : args }
      : undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    winstonLogger.debug(message, extra as any);
  },
};
