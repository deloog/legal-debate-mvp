require('dotenv').config();

console.log('环境变量 DATABASE_URL:', process.env.DATABASE_URL);
console.log('PGPASSFILE环境变量:', process.env.PGPASSFILE);

// 尝试加载Prisma配置
try {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  console.log('✅ Prisma客户端创建成功');

  // 测试数据库连接
  prisma
    .$connect()
    .then(() => {
      console.log('✅ 数据库连接成功');
      return prisma.$disconnect();
    })
    .catch(error => {
      console.error('❌ 数据库连接失败:', error);
    });
} catch (error) {
  console.error('❌ 加载Prisma配置失败:', error);
}
