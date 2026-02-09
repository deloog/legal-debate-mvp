/**
 * Jest Global Setup
 * 测试环境全局初始化
 *
 * 注意：使用CommonJS格式，因为Jest globalSetup需要CommonJS模块
 */

// 设置测试环境变量（NODE_ENV在某些环境中是只读的，使用Object.defineProperty）
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
  configurable: true,
});

// 数据库连接池限制（避免连接耗尽）
process.env.DATABASE_POOL_MIN = '1';
process.env.DATABASE_POOL_MAX = '3';

// 禁用AI真实调用
process.env.USE_REAL_AI = 'false';

// 测试JWT密钥
process.env.JWT_SECRET = 'test-secret-key-for-jest-testing-only';

// 减少日志输出
process.env.LOG_LEVEL = 'error';

// 内存限制警告阈值
const MB = 1024 * 1024;
const MAX_HEAP_SIZE = 512 * MB;

module.exports = async () => {
  console.log('🧪 Jest Global Setup: 初始化测试环境...');

  // 检查内存使用情况
  const memUsage = process.memoryUsage();
  const heapUsed = memUsage.heapUsed / MB;
  const heapTotal = memUsage.heapTotal / MB;

  console.log(
    `📊 内存使用: ${heapUsed.toFixed(2)}MB / ${heapTotal.toFixed(2)}MB`
  );

  // 如果堆内存超过限制，输出警告
  if (heapTotal > MAX_HEAP_SIZE / MB) {
    console.warn(`⚠️  堆内存使用较高: ${heapTotal.toFixed(2)}MB`);
  }

  console.log('✅ Jest Global Setup 完成');
};
