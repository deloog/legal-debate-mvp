/**
 * Next.js Instrumentation Hook
 * 在应用启动时执行，用于初始化和验证
 *
 * 文档: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { validateRequiredEnv } from './config/validate-env';

/**
 * 服务器端注册
 * 在应用启动时执行（仅服务器端）
 */
export async function register() {
  // 只在 Node.js 运行时执行
  // 函数定义也放在此块内，避免 Turbopack 静态分析将 process.* API 标记为 Edge Runtime 不兼容
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 正在启动应用...');

    // 优雅关闭处理（函数定义在 nodejs 块内，保证 process.on/exit 不被 Edge 分析器检测到）
    function setupGracefulShutdown() {
      let isShuttingDown = false;

      async function gracefulShutdown(signal: string) {
        if (isShuttingDown) {
          console.log('[Shutdown] Already shutting down...');
          return;
        }

        isShuttingDown = true;
        console.log(
          `[Shutdown] Received ${signal}, starting graceful shutdown...`
        );

        try {
          // 等待正在处理的请求完成（2秒缓冲时间）
          // 注：数据库连接由 OS 在进程退出时自动清理，无需显式断开
          console.log('[Shutdown] Waiting for pending requests...');
          await new Promise(resolve => setTimeout(resolve, 2000));

          console.log('[Shutdown] Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('[Shutdown] Error during graceful shutdown:', error);
          process.exit(1);
        }
      }

      // 监听终止信号
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      // 监听未捕获的异常
      process.on('uncaughtException', error => {
        console.error('[Critical] Uncaught Exception:', error);
        gracefulShutdown('uncaughtException');
      });

      process.on('unhandledRejection', (reason, promise) => {
        console.error(
          '[Critical] Unhandled Rejection at:',
          promise,
          'reason:',
          reason
        );
        gracefulShutdown('unhandledRejection');
      });

      console.log('[Shutdown] Graceful shutdown handlers registered');
    }

    setupGracefulShutdown();

    // 验证环境变量
    try {
      validateRequiredEnv();
    } catch (error) {
      // 打印错误并退出（生产环境）
      if (process.env.NODE_ENV === 'production') {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    }

    console.log('✅ 应用启动完成');
  }
}
