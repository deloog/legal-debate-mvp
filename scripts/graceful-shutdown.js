/**
 * 优雅关闭处理脚本
 * 确保在容器停止时正确清理资源
 */

/**
 * 优雅关闭处理器
 */
function setupGracefulShutdown() {
  let isShuttingDown = false;

  async function gracefulShutdown(signal) {
    if (isShuttingDown) {
      console.log('[Shutdown] Already shutting down...');
      return;
    }

    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`);

    try {
      // 1. 停止接受新请求（如果使用Express/Fastify等）
      // server.close();

      // 2. 关闭数据库连接
      console.log('[Shutdown] Closing database connections...');
      const { prisma } = require('../src/lib/db/prisma');
      await prisma.$disconnect();
      console.log('[Shutdown] Database connections closed');

      // 3. 清理Redis连接（如果使用）
      // if (redisClient) {
      //   await redisClient.quit();
      // }

      // 4. 等待正在处理的请求完成（最多30秒）
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

  // 监听未捕获的异常和Promise拒绝
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

// 如果直接运行此脚本，则设置优雅关闭
if (require.main === module) {
  setupGracefulShutdown();
}

module.exports = { setupGracefulShutdown };
