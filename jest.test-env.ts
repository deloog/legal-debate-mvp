/**
 * Jest 测试环境配置
 * 用于优化测试时的数据库连接池和其他资源限制
 */

// 测试环境数据库URL（使用内存SQLite或轻量级配置）
process.env.DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/legal_debate_test';

// 测试环境数据库连接池限制（避免连接耗尽）
process.env.DATABASE_POOL_MIN = '1';
process.env.DATABASE_POOL_MAX = '5';

// Redis禁用或使用内存模拟（加速测试）
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_TLS = 'false';

// 禁用AI服务真实调用
process.env.USE_REAL_AI = 'false';

// 加快测试超时
process.env.TEST_TIMEOUT = '5000';

// 禁用日志输出
process.env.LOG_LEVEL = 'error';

// 测试JWT密钥
process.env.JWT_SECRET = 'test-secret-key-for-jest-testing-only';
