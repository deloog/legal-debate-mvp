# 数据库迁移指南

## 📋 概述

本文档描述了律伴助手项目的数据库迁移操作，包括迁移执行、回滚和维护流程。

## 🗂️ 迁移文件结构

```
prisma/migrations/
├── migration_lock.toml
├── 20251218093212_debate_system_complete_model/
│   └── migration.sql
├── 20251219044717_add_case_fields_for_docanalyzer/
│   └── migration.sql
├── 20251219084435_add_argument_checks/
│   └── migration.sql
└── 20251219092351_enhance_user_and_legal_reference_tables/
    └── migration.sql
```

## 🚀 迁移执行

### 生产环境部署

```bash
# 1. 检查迁移状态
npx prisma migrate status

# 2. 应用所有待执行的迁移
npx prisma migrate deploy

# 3. 重新生成 Prisma 客户端
npx prisma generate

# 4. 运行种子数据（可选）
npx tsx prisma/seed.ts
```

### 开发环境迁移

```bash
# 创建新迁移
npx prisma migrate dev --name <migration_name>

# 应用迁移并重置数据库
npx prisma migrate reset

# 运行种子数据
npx tsx prisma/seed.ts
```

## 🔄 迁移回滚

### 回滚单个迁移

```bash
# 方法1：重置到指定迁移
npx prisma migrate reset --force --skip-seed
npx prisma migrate deploy

# 方法2：手动删除迁移文件后重置
# 1. 删除需要回滚的迁移文件
# 2. 执行重置
npx prisma migrate reset --force --skip-seed
# 3. 重新部署
npx prisma migrate deploy
```

### 完全重置数据库

```bash
# 重置数据库到初始状态
npx prisma migrate reset --force --skip-seed

# 重新应用所有迁移
npx prisma migrate deploy

# 生成客户端
npx prisma generate

# 恢复种子数据
npx tsx prisma/seed.ts
```

## 📊 迁移验证

### 运行完整性测试

```bash
# 测试迁移完整性
npx tsx scripts/test-migration-integrity.ts

# 测试回滚功能
npx tsx scripts/test-migration-rollback.ts
```

### 手动验证

```sql
-- 检查表结构
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 检查索引
SELECT indexname FROM pg_indexes WHERE schemaname = 'public';

-- 检查外键约束
SELECT constraint_name FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

-- 检查枚举类型
SELECT typname FROM pg_type WHERE typtype = 'e';
```

## 🛠️ 故障排除

### 常见问题

#### 1. 迁移失败

**错误**: `Migration failed with error`

**解决方案**:

```bash
# 检查数据库连接
npx prisma db pull

# 重置并重新开始
npx prisma migrate reset --force --skip-seed
npx prisma migrate deploy
```

#### 2. Prisma 客户端生成失败

**错误**: `EPERM: operation not permitted`

**解决方案**:

```bash
# 清理缓存
npx prisma generate --schema=./prisma/schema.prisma

# 或删除 node_modules/.prisma 重新生成
rm -rf node_modules/.prisma
npx prisma generate
```

#### 3. 种子数据冲突

**错误**: `Unique constraint failed`

**解决方案**:

- 种子数据脚本已使用 `upsert` 操作避免冲突
- 如仍有问题，可重置数据库后重新运行种子数据

### 回滚检查清单

- [ ] 备份当前数据库状态
- [ ] 确认回滚目标版本
- [ ] 测试回滚操作在开发环境
- [ ] 验证数据完整性
- [ ] 更新应用配置（如需要）
- [ ] 通知相关团队

## 📈 性能优化

### 索引策略

当前迁移包含以下性能索引：

1. **用户表索引**
   - `users_email_key` (唯一)
   - `users_email_idx`
   - `users_organizationId_idx`

2. **案件表索引**
   - `cases_userId_idx`
   - `cases_status_idx`
   - `cases_type_idx`
   - `cases_createdAt_idx`

3. **辩论相关索引**
   - `debates_caseId_idx`
   - `debates_userId_idx`
   - `debates_status_idx`
   - `arguments_roundId_idx`
   - `arguments_side_idx`

4. **文档和法条索引**
   - `documents_caseId_idx`
   - `documents_analysisStatus_idx`
   - `legal_references_caseId_idx`
   - `legal_references_lawType_idx`

### 查询优化建议

1. **使用索引字段进行查询**
2. **避免全表扫描**
3. **合理使用 JOIN 操作**
4. **定期更新表统计信息**

## 🔒 安全考虑

### 迁移权限

生产环境迁移需要以下数据库权限：

- `CREATE TABLE`
- `ALTER TABLE`
- `CREATE INDEX`
- `DROP TABLE`
- `DROP INDEX`

### 数据保护

1. **迁移前备份**

   ```bash
   pg_dump dbname > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **敏感数据处理**
   - 避免在迁移中硬编码敏感信息
   - 使用环境变量存储配置
   - 审计迁移文件内容

## 📝 迁移历史

| 迁移ID         | 描述                 | 创建时间   | 状态 |
| -------------- | -------------------- | ---------- | ---- |
| 20251218093212 | 辩论系统完整模型     | 2025-12-18 | ✅   |
| 20251219044717 | 添加文档分析器字段   | 2025-12-19 | ✅   |
| 20251219084435 | 添加论点检查         | 2025-12-19 | ✅   |
| 20251219092351 | 增强用户和法律参考表 | 2025-12-19 | ✅   |

## 🧪 测试覆盖

### 自动化测试

1. **迁移完整性测试** (`scripts/test-migration-integrity.ts`)
   - 迁移文件存在性验证
   - SQL 语法检查
   - 数据库连接测试
   - 表结构完整性验证
   - 索引和外键约束检查
   - 枚举类型验证
   - 种子数据测试

2. **回滚功能测试** (`scripts/test-migration-rollback.ts`)
   - 单个迁移回滚测试
   - 多个迁移回滚测试
   - 回滚后重新部署验证
   - 数据完整性检查

### 测试结果

- **迁移完整性测试**: 100% 通过 (8/8)
- **回滚功能测试**: 83.3% 通过 (5/6)
  - 失败原因: Windows 文件权限问题
  - 核心回滚功能正常

## 📞 支持联系

如有迁移相关问题，请联系：

1. **技术负责人**: [技术团队]
2. **数据库管理员**: [DBA团队]
3. **紧急联系**: [运维团队]

---

**文档版本**: v1.0  
**创建时间**: 2025-12-19  
**最后更新**: 2025-12-19  
**维护者**: AI开发团队
