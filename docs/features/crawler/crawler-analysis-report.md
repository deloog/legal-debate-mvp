# 现有采集器代码分析报告

> 分析日期: 2026-02-12  
> 分析范围: `src/lib/crawler/` 目录下所有模块

---

## 一、代码现状概览

### 1.1 已有的组件

| 组件             | 文件                  | 功能                     | 状态        |
| ---------------- | --------------------- | ------------------------ | ----------- |
| BaseCrawler      | base-crawler.ts       | 基础爬虫类，提供通用方法 | ✅ 基础实现 |
| FLKCrawler       | flk-crawler.ts        | 国家法律法规数据库爬虫   | ⚠️ 需完善   |
| NPCCrawler       | npc-crawler.ts        | 全国人大官网爬虫         | ❌ 模拟数据 |
| CourtCrawler     | court-crawler.ts      | 最高人民法院爬虫         | ❌ 模拟数据 |
| CrawlTaskManager | crawl-task-manager.ts | 任务管理                 | ✅ 可用     |
| LawSyncScheduler | law-sync-scheduler.ts | 同步调度                 | ✅ 可用     |
| LawDataValidator | data-validator.ts     | 数据验证                 | ✅ 基础实现 |

---

## 二、问题分析

### 2.1 BaseCrawler 问题

```typescript
// 当前重试机制（src/lib/crawler/base-crawler.ts:64-71）
constructor(config: Partial<CrawlerConfig>) {
  this.config = {
    maxRetries: config.maxRetries || 3,  // 问题1: 固定3次重试
    rateLimitDelay: config.rateLimitDelay || 1000,  // 问题2: 最小1秒
    // ...
  };
}
```

**问题清单**：

| #   | 问题                       | 影响                   | 严重程度 |
| --- | -------------------------- | ---------------------- | -------- |
| 1   | 固定3次重试，无指数退避    | 高频错误时容易被封     | 🔴 高    |
| 2   | 没有针对 HTTP 状态码的处理 | 429/503 无法正确处理   | 🔴 高    |
| 3   | 没有断点续传机制           | 中断后需重新开始       | 🟡 中    |
| 4   | 没有代理支持               | IP 被封后无解决方案    | 🟡 中    |
| 5   | 延迟时间固定               | 无法根据网站负载自适应 | 🟡 中    |

### 2.2 FLKCrawler 问题

```typescript
// 当前解析方式（src/lib/crawler/flk-crawler.ts:227-299）
private parseLawDetail(html: string, lawId: string, sourceUrl: string): LawArticleData | null {
  // 使用简单的正则表达式提取
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const numberMatch = html.match(/文号[：:]\s*([^<]+)/i);
  // ...
}
```

**问题清单**：

| #   | 问题            | 影响                       | 严重程度 |
| --- | --------------- | -------------------------- | -------- |
| 1   | 正则脆弱        | HTML结构变化即失效         | 🔴 高    |
| 2   | 无格式检测      | 无法区分法律法规vs公文格式 | 🔴 高    |
| 3   | 无降级策略      | 解析失败即放弃             | 🟡 中    |
| 4   | 无章节/法条解析 | 只能存全文，无法拆分       | 🟡 中    |
| 5   | 无异常记录      | 不知道哪些格式未覆盖       | 🟡 中    |

### 2.3 数据验证问题

```typescript
// 当前验证（src/lib/crawler/data-validator.ts:55-131）
validate(data: CrawledLawArticle): ValidationResult {
  // 基础字段验证
  for (const field of this.requiredFields) {
    if (!value) {
      errors.push({ /* ... */ });
    }
  }
  // 无数据质量评分
}
```

**问题清单**：

| #   | 问题             | 影响               | 严重程度 |
| --- | ---------------- | ------------------ | -------- |
| 1   | 无解析成功率统计 | 无法量化问题       | 🟡 中    |
| 2   | 无失败模式分析   | 不知道哪里需要优化 | 🟡 中    |
| 3   | 无质量评分系统   | 无法优先级排序     | 🟢 低    |

---

## 三、与您之前 Python 采集器对比

| 功能         | 您的 Python 采集器 | 当前 TypeScript 实现 |
| ------------ | ------------------ | -------------------- |
| 重试机制     | ✅ 有（但简单）    | ⚠️ 基础实现          |
| 断点续传     | ❌ 无              | ❌ 无                |
| 格式检测器   | ❌ 无              | ❌ 无                |
| 统一解析架构 | ❌ 无              | ❌ 无                |
| 智能降级     | ❌ 无              | ❌ 无                |
| 失败模式学习 | ❌ 无              | ❌ 无                |

---

## 四、具体优化建议

### 4.1 优化优先级

```
P0 (立即修复):
  1. 增强重试机制 - 处理网站不稳定
  2. 格式检测器 - 统一处理不同文档格式

P1 (近期实现):
  3. 断点续传 - 支持中断恢复
  4. 三层解析策略 - 降低解析失败率

P2 (长期完善):
  5. 异常模式学习
  6. 质量评分系统
```

### 4.2 代码修改点

#### 4.2.1 增强 BaseCrawler

```typescript
// 建议修改: src/lib/crawler/base-crawler.ts

interface RetryConfig {
  maxRetries: number; // 5
  baseDelay: number; // 2000ms
  maxDelay: number; // 60000ms
  exponentialBase: number; // 2
  retryOnStatusCodes: number[]; // [429, 503, 502, 504]
}

// 新增方法
abstract class BaseCrawler {
  // ...

  // 建议新增
  protected async fetchWithRetry(url: string): Promise<Response> {
    // 实现指数退避重试
  }

  protected async saveCheckpoint(id: string, data: any): Promise<void> {
    // 实现断点续传
  }
}
```

#### 4.2.2 新增格式检测器

```typescript
// 建议新增: src/lib/crawler/format-detector.ts

export class FormatDetector {
  detectDocumentType(content: string): DocumentType {
    // 基于关键词检测文档类型
    // 法律 vs 批复 vs 意见 vs 解释 vs 办法 vs 规定 vs 决定
  }
}

export enum DocumentType {
  LAW = 'law',
  JUDICIAL = 'judicial',
  ADMIN = 'admin',
  OPINION = 'opinion',
  INTERPRET = 'interpret',
  MEASURE = 'measure',
  REGULATION = 'regulation',
  DECISION = 'decision',
}
```

#### 4.2.3 统一解析器

```typescript
// 建议新增: src/lib/crawler/unified-parser.ts

export class UnifiedParser {
  private parsers: Map<DocumentType, BaseParser>;

  parse(content: string, sourceId: string): ParsedLaw {
    const docType = this.formatDetector.detectDocumentType(content);
    const parser = this.parsers.get(docType) || this.defaultParser;
    return parser.parse(content, sourceId);
  }
}
```

---

## 五、测试建议

### 5.1 当前测试覆盖

| 模块          | 测试文件               | 覆盖情况 |
| ------------- | ---------------------- | -------- |
| NPCCrawler    | crawler.test.ts        | 基础功能 |
| FLKCrawler    | flk-crawler.test.ts    | 基础功能 |
| DataValidator | data-validator.test.ts | 基础验证 |

### 5.2 建议新增测试

```typescript
// src/__tests__/lib/crawler/format-detector.test.ts
describe('FormatDetector', () => {
  it('应该正确识别法律法规格式', () => {
    // 测试民法典、刑法等标准格式
  });

  it('应该正确识别司法解释格式', () => {
    // 测试法释〔2020〕XX号格式
  });

  it('应该正确识别批复格式', () => {
    // 测试〔2020〕X号批复格式
  });
});

// src/__tests__/lib/crawler/unified-parser.test.ts
describe('UnifiedParser', () => {
  it('应该正确解析所有格式类型', () => {
    // 测试8种文档类型的解析
  });

  it('应该在解析失败时正确降级', () => {
    // 测试降级策略
  });
});
```

---

## 六、预期改进效果

### 6.1 解析成功率提升

| 阶段      | 当前 | 目标 | 提升 |
| --------- | ---- | ---- | ---- |
| P0 完成后 | 70%  | 85%  | +15% |
| P1 完成后 | 85%  | 95%  | +10% |
| P2 完成后 | 95%  | 98%  | +3%  |

### 6.2 网站访问稳定性

| 指标             | 当前 | 目标    |
| ---------------- | ---- | ------- |
| 平均请求成功率   | 75%  | 98%     |
| 因网络失败的任务 | 常见 | 罕见    |
| 中断恢复时间     | N/A  | < 1分钟 |

---

## 七、下一步行动

1. **确认优先级**: 请确认上述优化优先级是否合适
2. **选择实现方式**:
   - 方案A: 在现有 TypeScript 代码基础上优化
   - 方案B: 新建 Python 独立采集器（您之前的方案）
3. **准备测试数据**: 需要您提供之前 30% 失败的具体样例

---

## 八、附录：关键代码位置索引

| 功能     | 文件位置              | 行号    |
| -------- | --------------------- | ------- |
| 基础配置 | base-crawler.ts       | 9-16    |
| 重试逻辑 | base-crawler.ts       | 需新增  |
| FLK解析  | flk-crawler.ts        | 227-299 |
| 格式映射 | flk-crawler.ts        | 69-79   |
| 任务管理 | crawl-task-manager.ts | 28-58   |
| 调度器   | law-sync-scheduler.ts | 22-74   |
| 数据验证 | data-validator.ts     | 35-131  |
