# 数据库基础设施完整设置指南

## 📋 概述

本文档描述了律伴助手项目的完整数据库基础设施设置，包括Prisma客户端配置、迁移管理、种子数据、连接池和备份策略。

## 🔧 已完成的组件

### 1. Prisma客户端配置 ✅

**文件位置**: `src/lib/db/prisma.ts`

**功能特性**:
- 单例模式的Prisma客户端
- 开发环境日志配置
- 数据库连接健康检查
- 优雅关闭连接
- 连接状态监控
- 支持SQLite和PostgreSQL

**使用方法**:
```typescript
import { prisma, checkDatabaseConnection } from '@/lib/db/prisma';

// 使用客户端
const users = await prisma.user.findMany();

// 检查连接
const isHealthy = await checkDatabaseConnection();
```

### 2. 数据库迁移脚本 ✅

**文件位置**: 
- Schema: `prisma/schema.prisma`
- 配置: `prisma.config.ts`
- 种子数据: `prisma/seed.ts`

**功能特性**:
- 支持PostgreSQL和SQLite
- 自动迁移管理
- 种子数据创建
- 环境特定配置

**使用方法**:
```bash
# 生成客户端
npm run db:generate

# 创建迁移
npm run db:migrate -- --name migration_name

# 重置数据库
npm run db:reset

# 运行种子数据
npm run db:seed

# 打开数据库管理界面
npm run db:studio
```

### 3. 数据库种子数据 ✅

**文件位置**: `prisma/seed.ts`

**包含数据**:
- 测试用户 (test@example.com, admin@example.com)
- 示例文档和分析
- 聊天记录和AI交互
- OAuth账户和会话示例

**使用方法**:
```bash
# 运行种子数据
npm run db:seed
```

### 4. 数据库连接池 ✅

**文件位置**: `src/lib/db/connection-pool.ts`

**功能特性**:
- 连接池配置管理
- 实时连接监控
- 连接池预热
- 优雅关闭
- 健康检查和警告

**配置参数**:
```env
DATABASE_POOL_MIN=2      # 最小连接数
DATABASE_POOL_MAX=10     # 最大连接数
```

**使用方法**:
```typescript
import { 
  getPoolStats, 
  checkPoolHealth, 
  warmupConnectionPool, 
  poolMonitor 
} from '@/lib/db/connection-pool';

// 获取连接池统计
const stats = await getPoolStats();

// 健康检查
const isHealthy = await checkPoolHealth();

// 启动监控
poolMonitor.start();
```

### 5. 数据库备份策略 ✅

**文件位置**: `scripts/backup-database.ts`

**功能特性**:
- 自动备份创建
- 备份验证
- 过期备份清理
- 压缩支持
- 备份历史管理

**配置参数**:
```env
BACKUP_DIR=./backups                    # 备份目录
BACKUP_RETENTION_DAYS=7               # 保留天数
BACKUP_COMPRESSION_ENABLED=true         # 启用压缩
```

**使用方法**:
```bash
# 手动备份
npm run db:backup

# 定时备份（需要配置cron）
npm run db:schedule-backup
```

## 🚀 快速开始

### 1. 设置本地PostgreSQL（推荐）

```bash
# 启动PostgreSQL容器
docker run --name legal-debate-postgres \
  -e POSTGRES_DB=legal_debate_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# 创建测试数据库
docker exec legal-debate-postgres psql -U postgres -c "CREATE DATABASE legal_debate_test;"
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并根据需要修改：

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/legal_debate_dev"
TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/legal_debate_test"
```

### 3. 初始化数据库

```bash
# 生成Prisma客户端
npm run db:generate

# 运行迁移
npm run db:migrate -- --name init

# 填充种子数据
npm run db:seed
```

### 4. 验证设置

```bash
# 检查数据库连接
npm run db:studio

# 查看数据
npm run db:seed
```

## 📊 监控和维护

### 连接池监控

```typescript
// 在应用启动时
import { poolMonitor } from '@/lib/db/connection-pool';

// 启动监控（开发环境）
if (process.env.NODE_ENV === 'development') {
  poolMonitor.start();
}

// 在应用关闭时
process.on('SIGINT', async () => {
  poolMonitor.stop();
  await gracefulShutdown();
});
```

### 备份自动化

设置定时备份（使用cron）：

```bash
# 每天凌晨2点备份
0 2 * * * cd /path/to/project && npm run db:schedule-backup
```

### 健康检查

```typescript
import { checkDatabaseConnection, checkPoolHealth } from '@/lib/db/prisma';
import { checkPoolHealth } from '@/lib/db/connection-pool';

// 定期健康检查
setInterval(async () => {
  const dbHealthy = await checkDatabaseConnection();
  const poolHealthy = await checkPoolHealth();
  
  if (!dbHealthy || !poolHealthy) {
    // 发送告警
    console.error('数据库健康检查失败');
  }
}, 60000); // 每分钟检查一次
```

## 🔧 故障排除

### 常见问题

1. **连接被拒绝**
   - 确保PostgreSQL正在运行
   - 检查端口5432是否可用
   - 验证防火墙设置

2. **认证失败**
   - 检查数据库URL中的用户名和密码
   - 确保数据库用户具有适当权限

3. **迁移失败**
   - 确保数据库存在
   - 检查数据库URL格式
   - 验证Prisma schema语法

4. **备份失败**
   - 确保pg_dump已安装
   - 检查磁盘空间
   - 验证写入权限

### 调试命令

```bash
# 检查数据库连接
psql "postgresql://postgres:password@localhost:5432/legal_debate_dev"

# 查看Prisma配置
npx prisma validate

# 手动运行迁移
npx prisma migrate dev --name test

# 查看生成的SQL
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
```

## 📝 最佳实践

1. **开发环境**：使用本地PostgreSQL容器
2. **测试环境**：使用独立的测试数据库
3. **生产环境**：使用外部PostgreSQL服务
4. **备份策略**：每日自动备份 + 7天保留期
5. **监控**：连接池监控 + 健康检查
6. **安全性**：使用环境变量存储敏感信息

## 🔄 下一步

数据库基础设施已完成，建议下一步：
1. 设置Redis缓存基础设施
2. 完善AI客户端类型定义
3. 开始核心功能开发
