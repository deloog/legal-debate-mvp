# NPC/Court 爬虫 API 对接方案

> 创建时间：2026-02-18
> 目标：完成全国人大(npc.gov.cn)和最高人民法院(court.gov.cn)的真实 API 对接

---

## 1. NPC（全国人大）API 对接

### 1.1 数据源地址
- 官网：`https://www.npc.gov.cn`
- 法规搜索：`https://www.npc.gov.cn/npc/c2/c30834/`

### 1.2 现有 Stub 代码
文件：`src/lib/crawler/npc-crawler.ts`

当前实现返回 `NOT_IMPLEMENTED` 错误。

### 1.3 对接步骤

#### 步骤 1：调研 API 端点

通过 Chrome DevTools Network 面板捕获搜索时的 API 请求：

```bash
# 访问 NPC 法规搜索页面
# https://www.npc.gov.cn/npc/c2/c30834/
# 搜索关键词，观察 Network 面板中的 API 请求
```

#### 步骤 2：实现 fetchLawList()

```typescript
/**
 * NPC 法规列表 API
 * 需要捕获的字段：
 * - total: 总数
 * - rows: 法规列表
 *   - id: 法规 ID
 * - title: 标题
 * - publishDate: 发布日期
 * - effectiveDate: 生效日期
 * - category: 分类
 */
async fetchLawList(page: number, pageSize: number): Promise<NPCListResponse> {
  const url = `${this.API_BASE}/api/xxx`; // 待确定
  const response = await this.fetchWithRetry(url, {
    method: 'POST', // 或 GET
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': this.randomUA(),
    },
    body: JSON.stringify({
      pageNum: page,
      pageSize: pageSize,
      // 其他参数
    }),
  });
  return response.json();
}
```

#### 步骤 3：实现 fetchLawDetail()

```typescript
/**
 * NPC 法规详情 API
 * 返回完整法规内容
 */
async fetchLawDetail(id: string): Promise<NPCDetailResponse> {
  const url = `${this.API_BASE}/api/xxx/${id}`;
  const response = await this.fetchWithRetry(url);
  return response.json();
}
```

#### 步骤 4：删除 Stub 守卫

```typescript
// 修改 crawl() 方法
async crawl(): Promise<CrawlerResult> {
  // 删除 NOT_IMPLEMENTED 返回，改为真实采集逻辑
  const listResult = await this.fetchLawList(1, 20);
  // ...
}
```

### 1.4 预期数据结构

```typescript
interface NPCLawDetail {
  id: string;
  title: string;           // 法规名称
  lawNumber: string;        // 文号
  fullText: string;         // 全文内容
  publishDate: string;      // 发布日期
  effectiveDate: string;   // 生效日期
  category: string;         // 分类
  lawType: string;         // 法律类型
  issuingAuthority: string;// 发布机关
  region?: string;          // 地区（地方性法规）
}
```

---

## 2. Court（最高人民法院）API 对接

### 2.1 数据源地址
- 官网：`https://www.court.gov.cn`
- 司法解释：`https://www.court.gov.cn/fabu-xxgk/`

### 2.2 现有 Stub 代码
文件：`src/lib/crawler/court-crawler.ts`

当前实现返回 `NOT_IMPLEMENTED` 错误。

### 2.3 对接步骤

#### 步骤 1：调研 API 端点

```bash
# 访问最高人民法院司法解释页面
# https://www.court.gov.cn/fabu-xxgk/
# 搜索关键词，观察 Network 面板
```

#### 步骤 2：实现 fetchInterpretationList()

```typescript
/**
 * 司法解释列表 API
 */
async fetchInterpretationList(
  page: number,
  pageSize: number
): Promise<CourtListResponse> {
  const url = `${this.API_BASE}/api/xxx`; // 待确定
  const response = await this.fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': this.randomUA(),
    },
    body: JSON.stringify({
      pageNum: page,
      pageSize: pageSize,
      type: 'judicial_interpretation',
    }),
  });
  return response.json();
}
```

#### 步骤 3：实现 fetchInterpretationDetail()

```typescript
/**
 * 司法解释详情 API
 */
async fetchInterpretationDetail(id: string): Promise<CourtDetailResponse> {
  const url = `${this.API_BASE}/api/xxx/${id}`;
  const response = await this.fetchWithRetry(url);
  return response.json();
}
```

#### 步骤 4：删除 Stub 守卫

```typescript
// 修改 crawl() 方法
async crawl(): Promise<CrawlerResult> {
  // 删除 NOT_IMPLEMENTED 返回，改为真实采集逻辑
  const listResult = await this.fetchInterpretationList(1, 20);
  // ...
}
```

### 2.4 预期数据结构

```typescript
interface CourtInterpretationDetail {
  id: string;
  title: string;           // 解释标题
  documentNumber: string;   // 文号
  fullText: string;         // 全文内容
  publishDate: string;     // 发布日期
  effectiveDate: string;    // 生效日期
  category: string;         // 分类
  issuingAuthority: string;// 发布机关（最高人民法院）
  applicableScope: string; // 适用范围
}
```

---

## 3. 启用数据源

完成 API 对接后，在调度器中启用数据源：

```typescript
// law-sync-scheduler.ts 或通过 API 调用
await lawSyncScheduler.setEnabledSources(['flk', 'npc', 'court']);
```

---

## 4. 测试验证

### 4.1 NPC 爬虫测试

```bash
# 运行 NPC 爬虫测试
npx tsx scripts/test-npc-crawler.ts
```

### 4.2 Court 爬虫测试

```bash
# 运行 Court 爬虫测试
npx tsx scripts/test-court-crawler.ts
```

### 4.3 验证指标

| 指标 | 预期值 |
|------|--------|
| 采集成功率 | > 95% |
| 数据完整性 | 全文 > 1000 字符 |
| 分类准确性 | > 90% |

---

## 5. 注意事项

1. **反爬虫策略**
   - 添加随机 User-Agent
   - 控制请求频率（建议 2-3 秒/次）
   - 可能需要处理验证码

2. **数据一致性**
   - NPC 和 Court 数据可能与 FLK 有重复
   - 需要去重逻辑（基于 sourceId 或 lawName）

3. **增量同步**
   - 实现 incrementalCrawl() 方法
   - 根据 effectiveDate 或 publishDate 判断增量

---

## 6. 任务分工

| 任务 | 负责人 | 状态 |
|------|--------|------|
| 调研 NPC API 端点 | 待分配 | 待开始 |
| 调研 Court API 端点 | 待分配 | 待开始 |
| 实现 NPC 爬虫 | 待分配 | 待开始 |
| 实现 Court 爬虫 | 待分配 | 待开始 |
| 测试验证 | 待分配 | 待开始 |
| 启用数据源 | 待分配 | 待开始 |
