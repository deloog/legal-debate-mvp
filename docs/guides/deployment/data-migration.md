# 数据迁移问题解决方案

## 问题1：种子数据混淆

### 当前状态
根据检查，数据库中的数据源分布：
- **npc**: 681,722 条（国家法律法规库数据）✅
- **local**: 1 条（种子数据）⚠️

### 解决方案

#### 方案A：清理种子数据（推荐）
如果种子数据不重要，可以直接删除：

```bash
# 删除所有非 npc 来源的数据
npx tsx scripts/cleanup-seed-data.ts
```

#### 方案B：保留种子数据
如果需要保留种子数据，可以通过 `dataSource` 字段区分：

```typescript
// 查询时只查询 npc 数据
const npcArticles = await prisma.lawArticle.findMany({
  where: { dataSource: 'npc' }
});
```

### 清理脚本

创建 `scripts/cleanup-seed-data.ts`：

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 清理种子数据...\n');

  // 统计要删除的数据
  const count = await prisma.lawArticle.count({
    where: {
      dataSource: { not: 'npc' }
    }
  });

  console.log(`⚠️  将删除 ${count} 条非 NPC 数据`);
  console.log('   按 Ctrl+C 取消，或等待 5 秒后自动执行...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // 删除非 npc 数据
  const result = await prisma.lawArticle.deleteMany({
    where: {
      dataSource: { not: 'npc' }
    }
  });

  console.log(`✅ 已删除 ${result.count} 条数据`);

  await prisma.$disconnect();
}

main();
```

---

## 问题2：服务器部署时的数据迁移

### 问题分析

本地迁移耗时约 **2 小时**，主要原因：
1. 逐条插入数据（976,731 条）
2. 每条都检查是否存在（去重）
3. 单机硬盘 I/O 限制

如果直接在服务器上运行相同脚本，可能需要 **更长时间**（网络延迟、服务器性能等因素）。

### 🚀 优化方案（推荐）

#### 方案1：数据库备份恢复（最快）⭐⭐⭐⭐⭐

**原理**：直接导出本地数据库，在服务器上恢复

**优点**：
- ⚡ 速度最快（几分钟内完成）
- ✅ 数据完整性有保证
- 🔒 避免重复迁移

**步骤**：

```bash
# 1. 本地导出 LawArticle 表数据
pg_dump -U your_username -d your_database \
  -t "LawArticle" \
  --data-only \
  --column-inserts \
  -f law_articles_npc.sql

# 或者使用 COPY 格式（更快）
pg_dump -U your_username -d your_database \
  -t "LawArticle" \
  --data-only \
  -f law_articles_npc.sql

# 2. 压缩文件（减小传输大小）
gzip law_articles_npc.sql
# 预计大小：50-200MB（压缩后）

# 3. 上传到服务器
scp law_articles_npc.sql.gz user@server:/path/to/backup/

# 4. 在服务器上解压并恢复
gunzip law_articles_npc.sql.gz
psql -U your_username -d your_database -f law_articles_npc.sql
```

**预计时间**：
- 导出：5-10 分钟
- 上传：10-30 分钟（取决于网络）
- 导入：5-10 分钟
- **总计：20-50 分钟** ✅

---

#### 方案2：使用 Prisma Migrate + 种子数据

**原理**：将 SQLite 数据库上传到服务器，在服务器上运行迁移脚本

**优点**：
- 📦 可重复执行
- 🔄 便于版本控制

**步骤**：

```bash
# 1. 上传 SQLite 数据库到服务器
scp d:/pldowns/npc_laws.db user@server:/path/to/data/

# 2. 上传迁移脚本
scp -r scripts/import-data user@server:/path/to/app/scripts/

# 3. 在服务器上运行迁移
ssh user@server
cd /path/to/app
npm install better-sqlite3
npx tsx scripts/import-data/import-npc-laws.ts
```

**预计时间**：
- 上传 SQLite（~500MB）：30-60 分钟
- 运行迁移：2-3 小时
- **总计：2.5-4 小时** ⚠️

---

#### 方案3：批量导入优化（中等速度）

**原理**：优化迁移脚本，使用批量插入

**优点**：
- ⚡ 比逐条插入快 10-50 倍
- 🔄 可重复执行

**实现**：

创建 `scripts/import-data/import-npc-laws-batch.ts`：

```typescript
// 使用 createMany 批量插入
const BATCH_SIZE = 1000;

for (let i = 0; i < articles.length; i += BATCH_SIZE) {
  const batch = articles.slice(i, i + BATCH_SIZE);

  await prisma.lawArticle.createMany({
    data: batch,
    skipDuplicates: true  // 自动跳过重复数据
  });

  console.log(`✅ 已导入 ${i + batch.length}/${articles.length} 条`);
}
```

**预计时间**：
- 本地测试：10-20 分钟
- 服务器运行：20-40 分钟
- **总计：30-60 分钟** ✅

---

#### 方案4：使用 PostgreSQL COPY 命令（最快）⭐⭐⭐⭐⭐

**原理**：将数据导出为 CSV，使用 PostgreSQL 的 COPY 命令批量导入

**优点**：
- 🚀 速度最快（PostgreSQL 原生支持）
- 📊 适合大数据量

**步骤**：

```bash
# 1. 从 SQLite 导出为 CSV
sqlite3 d:/pldowns/npc_laws.db <<EOF
.headers on
.mode csv
.output npc_laws_export.csv
SELECT
  laws.title as lawName,
  law_articles.article_number as articleNumber,
  law_articles.article_content as fullText,
  laws.type as lawType,
  -- ... 其他字段
FROM law_articles
JOIN laws ON law_articles.law_id = laws.law_id
WHERE laws.status = 'done';
EOF

# 2. 上传 CSV 到服务器
scp npc_laws_export.csv user@server:/tmp/

# 3. 在服务器上使用 COPY 导入
psql -U your_username -d your_database <<EOF
COPY "LawArticle" (
  "lawName", "articleNumber", "fullText", ...
) FROM '/tmp/npc_laws_export.csv'
WITH (FORMAT csv, HEADER true);
EOF
```

**预计时间**：
- 导出 CSV：5-10 分钟
- 上传：10-20 分钟
- 导入：2-5 分钟
- **总计：17-35 分钟** ✅

---

## 推荐方案对比

| 方案 | 速度 | 难度 | 可靠性 | 推荐度 |
|------|------|------|--------|--------|
| 方案1：pg_dump/restore | ⚡⚡⚡⚡⚡ | ⭐⭐ | ✅✅✅ | ⭐⭐⭐⭐⭐ |
| 方案2：上传 SQLite | ⚡⚡ | ⭐⭐⭐ | ✅✅ | ⭐⭐ |
| 方案3：批量导入优化 | ⚡⚡⚡⚡ | ⭐⭐⭐ | ✅✅✅ | ⭐⭐⭐⭐ |
| 方案4：COPY 命令 | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | ✅✅✅ | ⭐⭐⭐⭐⭐ |

---

## 最佳实践建议

### 开发环境 → 生产环境部署流程

```bash
# 1. 本地完成数据迁移和测试
npx tsx scripts/import-data/import-npc-laws.ts

# 2. 导出数据（选择方案1或方案4）
# 方案1：
pg_dump -U postgres -d legal_debate_mvp \
  -t "LawArticle" \
  --data-only \
  -f law_articles_backup.sql
gzip law_articles_backup.sql

# 3. 部署应用到服务器
git push origin main
# 服务器上 git pull

# 4. 运行数据库迁移
npx prisma migrate deploy

# 5. 导入数据
scp law_articles_backup.sql.gz user@server:/tmp/
ssh user@server
gunzip /tmp/law_articles_backup.sql.gz
psql -U postgres -d legal_debate_mvp -f /tmp/law_articles_backup.sql

# 6. 验证数据
npx tsx scripts/import-data/verify-npc-import.ts
```

---

## 性能优化建议

### 1. 创建索引（导入后）

```sql
-- 在数据导入完成后创建索引
CREATE INDEX CONCURRENTLY idx_law_article_data_source
  ON "LawArticle"("dataSource");

CREATE INDEX CONCURRENTLY idx_law_article_law_name
  ON "LawArticle"("lawName");

CREATE INDEX CONCURRENTLY idx_law_article_law_type
  ON "LawArticle"("lawType");

-- 全文搜索索引
CREATE INDEX CONCURRENTLY idx_law_article_searchable_text
  ON "LawArticle" USING gin(to_tsvector('chinese', "searchableText"));
```

### 2. 数据库配置优化

在导入大量数据时，临时调整 PostgreSQL 配置：

```sql
-- 临时禁用自动清理（导入期间）
ALTER TABLE "LawArticle" SET (autovacuum_enabled = false);

-- 导入完成后重新启用
ALTER TABLE "LawArticle" SET (autovacuum_enabled = true);
VACUUM ANALYZE "LawArticle";
```

---

## 总结

### 问题1：种子数据
- ✅ 只有 1 条种子数据，影响很小
- 💡 建议：保留或删除都可以，通过 `dataSource` 字段区分

### 问题2：服务器部署
- ⚡ **推荐方案1**：pg_dump/restore（20-50 分钟）
- 🚀 **推荐方案4**：COPY 命令（17-35 分钟）
- ⚠️ **不推荐**：直接运行迁移脚本（2-4 小时）

### 下一步行动
1. 清理种子数据（可选）
2. 本地测试完成后，使用 pg_dump 导出数据
3. 部署应用到服务器
4. 在服务器上恢复数据
5. 创建索引并验证

**预计总部署时间：1-2 小时**（而不是几天）✅
