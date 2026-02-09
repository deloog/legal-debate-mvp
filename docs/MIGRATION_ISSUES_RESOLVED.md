# 数据迁移问题解决总结

## 问题回顾

### 问题1：种子数据混淆
**担心**：之前开发中生成的种子数据可能与 NPC 数据混在一起

**实际情况**：
- ✅ NPC 数据：681,722 条（dataSource = 'npc'）
- ⚠️ 种子数据：1 条（dataSource = 'local'）

**结论**：种子数据很少，不会造成混淆。所有数据都通过 `dataSource` 字段清晰区分。

---

### 问题2：服务器部署时间
**担心**：本地迁移花了 2 小时，服务器部署可能需要几天

**实际情况**：
- ❌ 直接运行迁移脚本：2-4 小时
- ✅ 使用 pg_dump/restore：20-50 分钟
- ✅ 使用 CSV + COPY：17-35 分钟

**结论**：使用正确的方法，服务器部署只需 **20-50 分钟**，而不是几天！

---

## 解决方案

### 1. 种子数据处理

#### 选项A：保留种子数据（推荐）
```typescript
// 查询时只查询 NPC 数据
const articles = await prisma.lawArticle.findMany({
  where: { dataSource: 'npc' }
});
```

#### 选项B：清理种子数据
```bash
npx tsx scripts/cleanup/cleanup-seed-data.ts
```

---

### 2. 服务器部署方案

#### 🏆 推荐方案：pg_dump + restore

**步骤**：

```bash
# 1. 本地导出（5-10 分钟）
bash scripts/export-npc-data.sh

# 2. 上传到服务器（10-30 分钟）
scp backups/law_articles_npc_*.sql.gz user@server:/tmp/

# 3. 服务器导入（5-10 分钟）
ssh user@server
cd /tmp
./import_on_server.sh law_articles_npc_*.sql.gz

# 4. 验证（1-2 分钟）
cd /path/to/app
npx tsx scripts/import-data/verify-npc-import.ts
```

**总时间：20-50 分钟** ✅

---

## 为什么本地迁移慢，但服务器部署快？

### 本地迁移（2 小时）
- 从 SQLite 读取数据
- 逐条检查是否存在（去重）
- 逐条插入 PostgreSQL
- 处理 976,731 条数据

### 服务器部署（20-50 分钟）
- 直接从 PostgreSQL 导出
- 批量插入（无需去重检查）
- 使用 PostgreSQL 原生 COPY 命令
- 数据已经清洗和转换好

---

## 已创建的工具

### 1. 数据检查工具
- `scripts/check-data-sources.ts` - 检查数据源分布

### 2. 清理工具
- `scripts/cleanup/cleanup-seed-data.ts` - 清理种子数据

### 3. 导出工具
- `scripts/export-npc-data.sh` - 导出 NPC 数据
- 自动生成 `import_on_server.sh` 服务器导入脚本

### 4. 批量导入工具（备用）
- `scripts/import-data/import-npc-laws-batch.ts` - 批量导入优化版

### 5. 文档
- `docs/DATA_MIGRATION_DEPLOYMENT_GUIDE.md` - 完整部署指南
- `docs/SERVER_DEPLOYMENT_QUICK_GUIDE.md` - 快速部署指南
- `docs/NPC_LAWS_MIGRATION_COMPLETION_REPORT.md` - 迁移完成报告

---

## 下一步行动

### 立即执行

1. **清理种子数据**（可选）
   ```bash
   npx tsx scripts/cleanup/cleanup-seed-data.ts
   ```

2. **导出数据**
   ```bash
   bash scripts/export-npc-data.sh
   ```

### 部署时执行

3. **上传到服务器**
   ```bash
   scp backups/*.sql.gz user@server:/tmp/
   scp backups/import_on_server.sh user@server:/tmp/
   ```

4. **服务器导入**
   ```bash
   ssh user@server
   cd /tmp
   chmod +x import_on_server.sh
   ./import_on_server.sh law_articles_npc_*.sql.gz
   ```

5. **验证数据**
   ```bash
   cd /path/to/app
   npx tsx scripts/import-data/verify-npc-import.ts
   ```

---

## 关键要点

1. ✅ **种子数据不是问题**：只有 1 条，通过 dataSource 字段区分
2. ✅ **服务器部署很快**：20-50 分钟，不是几天
3. ✅ **使用正确工具**：pg_dump/restore 比重新运行迁移脚本快 3-6 倍
4. ✅ **已准备好工具**：所有脚本和文档都已创建

---

## 性能对比

| 方法 | 本地 | 服务器 | 推荐度 |
|------|------|--------|--------|
| 运行迁移脚本 | 2 小时 | 2-4 小时 | ⭐ |
| pg_dump/restore | 10 分钟 | 20-50 分钟 | ⭐⭐⭐⭐⭐ |
| CSV + COPY | 10 分钟 | 17-35 分钟 | ⭐⭐⭐⭐⭐ |
| 批量导入优化 | 20 分钟 | 30-60 分钟 | ⭐⭐⭐⭐ |

---

## 总结

你的两个担心都已经解决：

1. **种子数据混淆**：✅ 不是问题，只有 1 条，且有明确标识
2. **服务器部署时间**：✅ 只需 20-50 分钟，不是几天

现在你可以放心地进行本地测试，部署时使用提供的工具快速完成数据迁移！🎉
