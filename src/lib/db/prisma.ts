import { PrismaClient } from '@prisma/client';
import { logError } from '../utils/safe-logger';

// 全局变量，用于存储Prisma客户端实例
declare global {
  // 允许在开发热重载时保持单一实例
  var __prisma: PrismaClient | undefined;
}

// 判断是否为测试环境
const isTestEnv =
  process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

// 创建Prisma客户端实例
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });
}

// 获取Prisma客户端实例（单例模式）
export const prisma = globalThis.__prisma ?? createPrismaClient();

// 开发环境下，将客户端实例保存到全局变量，避免热重载时创建多个实例
if (process.env.NODE_ENV === 'development' && !isTestEnv) {
  globalThis.__prisma = prisma;
}

// 数据库连接健康检查
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    // 使用安全日志函数，避免泄露敏感的数据库连接信息
    logError('数据库连接检查失败', error);
    return false;
  }
};

// 优雅关闭数据库连接
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('数据库连接已断开');
  } catch (error) {
    // 使用安全日志函数，避免泄露敏感的数据库连接信息
    logError('断开数据库连接时出错', error);
    throw error;
  }
};

// 数据库连接状态监控
export const getConnectionInfo = async () => {
  try {
    if (process.env.DATABASE_URL?.includes('sqlite')) {
      await prisma.$queryRaw`PRAGMA busy_timeout`;
      return {
        active_connections: 1,
        total_connections: 1,
      };
    }
    const result = await prisma.$queryRaw<
      Array<{
        active_connections: number;
        total_connections: number;
      }>
    >`SELECT
        count(*) as active_connections,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as total_connections
      FROM pg_stat_activity
      WHERE state = 'active'`;
    return result[0];
  } catch (error) {
    // 使用安全日志函数，避免泄露敏感的数据库连接信息
    logError('获取连接信息失败', error);
    return null;
  }
};

export default prisma;
