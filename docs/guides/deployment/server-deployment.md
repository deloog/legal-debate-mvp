# 服务器部署快速指南

## 概述

本指南提供了将法律法规数据快速部署到生产服务器的步骤。

## 前提条件

- ✅ 本地数据已完成迁移和测试
- ✅ 服务器已安装 PostgreSQL
- ✅ 服务器已部署应用代码
- ✅ 服务器已运行 `npx prisma migrate deploy`

## 快速部署（推荐）⚡

### 步骤1：本地导出数据

```bash
# 在本地运行导出脚本
cd d:\legal_debate_mvp
bash scripts/export-npc-data.sh
```

**输出文件**：
- `backups/law_articles_npc_YYYYMMDD_HHMMSS.sql.gz` - SQL 备份文件
- `backups/law_articles_npc_YYYYMMDD_HHMMSS.csv.gz` - CSV 文件（可选）
- `backups/import_on_server.sh` - 服务器导入脚本

**预计时间**：5-10 分钟

---

### 步骤2：上传到服务器

```bash
# 上传备份文件和导入脚本
scp backups/law_articles_npc_*.sql.gz user@your-server:/tmp/
scp backups/import_on_server.sh user@your-server:/tmp/
```

**预计时间**：10-30 分钟（取决于网络速度）

---

### 步骤3：在服务器上导入

```bash
# SSH 连接到服务器
ssh user@your-server

# 进入临时目录
cd /tmp

# 赋予执行权限
chmod +x import_on_server.sh

# 执行导入（自动解压、导入、创建索引）
./import_on_server.sh law_articles_npc_*.sql.gz
```

**预计时间**：5-10 分钟

---

### 步骤4：验证数据

```bash
# 进入应用目录
cd /path/to/your/app

# 运行验证脚本
npx tsx scripts/import-data/verify-npc-import.ts
```

**预计时间**：1-2 分钟

---

## 总计时间

**20-50 分钟** ✅（而不是几天！）

---

## 备选方案：使用 CSV 导入（更快）

如果 SQL 导入速度慢，可以使用 CSV 方式：

### 步骤1：上传 CSV 文件

```bash
scp backups/law_articles_npc_*.csv.gz user@your-server:/tmp/
```

### 步骤2：在服务器上导入

```bash
ssh user@your-server

# 解压 CSV
cd /tmp
gunzip law_articles_npc_*.csv.gz

# 使用 COPY 命令导入
psql -U postgres -d legal_debate_mvp << 'EOF'
\COPY "LawArticle" FROM '/tmp/law_articles_npc_*.csv' WITH CSV HEADER;
EOF
```

**预计时间**：2-5 分钟 ⚡

---

## 性能优化

### 导入前优化

```sql
-- 临时禁用自动清理
ALTER TABLE "LawArticle" SET (autovacuum_enabled = false);

-- 增加维护工作内存
SET maintenance_work_mem = '1GB';
```

### 导入后优化

```sql
-- 重新启用自动清理
ALTER TABLE "LawArticle" SET (autovacuum_enabled = true);

-- 分析表
VACUUM ANALYZE "LawArticle";

-- 创建索引（如果导入脚本未创建）
CREATE INDEX CONCURRENTLY idx_law_article_data_source
  ON "LawArticle"("dataSource");

CREATE INDEX CONCURRENTLY idx_law_article_law_name
  ON "LawArticle"("lawName");

CREATE INDEX CONCURRENTLY idx_law_article_searchable_text
  ON "LawArticle" USING gin(to_tsvector('chinese', "searchableText"));
```

---

## 故障排查

### 问题1：导入速度慢

**解决方案**：
1. 使用 CSV 导入代替 SQL
2. 临时增加 PostgreSQL 的 `maintenance_work_mem`
3. 在导入前删除索引，导入后重建

### 问题2：磁盘空间不足

**解决方案**：
1. 检查服务器磁盘空间：`df -h`
2. 清理不必要的文件
3. 使用流式导入（不解压直接导入）

```bash
gunzip -c law_articles_npc_*.sql.gz | psql -U postgres -d legal_debate_mvp
```

### 问题3：权限错误

**解决方案**：
1. 确保数据库用户有写入权限
2. 检查文件权限：`chmod 644 law_articles_npc_*.sql`

---

## 监控导入进度

在另一个终端窗口中监控：

```bash
# 监控表大小
watch -n 5 "psql -U postgres -d legal_debate_mvp -c \"SELECT COUNT(*) FROM \\\"LawArticle\\\" WHERE \\\"dataSource\\\" = 'npc';\""

# 监控数据库活动
psql -U postgres -d legal_debate_mvp -c "SELECT * FROM pg_stat_activity WHERE datname = 'legal_debate_mvp';"
```

---

## 回滚方案

如果导入出现问题，可以快速回滚：

```sql
-- 删除所有 NPC 数据
DELETE FROM "LawArticle" WHERE "dataSource" = 'npc';

-- 或者恢复到导入前的备份
-- (假设你在导入前做了备份)
```

---

## 最佳实践

1. ✅ **导入前备份**：在服务器上导入前，先备份现有数据
2. ✅ **测试环境验证**：先在测试环境验证导入流程
3. ✅ **监控资源**：导入期间监控 CPU、内存、磁盘使用
4. ✅ **非高峰时段**：选择业务低峰时段进行导入
5. ✅ **验证数据**：导入后立即验证数据完整性

---

## 自动化部署脚本

创建一个完整的自动化部署脚本：

```bash
#!/bin/bash
# deploy-to-server.sh

set -e

SERVER="user@your-server"
APP_DIR="/path/to/app"
BACKUP_FILE="backups/law_articles_npc_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "🚀 开始自动化部署..."

# 1. 本地导出
echo "📦 导出数据..."
bash scripts/export-npc-data.sh

# 2. 上传到服务器
echo "📤 上传到服务器..."
scp "$BACKUP_FILE" "$SERVER:/tmp/"
scp backups/import_on_server.sh "$SERVER:/tmp/"

# 3. 在服务器上执行导入
echo "📥 在服务器上导入..."
ssh "$SERVER" << EOF
  cd /tmp
  chmod +x import_on_server.sh
  ./import_on_server.sh $(basename "$BACKUP_FILE")
EOF

# 4. 验证
echo "🔍 验证数据..."
ssh "$SERVER" << EOF
  cd "$APP_DIR"
  npx tsx scripts/import-data/verify-npc-import.ts
EOF

echo "✨ 部署完成！"
```

使用方法：

```bash
chmod +x deploy-to-server.sh
./deploy-to-server.sh
```

---

## 总结

### 推荐流程

1. **本地导出**（5-10 分钟）
   ```bash
   bash scripts/export-npc-data.sh
   ```

2. **上传到服务器**（10-30 分钟）
   ```bash
   scp backups/*.sql.gz user@server:/tmp/
   ```

3. **服务器导入**（5-10 分钟）
   ```bash
   ssh user@server
   ./import_on_server.sh law_articles_npc_*.sql.gz
   ```

4. **验证数据**（1-2 分钟）
   ```bash
   npx tsx scripts/import-data/verify-npc-import.ts
   ```

### 总时间：20-50 分钟 ✅

**不需要几天！** 🎉
