# 法律法规采集器使用指南

## 概述

本项目提供完整的法律法规数据采集解决方案，支持从国家法律法规数据库（FLK）采集法规数据，并保存到 PostgreSQL 数据库。

## 当前状态

| 功能         | 状态      | 说明                              |
| ------------ | --------- | --------------------------------- |
| API 列表采集 | ✅ 已完成 | 从 FLK API 获取法规元数据         |
| 详情获取     | ✅ 已完成 | 获取法规详情和 content            |
| 数据库存储   | ✅ 已完成 | 使用 Prisma ORM 保存到 PostgreSQL |
| 断点续采     | ✅ 已完成 | 支持中断后继续采集                |
| 现有数据导入 | ✅ 已完成 | 导入 data/ 目录下的法规数据       |
| DOCX 下载    | ⚠️ 部分   | API 返回 content 字段，无需下载   |

## 数据库中的法规数据

当前数据库已包含 **56 条** 完整法规数据，涵盖：

| 分类       | 数量 |
| ---------- | ---- |
| 行政法     | 4    |
| 民法商法   | 11   |
| 商业法     | 4    |
| 刑法       | 11   |
| 知识产权法 | 4    |
| 劳动法     | 4    |
| 程序法     | 4    |
| 其他       | 14   |

## 使用方式

### 1. 运行采集脚本

```bash
# 快速测试（采集 2 个分类，每类 3 条）
npx tsx scripts/crawler/test-flk-live.ts

# 增量采集（最近 7 天）
npx tsx scripts/crawler/crawl-all.ts --incremental

# 全量采集（所有法规，约 15,000+ 条）
npx tsx scripts/crawler/crawl-all.ts

# 限制采集页数（每类最多 5 页）
npx tsx scripts/crawler/crawl-all.ts --maxPages=5

# 只采集特定分类（用逗号分隔）
npx tsx scripts/crawler/crawl-all.ts --types=100,120,130
```

### 2. 导入现有法规数据

```bash
# 导入 data/ 目录下的法规 JSON 文件
npx tsx scripts/import-data/import-existing-laws.ts
```

### 3. 通过 API 采集

```bash
# 启动开发服务器
npm run dev

# 调用采集 API
curl -X POST http://localhost:3000/api/crawler/run \
  -H "Content-Type: application/json" \
  -d '{
    "source": "flk",
    "crawlType": "incremental"
  }'

# 查看采集统计
curl http://localhost:3000/api/crawler/statistics
```

## 采集流程说明

### 数据来源

1. **国家法律法规数据库 (flk.npc.gov.cn)**
   - 主要数据源
   - 覆盖法律、行政法规、司法解释、地方性法规等
   - 通过 REST API 获取数据

2. **本地数据文件**
   - `data/law-articles-*.json`
   - 可直接导入到数据库

### 采集限制

| 限制项   | 值    | 说明                |
| -------- | ----- | ------------------- |
| 请求间隔 | 2 秒  | 避免对 API 造成压力 |
| 最大重试 | 3 次  | 网络异常时自动重试  |
| 超时时间 | 30 秒 | 单次请求超时        |
| 分页大小 | 20 条 | 每页获取数量        |

## 查看采集结果

### 使用 Prisma Studio

```bash
npx prisma studio
```

在浏览器中打开 http://localhost:5555，查看 `law_articles` 表。

### 使用命令行查询

```bash
# 查看法规总数
npx prisma execute --sql="SELECT COUNT(*) FROM law_articles;"

# 按分类统计
npx prisma execute --sql="SELECT category, COUNT(*) FROM law_articles GROUP BY category;"

# 查看最新采集的法规
npx prisma execute --sql="SELECT lawName, articleNumber, effectiveDate FROM law_articles ORDER BY createdAt DESC LIMIT 10;"
```

## 常见问题

### Q: 为什么很多法规只有元数据，没有正文内容？

A: 这是因为国家法律法规数据库 API 的限制。部分法规的 `content` 字段为空，建议：

1. 使用 `scripts/import-data/import-existing-laws.ts` 导入已有的完整法规数据
2. 对于缺失的法规，可以手动补充或等待 API 改进

### Q: 如何清理测试数据？

```bash
# 清理 FLK 来源的法规
npx tsx scripts/cleanup/clear-seed-law-articles.ts
```

### Q: 采集被中断如何恢复？

A: 脚本会自动保存断点到 `data/crawled/flk/checkpoint.json`，重新运行脚本会自动从断点继续。

## 目录结构

```
scripts/
├── crawler/
│   ├── crawl-all.ts      # 完整采集脚本
│   ├── test-flk-live.ts  # 快速测试脚本
│   └── debug-api.ts      # API 调试工具
├── import-data/
│   └── import-existing-laws.ts  # 导入本地数据
└── cleanup/
    └── clear-seed-law-articles.ts  # 清理测试数据

data/
├── law-articles-*.json   # 法规数据文件
└── crawled/flk/           # 采集缓存
    ├── checkpoint.json    # 断点文件
    ├── flfg/             # 法律文件
    ├── xzfg/             # 行政法规文件
    └── sfjs/             # 司法解释文件
```

## 下一步计划

1. **增强 DOCX 下载** - 修复下载链接获取逻辑
2. **定时任务** - 配置 cron 自动增量同步
3. **数据验证** - 添加数据质量检查
4. **多数据源** - 集成北大法宝、威科先行等数据源
