require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

// 创建Prisma客户端实例
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

async function testConnection() {
  try {
    await prisma.$connect();
    console.log("✅ 数据库连接成功");

    const result =
      await prisma.$queryRaw`SELECT current_user, current_database()`;
    console.log("查询结果:", result);

    await prisma.$disconnect();
    console.log("✅ 连接已断开");
  } catch (error) {
    console.error("❌ 连接失败:", error);
  }
}

testConnection();
