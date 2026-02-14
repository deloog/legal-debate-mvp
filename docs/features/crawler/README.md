# 法律法规采集模块

本模块用于从官方数据源采集法律法规数据，支持增量更新和全量同步。

## 🚀 快速开始

```bash
# 1. 确保数据库已启动
# 2. 运行快速测试（采集少量数据验证功能）
npx tsx scripts/crawler/test-flk-live.ts

# 3. 导入已有的法规数据（推荐）
npx tsx scripts/import-data/import-existing-laws.ts

# 4. 查看采集结果
npx prisma studio
```

## 目录结构

```
src/lib/crawler/          # 核心采集模块
scripts/crawler/         # 采集脚本
├── crawl-all.ts          # 完整采集脚本
├── test-flk-live.ts      # 快速测试脚本
└── debug-api.ts          # API 调试工具
scripts/import-data/      # 数据导入
scripts/cleanup/          # 清理工具
data/                     # 数据文件
└── law-articles-*.json   # 法规数据
```

## 数据源

| 数据源    | 说明               | 获取方式 | 状态   |
| --------- | ------------------ | -------- | ------ |
| **flk**   | 国家法律法规数据库 | 网页爬取 | 已实现 |
| **npc**   | 全国人大官网       | 网页爬取 | 已实现 |
| **court** | 最高人民法院官网   | 网页爬取 | 已实现 |

> **重要说明**：所有数据源均通过**网页爬取**方式获取，必须遵守：
>
> 1. 目标网站的 `robots.txt` 规则
> 2. 合理的请求频率（默认 3 秒间隔）
> 3. 法律法规数据使用规范

## 使用方式

### 启动采集任务

```bash
POST /api/crawler/run
Content-Type: application/json

{
  "source": "flk",             // 数据源: npc, court, flk
  "crawlType": "incremental",  // full (全量) 或 incremental (增量)
  "options": {
    "dateFrom": "2024-01-01",  // 起始日期
    "dateTo": "2024-12-31",    // 结束日期
    "force": false
  }
}
```

### 获取任务状态

```bash
GET /api/crawler/status/[taskId]
```

### 获取数据统计

```bash
GET /api/crawler/statistics
```

## 代码使用示例

```typescript
import { flkCrawler } from '@/lib/crawler';

// 执行全量采集
const result = await flkCrawler.crawl();
console.log(
  `采集完成: ${result.itemsCreated} 新建, ${result.itemsUpdated} 更新`
);

// 增量采集（过去7天）
const since = new Date();
since.setDate(since.getDate() - 7);
const incResult = await flkCrawler.incrementalCrawl(since);
```

## 配置说明

### 爬虫参数（可调整）

```typescript
const crawler = new FLKCrawler({
  name: 'FLKCrawler',
  baseUrl: 'https://flk.ncha.gov.cn',
  requestTimeout: 30000, // 请求超时 30秒
  maxRetries: 3, // 最大重试次数
  rateLimitDelay: 3000, // 请求间隔 3秒
  userAgent: 'LegalDebateBot/1.0',
});
```

### 环境变量（可选）

```bash
# 代理配置
HTTP_PROXY=https://proxy.example.com
HTTPS_PROXY=https://proxy.example.com
```

## 注意事项

### 合规使用

1. **遵守 robots.txt**：确保采集行为符合目标网站规则
2. **控制请求频率**：默认 3 秒间隔，避免对网站造成压力
3. **数据使用规范**：仅用于法律研究和参考
4. **禁止商业用途**：确保不违反数据源的使用条款

### 潜在问题

1. **网站结构变化**：网页 HTML 结构可能变化，需要定期维护解析逻辑
2. **反爬虫机制**：如遇到验证码或 IP 封禁，需要降低频率或使用代理
3. **数据完整性**：网页爬取可能无法获取全部数据，建议配合官方渠道验证

## 数据质量

采集后会自动进行数据验证：

- **完整性检查**：必填字段是否完整
- **格式验证**：日期、编号格式是否正确
- **质量评分**：计算完整性、准确性等指标

## 定时同步

使用 cron 配置定时任务：

```bash
# 每天凌晨3点增量同步
0 3 * * * cd /path/to/project && npm run crawl -- --source=flk --type=incremental

# 每周日凌晨2点全量同步
0 2 * * 0 cd /path/to/project && npm run crawl -- --source=flk --type=full
```

## 监控

- 采集日志保存在 `aIInteraction` 表中
- 任务状态保存在 `systemConfig` 表中
- 可通过 API 查看采集统计和历史记录
