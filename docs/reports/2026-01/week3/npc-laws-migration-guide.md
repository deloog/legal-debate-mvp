# 国家法律法规库数据迁移指南

## 概述

本指南说明如何将从国家法律法规库采集的数据（存储在 SQLite 数据库中）迁移到当前项目的 PostgreSQL 数据库。

## 数据源信息

### SQLite 数据库位置
- **路径**: `d:\pldowns\npc_laws.db`
- **数据量**:
  - 法律记录: 22,945 部（已完成采集）
  - 法律条文: 977,347 条

### SQLite 数据库结构

#### laws 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| type | TEXT | 法规类型（宪法、法律、行政法规等） |
| type_id | TEXT | 类型代码 |
| title | TEXT | 法律标题 |
| publish_date | TEXT | 发布日期 |
| effective_date | TEXT | 生效日期 |
| status | TEXT | 采集状态 |
| url | TEXT | 详情页URL |
| law_id | TEXT | 网站内部法规ID |
| crawl_time | TIMESTAMP | 采集时间 |
| document_type | TEXT | 文档类型 |
| full_text | TEXT | 全文 |
| has_articles | BOOLEAN | 是否有条文 |

#### law_articles 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| law_id | TEXT | 关联到 laws 表 |
| chapter_number | TEXT | 章节号 |
| chapter_title | TEXT | 章节标题 |
| article_number | TEXT | 条文号 |
| article_content | TEXT | 条文内容 |

## 目标数据库结构

### LawArticle 模型（PostgreSQL）

当前项目使用 Prisma ORM，LawArticle 模型包含以下字段：

```prisma
model LawArticle {
  id                String       @id @default(cuid())
  lawName           String       // 法律名称
  articleNumber     String       // 条文号
  fullText          String       @db.Text // 全文
  lawType           LawType      // 法律类型枚举
  category          LawCategory  // 分类枚举
  subCategory       String?      // 子分类
  tags              String[]     // 标签
  keywords          String[]     // 关键词
  version           String       // 版本
  effectiveDate     DateTime     // 生效日期
  expiryDate        DateTime?    // 失效日期
  status            LawStatus    // 状态
  chapterNumber     String?      // 章节号
  level             Int          @default(0) // 层级
  issuingAuthority  String       // 发布机关
  searchableText    String       @db.Text // 可搜索文本
  dataSource        String       // 数据来源
  sourceId          String?      // 源ID
  importedAt        DateTime?    // 导入时间
  lastSyncedAt      DateTime?    // 最后同步时间
  syncStatus        SyncStatus   // 同步状态

  @@unique([lawName, articleNumber])
}
```

## 字段映射关系

| SQLite 字段 | PostgreSQL 字段 | 转换说明 |
|------------|----------------|---------|
| laws.title | lawName | 直接映射 |
| law_articles.article_number | articleNumber | 直接映射 |
| law_articles.article_content | fullText | 直接映射 |
| laws.type | lawType | 需要映射转换（见下表） |
| laws.effective_date | effectiveDate | TEXT → DateTime |
| law_articles.chapter_number | chapterNumber | 直接映射 |
| law_articles.chapter_title | subCategory | 直接映射 |
| laws.law_id | sourceId | 直接映射 |
| - | issuingAuthority | 根据 type 推断 |
| - | category | 根据标题关键词推断 |
| - | searchableText | 自动生成 |
| - | dataSource | 固定为 "npc" |

### 法律类型映射

| SQLite type | PostgreSQL LawType |
|------------|-------------------|
| 宪法 | CONSTITUTION |
| 法律 | LAW |
| 行政法规 | ADMINISTRATIVE_REGULATION |
| 监察法规 | ADMINISTRATIVE_REGULATION |
| 司法解释 | JUDICIAL_INTERPRETATION |
| 地方法规 | LOCAL_REGULATION |

### 发布机关推断规则

| 法律类型 | 发布机关 |
|---------|---------|
| 宪法 | 全国人民代表大会 |
| 法律 | 全国人民代表大会常务委员会 |
| 行政法规 | 国务院 |
| 监察法规 | 国家监察委员会 |
| 司法解释 | 最高人民法院/最高人民检察院 |
| 地方法规 | 地方人民代表大会常务委员会 |

### 法律分类推断规则

根据法律标题中的关键词推断分类：

| 关键词 | 分类 (LawCategory) |
|-------|-------------------|
| 民法、合同、物权、侵权 | CIVIL |
| 刑法、刑事 | CRIMINAL |
| 行政、行政处罚、行政许可 | ADMINISTRATIVE |
| 公司、企业、商业、证券 | COMMERCIAL |
| 劳动、社会保险、工伤 | LABOR |
| 知识产权、专利、商标、著作权 | INTELLECTUAL_PROPERTY |
| 诉讼、程序 | PROCEDURE |
| 其他 | OTHER |

## 迁移步骤

### 1. 准备工作

确保已安装必要的依赖：

```bash
npm install better-sqlite3 --save-dev
```

### 2. 备份数据库

在执行迁移前，建议先备份当前的 PostgreSQL 数据库：

```bash
# 使用 pg_dump 备份
pg_dump -U your_username -d your_database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 3. 测试迁移（可选）

建议先在测试环境中运行迁移脚本，验证数据转换是否正确：

```bash
# 设置测试数据库连接
export DATABASE_URL="postgresql://user:password@localhost:5432/test_db"

# 运行迁移脚本（限制导入数量）
npx tsx scripts/import-data/import-npc-laws.ts --limit 100
```

### 4. 执行完整迁移

确认测试无误后，执行完整迁移：

```bash
npx tsx scripts/import-data/import-npc-laws.ts
```

### 5. 验证数据

迁移完成后，验证数据是否正确导入：

```bash
# 连接到 PostgreSQL
psql -U your_username -d your_database

# 查询统计信息
SELECT
  "dataSource",
  COUNT(*) as total_articles,
  COUNT(DISTINCT "lawName") as total_laws
FROM "LawArticle"
WHERE "dataSource" = 'npc'
GROUP BY "dataSource";

# 查看示例数据
SELECT
  "lawName",
  "articleNumber",
  LEFT("fullText", 100) as preview
FROM "LawArticle"
WHERE "dataSource" = 'npc'
LIMIT 5;
```

## 迁移脚本功能

### 主要功能

1. **数据读取**: 从 SQLite 数据库读取法律和条文数据
2. **字段转换**: 自动转换字段类型和格式
3. **智能推断**: 根据规则推断发布机关、法律分类等信息
4. **去重处理**: 检查是否已存在相同的法律条文，避免重复导入
5. **增量更新**: 如果记录已存在，则更新而不是创建新记录
6. **进度显示**: 实时显示导入进度和统计信息
7. **错误处理**: 捕获并记录导入过程中的错误

### 脚本参数（可扩展）

当前版本不支持命令行参数，但可以通过修改脚本中的常量来调整：

```typescript
// 在脚本顶部修改
const SQLITE_DB_PATH = 'd:\\pldowns\\npc_laws.db';  // SQLite 数据库路径
const BATCH_SIZE = 100;  // 批量处理大小（可添加）
const DRY_RUN = false;   // 是否为试运行模式（可添加）
```

## 性能优化建议

### 1. 批量导入

对于大量数据，建议使用批量导入来提高性能：

```typescript
// 使用 createMany 代替多次 create
await prisma.lawArticle.createMany({
  data: articlesData,
  skipDuplicates: true,
});
```

### 2. 事务处理

将多个操作包装在事务中，提高一致性和性能：

```typescript
await prisma.$transaction(async (tx) => {
  // 批量操作
});
```

### 3. 索引优化

确保数据库中有适当的索引：

```sql
-- 为常用查询字段创建索引
CREATE INDEX IF NOT EXISTS idx_law_article_data_source
  ON "LawArticle"("dataSource");

CREATE INDEX IF NOT EXISTS idx_law_article_law_name
  ON "LawArticle"("lawName");

CREATE INDEX IF NOT EXISTS idx_law_article_searchable_text
  ON "LawArticle" USING gin(to_tsvector('chinese', "searchableText"));
```

## 常见问题

### Q1: 迁移过程中出现内存不足错误

**解决方案**:
- 分批处理数据，每次处理一定数量的法律
- 增加 Node.js 内存限制：`NODE_OPTIONS=--max-old-space-size=4096 npx tsx ...`

### Q2: 日期格式转换失败

**解决方案**:
- 脚本已包含日期解析错误处理
- 如果日期无效，将使用当前日期作为默认值

### Q3: 法律类型映射不准确

**解决方案**:
- 检查 `LAW_TYPE_MAP` 映射表
- 根据实际数据调整映射规则

### Q4: 重复数据问题

**解决方案**:
- 脚本使用 `lawName` + `articleNumber` 作为唯一键
- 已存在的记录会被更新而不是重复创建

### Q5: 迁移速度太慢

**解决方案**:
- 使用批量导入（createMany）
- 临时禁用某些索引，迁移完成后重建
- 使用事务批量提交

## 数据质量检查

迁移完成后，建议进行以下检查：

### 1. 数据完整性检查

```sql
-- 检查是否有空的必填字段
SELECT COUNT(*)
FROM "LawArticle"
WHERE "dataSource" = 'npc'
  AND ("lawName" IS NULL OR "articleNumber" IS NULL OR "fullText" IS NULL);

-- 检查日期字段
SELECT COUNT(*)
FROM "LawArticle"
WHERE "dataSource" = 'npc'
  AND "effectiveDate" IS NULL;
```

### 2. 数据一致性检查

```sql
-- 检查同一法律的条文数量
SELECT
  "lawName",
  COUNT(*) as article_count
FROM "LawArticle"
WHERE "dataSource" = 'npc'
GROUP BY "lawName"
ORDER BY article_count DESC
LIMIT 10;
```

### 3. 分类统计

```sql
-- 按法律类型统计
SELECT
  "lawType",
  COUNT(*) as count
FROM "LawArticle"
WHERE "dataSource" = 'npc'
GROUP BY "lawType"
ORDER BY count DESC;

-- 按分类统计
SELECT
  "category",
  COUNT(*) as count
FROM "LawArticle"
WHERE "dataSource" = 'npc'
GROUP BY "category"
ORDER BY count DESC;
```

## 后续优化建议

1. **添加全文搜索索引**: 为 `searchableText` 字段创建 GIN 索引，提高搜索性能
2. **建立法律关系**: 使用知识图谱功能建立法律条文之间的关联关系
3. **数据清洗**: 检查并修正可能存在的数据质量问题
4. **定期同步**: 建立定期同步机制，保持数据最新

## 技术支持

如遇到问题，请检查：
1. SQLite 数据库文件是否存在且可读
2. PostgreSQL 数据库连接是否正常
3. Prisma schema 是否与脚本中的模型定义一致
4. 查看详细的错误日志

## 更新日志

- **2026-02-06**: 初始版本，支持基本的数据迁移功能
