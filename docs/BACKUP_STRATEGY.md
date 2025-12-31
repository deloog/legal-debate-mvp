# 律伴助手 数据备份策略文档

## 📋 策略概述

本文档详细描述了律伴助手系统的数据备份策略、恢复流程和数据一致性保证机制。通过自动化的备份恢复系统，确保法律辩论数据的完整性、可用性和可恢复性。

### 核心目标

1. **数据完整性**：确保备份数据的完整性和一致性
2. **可用性**：保证系统故障时能够快速恢复
3. **安全性**：保护敏感法律数据的安全
4. **可审计性**：提供完整的备份恢复操作记录

## 🏗️ 备份架构设计

### 备份组件架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   应用层        │    │   备份管理器    │    │   存储层        │
│                 │    │                 │    │                 │
│ - 定时任务      │───▶│ - 备份调度      │───▶│ - 本地存储      │
│ - 手动触发      │    │ - 压缩优化      │    │ - 文件管理      │
│ - 监控告警      │    │ - 验证检查      │    │ - 清理策略      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   恢复管理器    │
                       │                 │
                       │ - 数据库恢复    │
                       │ - 验证检查      │
                       │ - 一致性验证    │
                       └─────────────────┘
```

### 技术栈

- **数据库**：PostgreSQL 15+
- **备份工具**：pg_dump / pg_restore
- **存储**：本地文件系统（可扩展至云存储）
- **调度**：Node.js 定时任务
- **监控**：日志记录 + 健康检查

## 🔄 自动备份机制

### 备份策略配置

```typescript
interface BackupConfig {
  databaseUrl: string; // 数据库连接URL
  backupDir: string; // 备份存储目录
  retentionDays: number; // 备份保留天数
  compressionEnabled: boolean; // 是否启用压缩
}
```

### 备份类型

#### 1. 全量备份（默认）

- **频率**：每日凌晨2:00
- **范围**：完整数据库
- **格式**：PostgreSQL custom format
- **压缩**：启用（level 9）
- **验证**：自动完整性检查

#### 2. 增量备份（计划）

- **频率**：每小时
- **范围**：变更数据
- **方式**：WAL归档
- **恢复**：依赖全量备份

### 备份文件命名规范

```
{database}_backup_{timestamp}.sql

示例：
legal_debate_dev_backup_2025-12-20T02-00-00-000Z.sql
```

### 备份调度配置

```typescript
// 每日定时备份
export const scheduleBackup = async (): Promise<void> => {
  const backupManager = createBackupManager();

  console.log("开始定时数据库备份...");

  // 创建备份
  const backupInfo = await backupManager.createBackup();

  if (backupInfo.success) {
    // 验证备份
    const isValid = await backupManager.verifyBackup(backupInfo.filename);
    if (!isValid) {
      console.error("备份验证失败，删除无效备份文件");
      // 删除无效备份文件的逻辑可以在这里添加
    }
  }

  // 清理过期备份
  await backupManager.cleanupOldBackups();

  console.log("定时备份完成");
};
```

## 🛠️ 恢复流程验证

### 恢复类型

#### 1. 完整恢复

- **场景**：系统完全故障
- **方式**：从最新全量备份恢复
- **时间**：30-60分钟（取决于数据量）

#### 2. 时间点恢复

- **场景**：数据误删除
- **方式**：WAL + 全量备份
- **精度**：秒级

#### 3. 选择性恢复

- **场景**：部分数据损坏
- **方式**：表级恢复
- **范围**：指定表或数据

### 恢复流程

```mermaid
flowchart TD
    A[开始恢复] --> B[验证备份文件]
    B --> C[备份文件有效?]
    C -->|否| D[报错终止]
    C -->|是| E[准备目标数据库]
    E --> F[需要创建数据库?]
    F -->|是| G[创建新数据库]
    F -->|否| H[清空现有数据库]
    G --> I[执行数据恢复]
    H --> I
    I --> J[恢复完成?]
    J -->|否| K[回滚操作]
    J -->|是| L[验证数据一致性]
    L --> M[一致性检查通过?]
    M -->|否| N[标记恢复失败]
    M -->|是| O[恢复成功]
    K --> P[记录失败日志]
    N --> P
    O --> Q[记录成功日志]
```

### 恢复操作步骤

#### 步骤1：选择备份文件

```bash
# 列出可用备份
npm run db:list-backups

# 输出示例：
# 1. legal_debate_dev_backup_2025-12-20T02-00-00-000Z.sql (15.2 MB)
# 2. legal_debate_dev_backup_2025-12-19T02-00-00-000Z.sql (14.8 MB)
```

#### 步骤2：执行恢复

```bash
# 交互式恢复（使用最新备份）
npm run db:restore

# 或者指定具体恢复参数
RESTORE_TARGET_DATABASE=legal_debate_restored \
RESTORE_CREATE_TARGET_DB=true \
RESTORE_DROP_EXISTING_DB=true \
npm run db:restore
```

#### 步骤3：验证恢复结果

```bash
# 运行恢复验证测试
npm run test:backup-recovery
```

## 🔍 数据一致性保证

### 一致性检查机制

#### 1. 备份时一致性

- **事务一致性**：使用PostgreSQL事务确保数据一致性
- **时间点快照**：pg_dump提供一致性快照
- **外键约束**：保持引用完整性

#### 2. 恢复时一致性

- **完整性验证**：pg_restore验证备份文件完整性
- **结构检查**：验证表结构和约束
- **数据验证**：记录数量和内容验证

#### 3. 运行时一致性

- **定期检查**：自动数据一致性检查
- **监控告警**：异常数据状态告警
- **修复机制**：自动修复常见问题

### 一致性验证实现

```typescript
interface ConsistencyCheck {
  tableCount: number;           // 表数量
  recordCounts: Record<string, number>;  // 各表记录数
  foreignKeyChecks: boolean;    // 外键约束检查
  indexChecks: boolean;         // 索引检查
}

// 数据一致性检查
async checkDatabaseConsistency(databaseName: string): Promise<ConsistencyCheck> {
  // 获取表数量
  const tableCountCommand = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';`;

  // 获取每张表的记录数
  const recordCounts: Record<string, number> = {};
  const tableNames = await getTableNames(databaseName);

  for (const tableName of tableNames) {
    const countCommand = `SELECT COUNT(*) FROM ${tableName};`;
    recordCounts[tableName] = await executeCountQuery(countCommand);
  }

  return {
    tableCount,
    recordCounts,
    foreignKeyChecks: await checkForeignKeys(databaseName),
    indexChecks: await checkIndexes(databaseName),
  };
}
```

### 数据完整性验证

#### 1. 备份文件验证

```typescript
// 验证备份文件完整性
async verifyBackup(filename: string): Promise<boolean> {
  try {
    const filepath = path.join(this.config.backupDir, filename);
    const stats = await fs.stat(filepath);

    if (stats.size === 0) {
      return false;
    }

    // 使用pg_restore验证备份文件
    const verifyCommand = `pg_restore --list "${filepath}"`;
    await execAsync(verifyCommand);

    return true;
  } catch (error) {
    console.error(`验证备份 ${filename} 失败:`, error);
    return false;
  }
}
```

#### 2. 恢复后验证

```typescript
// 验证恢复后的数据库
async validateRestoredDatabase(databaseName: string): Promise<boolean> {
  try {
    // 检查数据库是否存在
    await checkDatabaseExists(databaseName);

    // 获取表数量
    const tableCount = await getTableCount(databaseName);

    return tableCount > 0;
  } catch (error) {
    console.error(`数据库验证失败 ${databaseName}:`, error);
    return false;
  }
}
```

## 📊 监控和告警

### 备份监控指标

#### 1. 备份成功率

- **指标**：备份成功次数 / 总备份次数
- **阈值**：> 95%
- **告警**：< 90%

#### 2. 备份大小趋势

- **指标**：备份文件大小变化
- **阈值**：异常增长 > 50%
- **告警**：突然增长或缩小

#### 3. 备份耗时

- **指标**：备份执行时间
- **阈值**：< 30分钟
- **告警**：> 45分钟

#### 4. 存储使用率

- **指标**：备份目录使用空间
- **阈值**：< 80%
- **告警**：> 85%

### 告警配置

```typescript
interface BackupAlert {
  type: 'failure' | 'performance' | 'storage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  details?: any;
}

// 告警示例
{
  type: 'failure',
  severity: 'high',
  message: '数据库备份失败：连接超时',
  timestamp: '2025-12-20T02:05:00Z',
  details: {
    backupId: 'backup_1703040300000',
    error: 'Connection timeout after 30000ms',
    duration: 30000
  }
}
```

### 监控实现

```typescript
// 备份监控
export class BackupMonitor {
  async checkBackupHealth(): Promise<BackupAlert[]> {
    const alerts: BackupAlert[] = [];

    // 检查最近备份状态
    const recentBackups = await this.getRecentBackups(24); // 24小时内
    const failureRate = this.calculateFailureRate(recentBackups);

    if (failureRate > 0.1) {
      // 失败率 > 10%
      alerts.push({
        type: "failure",
        severity: "high",
        message: `备份失败率过高: ${(failureRate * 100).toFixed(1)}%`,
        timestamp: new Date(),
      });
    }

    // 检查存储使用率
    const storageUsage = await this.getStorageUsage();
    if (storageUsage > 0.85) {
      // 使用率 > 85%
      alerts.push({
        type: "storage",
        severity: "medium",
        message: `备份存储使用率过高: ${(storageUsage * 100).toFixed(1)}%`,
        timestamp: new Date(),
      });
    }

    return alerts;
  }
}
```

## 🔧 运维操作指南

### 日常运维

#### 1. 检查备份状态

```bash
# 查看备份状态
npm run db:backup-status

# 手动执行备份
npm run db:backup

# 验证备份文件
npm run db:verify-backup <filename>
```

#### 2. 清理过期备份

```bash
# 自动清理过期备份
npm run db:cleanup-backups

# 手动清理指定天数前的备份
BACKUP_RETENTION_DAYS=3 npm run db:cleanup-backups
```

#### 3. 恢复测试

```bash
# 运行完整备份恢复测试
npm run test:backup-recovery

# 运行恢复测试（不清理测试数据）
TEST_CLEANUP_AFTER=false npm run test:backup-recovery
```

### 应急处理

#### 1. 系统故障恢复

```bash
# 1. 评估故障范围
npm run db:check-status

# 2. 选择恢复策略
npm run db:list-backups

# 3. 执行恢复
RESTORE_TARGET_DATABASE=legal_debate_emergency \
RESTORE_CREATE_TARGET_DB=true \
npm run db:restore

# 4. 验证恢复结果
npm run test:data-consistency
```

#### 2. 数据误删除恢复

```bash
# 1. 停止应用服务
npm run stop

# 2. 恢复到指定时间点
RESTORE_TARGET_TIME="2025-12-20T10:30:00Z" \
npm run db:point-in-time-restore

# 3. 重启应用服务
npm run start
```

### 性能优化

#### 1. 备份性能优化

- **并行备份**：启用pg_dump并行选项
- **压缩优化**：调整压缩级别
- **网络优化**：使用本地连接

#### 2. 恢复性能优化

- **并行恢复**：使用pg_restore并行选项
- **内存优化**：调整work_mem参数
- **索引重建**：恢复后重建索引

## 📋 备份策略配置

### 环境变量配置

```bash
# 数据库配置
DATABASE_URL=postgresql://postgres:password@localhost:5432/legal_debate_dev

# 备份配置
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=7
BACKUP_COMPRESSION_ENABLED=true

# 恢复配置
RESTORE_TARGET_DATABASE=legal_debate_restored
RESTORE_CREATE_TARGET_DB=true
RESTORE_DROP_EXISTING_DB=true

# 测试配置
TEST_ORIGINAL_DATABASE=legal_debate_dev
TEST_TARGET_DATABASE=legal_debate_test_restore
TEST_CLEANUP_AFTER=true
```

### 调度配置

```json
{
  "backupSchedule": {
    "fullBackup": {
      "cron": "0 2 * * *",
      "enabled": true,
      "retentionDays": 7
    },
    "incrementalBackup": {
      "cron": "0 * * * *",
      "enabled": false,
      "retentionDays": 1
    }
  },
  "monitoring": {
    "healthCheckInterval": 300000,
    "alertThresholds": {
      "failureRate": 0.1,
      "storageUsage": 0.85,
      "backupDuration": 2700000
    }
  }
}
```

## 🧪 测试验证

### 测试策略

#### 1. 单元测试

- **覆盖率**：> 90%
- **范围**：备份、恢复、验证功能
- **频率**：每次代码提交

#### 2. 集成测试

- **范围**：完整备份恢复流程
- **环境**：独立测试数据库
- **频率**：每日自动执行

#### 3. 恢复测试

- **范围**：数据一致性验证
- **深度**：生产数据恢复测试
- **频率**：每周执行

### 测试用例

```typescript
// 备份功能测试
test("should create backup successfully", async () => {
  const backupManager = createBackupManager();
  const backupInfo = await backupManager.createBackup();

  expect(backupInfo.success).toBe(true);
  expect(backupInfo.size).toBeGreaterThan(0);
});

// 恢复功能测试
test("should restore database successfully", async () => {
  const restoreManager = createRestoreManager();
  const restoreInfo = await restoreManager.restoreDatabase("test_backup.sql");

  expect(restoreInfo.success).toBe(true);
  expect(restoreInfo.tablesRestored).toBeGreaterThan(0);
});

// 数据一致性测试
test("should maintain data consistency", async () => {
  const originalData = await getDatabaseData("original_db");
  await restoreDatabase("test_backup.sql");
  const restoredData = await getDatabaseData("restored_db");

  expect(originalData).toEqual(restoredData);
});
```

## 📈 性能指标

### 基准性能

#### 备份性能

- **小数据库**（< 1GB）：2-5分钟
- **中数据库**（1-10GB）：5-20分钟
- **大数据库**（> 10GB）：20-60分钟

#### 恢复性能

- **小数据库**（< 1GB）：1-3分钟
- **中数据库**（1-10GB）：3-15分钟
- **大数据库**（> 10GB）：15-45分钟

### 性能优化建议

1. **硬件优化**
   - 使用SSD存储
   - 增加内存配置
   - 优化网络带宽

2. **软件优化**
   - 调整PostgreSQL参数
   - 使用并行处理
   - 优化压缩算法

3. **架构优化**
   - 分布式备份
   - 增量备份策略
   - 智能调度算法

## 🔒 安全考虑

### 数据安全

#### 1. 加密存储

- **传输加密**：SSL/TLS
- **存储加密**：AES-256
- **密钥管理**：定期轮换

#### 2. 访问控制

- **权限管理**：最小权限原则
- **审计日志**：完整操作记录
- **身份验证**：多因子认证

#### 3. 合规要求

- **数据保留**：符合法规要求
- **隐私保护**：个人信息保护
- **审计追踪**：可追溯性

### 安全实现

```typescript
// 备份加密配置
interface BackupSecurityConfig {
  encryptionEnabled: boolean;
  encryptionKey: string;
  accessControl: {
    allowedUsers: string[];
    permissions: string[];
  };
  auditLog: boolean;
}

// 安全备份实现
export class SecureBackupManager extends DatabaseBackupManager {
  async createSecureBackup(): Promise<BackupInfo> {
    // 创建备份
    const backupInfo = await this.createBackup();

    // 加密备份文件
    if (this.securityConfig.encryptionEnabled) {
      await this.encryptBackupFile(backupInfo.filename);
    }

    // 记录审计日志
    if (this.securityConfig.auditLog) {
      await this.logBackupOperation(backupInfo);
    }

    return backupInfo;
  }
}
```

## 📝 故障排除

### 常见问题

#### 1. 备份失败

```
问题：备份文件大小为0
原因：权限不足或磁盘空间不足
解决：检查文件权限和磁盘空间
```

#### 2. 恢复失败

```
问题：无法连接到目标数据库
原因：数据库服务未启动或网络问题
解决：检查数据库状态和网络连接
```

#### 3. 数据不一致

```
问题：恢复后数据不完整
原因：备份文件损坏或不完整
解决：验证备份文件完整性
```

### 诊断工具

```bash
# 检查数据库连接
npm run db:check-connection

# 验证备份文件
npm run db:verify-backup <filename>

# 检查数据一致性
npm run db:check-consistency

# 查看备份日志
npm run db:backup-logs
```

## 📚 参考文档

### 相关文档

- [数据库迁移指南](./MIGRATION_GUIDE.md)
- [测试策略文档](./TEST_STRATEGY.md)
- [业务需求文档](./BUSINESS_REQUIREMENTS.md)

### 外部资源

- [PostgreSQL备份恢复文档](https://www.postgresql.org/docs/current/backup.html)
- [pg_dump使用手册](https://www.postgresql.org/docs/current/app-pgdump.html)
- [pg_restore使用手册](https://www.postgresql.org/docs/current/app-pgrestore.html)

---

_文档版本：v1.0_
_创建时间：2025-12-20_
_最后更新：2025-12-20_
_维护者：AI开发团队_
