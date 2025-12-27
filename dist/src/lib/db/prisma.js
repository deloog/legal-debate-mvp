"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnectionInfo = exports.disconnectDatabase = exports.checkDatabaseConnection = exports.prisma = void 0;
const client_1 = require("@prisma/client");
// 创建Prisma客户端实例
function createPrismaClient() {
    return new client_1.PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["query", "info", "warn", "error"]
            : ["error"],
    });
}
// 获取Prisma客户端实例（单例模式）
exports.prisma = globalThis.__prisma ?? createPrismaClient();
// 开发环境下，将客户端实例保存到全局变量，避免热重载时创建多个实例
if (process.env.NODE_ENV === "development") {
    globalThis.__prisma = exports.prisma;
}
// 数据库连接健康检查
const checkDatabaseConnection = async () => {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        return true;
    }
    catch (error) {
        console.error("数据库连接检查失败:", error);
        return false;
    }
};
exports.checkDatabaseConnection = checkDatabaseConnection;
// 优雅关闭数据库连接
const disconnectDatabase = async () => {
    try {
        await exports.prisma.$disconnect();
        console.log("数据库连接已断开");
    }
    catch (error) {
        console.error("断开数据库连接时出错:", error);
        throw error;
    }
};
exports.disconnectDatabase = disconnectDatabase;
// 数据库连接状态监控
const getConnectionInfo = async () => {
    try {
        if (process.env.DATABASE_URL?.includes("sqlite")) {
            // SQLite连接信息
            await exports.prisma.$queryRaw `PRAGMA busy_timeout`;
            return {
                active_connections: 1, // SQLite是单连接
                total_connections: 1,
            };
        }
        // PostgreSQL连接信息
        const result = await exports.prisma.$queryRaw `SELECT 
        count(*) as active_connections,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as total_connections
      FROM pg_stat_activity 
      WHERE state = 'active'`;
        return result[0];
    }
    catch (error) {
        console.error("获取连接信息失败:", error);
        return null;
    }
};
exports.getConnectionInfo = getConnectionInfo;
exports.default = exports.prisma;
