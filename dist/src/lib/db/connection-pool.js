"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionPoolConfig = exports.poolMonitor = exports.ConnectionPoolMonitor = exports.gracefulShutdown = exports.warmupConnectionPool = exports.checkPoolHealth = exports.getPoolStats = exports.ConnectionStatus = void 0;
const prisma_1 = require("./prisma");
// 连接池状态枚举
var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus["IDLE"] = "idle";
    ConnectionStatus["ACTIVE"] = "active";
    ConnectionStatus["WAITING"] = "waiting";
    ConnectionStatus["ERROR"] = "error";
})(ConnectionStatus || (exports.ConnectionStatus = ConnectionStatus = {}));
// 默认连接池配置
const defaultPoolConfig = {
    minConnections: parseInt(process.env.DATABASE_POOL_MIN || "2", 10),
    maxConnections: parseInt(process.env.DATABASE_POOL_MAX || "20", 10),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    maxLifetimeHours: 24,
    acquireTimeoutMillis: 30000, // 连接获取超时
    createTimeoutMillis: 5000, // 连接创建超时
    destroyTimeoutMillis: 5000, // 连接销毁超时
    reapIntervalMillis: 1000, // 连接回收检查间隔
    createRetryIntervalMillis: 200, // 创建重试间隔
};
exports.connectionPoolConfig = defaultPoolConfig;
// 获取连接池统计信息
const getPoolStats = async () => {
    try {
        const connectionInfo = await (0, prisma_1.getConnectionInfo)();
        if (!connectionInfo) {
            return null;
        }
        const activeConnections = Number(connectionInfo.active_connections);
        const totalConnections = Number(connectionInfo.total_connections);
        const idleConnections = Math.max(0, totalConnections - activeConnections);
        const maxConnections = defaultPoolConfig.maxConnections;
        const connectionUtilization = totalConnections / maxConnections;
        return {
            activeConnections,
            idleConnections,
            totalConnections,
            waitingClients: 0, // PostgreSQL不直接提供此信息
            maxConnections,
            connectionUtilization,
            averageWaitTime: 0, // 需要从Prisma获取更详细信息
            totalWaitTime: 0,
            connectionErrors: 0, // 需要从错误计数器获取
        };
    }
    catch (error) {
        console.error("获取连接池统计信息失败:", error);
        return null;
    }
};
exports.getPoolStats = getPoolStats;
// 连接池健康检查
const checkPoolHealth = async () => {
    try {
        // 执行简单查询来测试连接池健康状态
        await prisma_1.prisma.$queryRaw `SELECT 1 as health_check`;
        const stats = await (0, exports.getPoolStats)();
        if (!stats) {
            return false;
        }
        // 检查是否达到最大连接数的80%
        const connectionUtilization = stats.activeConnections / stats.maxConnections;
        if (connectionUtilization > 0.8) {
            console.warn("连接池使用率过高:", connectionUtilization);
        }
        return true;
    }
    catch (error) {
        console.error("连接池健康检查失败:", error);
        return false;
    }
};
exports.checkPoolHealth = checkPoolHealth;
// 连接池预热（如果支持）
const warmupConnectionPool = async () => {
    try {
        const promises = [];
        // 创建几个并发连接来预热连接池
        for (let i = 0; i < defaultPoolConfig.minConnections; i++) {
            promises.push(prisma_1.prisma.$queryRaw `SELECT ${i} as warmup_query`);
        }
        await Promise.all(promises);
        console.log(`连接池预热完成，创建了 ${defaultPoolConfig.minConnections} 个连接`);
    }
    catch (error) {
        console.error("连接池预热失败:", error);
    }
};
exports.warmupConnectionPool = warmupConnectionPool;
// 优雅关闭连接池
const gracefulShutdown = async () => {
    try {
        console.log("开始优雅关闭数据库连接池...");
        // 等待所有活跃操作完成
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // 关闭所有连接
        await prisma_1.prisma.$disconnect();
        console.log("数据库连接池已优雅关闭");
    }
    catch (error) {
        console.error("关闭连接池时出错:", error);
        throw error;
    }
};
exports.gracefulShutdown = gracefulShutdown;
// 连接池监控器
class ConnectionPoolMonitor {
    constructor() {
        this.interval = null;
        this.checkIntervalMs = 30000; // 30秒检查一次
    }
    start() {
        if (this.interval) {
            return;
        }
        console.log("启动连接池监控器");
        this.interval = setInterval(async () => {
            const stats = await (0, exports.getPoolStats)();
            if (stats) {
                console.log("连接池状态:", {
                    active: stats.activeConnections,
                    total: stats.totalConnections,
                    utilization: `${((stats.activeConnections / stats.maxConnections) * 100).toFixed(1)}%`,
                });
            }
            const isHealthy = await (0, exports.checkPoolHealth)();
            if (!isHealthy) {
                console.error("连接池健康检查失败");
            }
        }, this.checkIntervalMs);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log("连接池监控器已停止");
        }
    }
}
exports.ConnectionPoolMonitor = ConnectionPoolMonitor;
// 创建全局监控器实例
exports.poolMonitor = new ConnectionPoolMonitor();
