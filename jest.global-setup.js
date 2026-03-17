const path = require('path');
const dotenv = require('dotenv');

module.exports = async () => {
  // 加载 .env.test，确保测试使用独立的 legal_debate_test 数据库
  // （避免污染开发数据库，也避免与开发数据库连接数冲突）
  dotenv.config({ path: path.resolve(__dirname, '.env.test') });

  // 为 Prisma 连接加上连接数限制，防止多个 PrismaClient 实例耗尽连接池
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('connection_limit')) {
    process.env.DATABASE_URL = process.env.DATABASE_URL + '?connection_limit=3&pool_timeout=10';
  }

  console.log('🧪 Jest Global Setup: 初始化测试环境...');
  console.log('📊 内存使用:', process.memoryUsage());
  console.log('✅ Jest Global Setup 完成');
};
