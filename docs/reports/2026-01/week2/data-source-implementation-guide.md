# 数据源策略实施指南

## 概述

本文档详细说明了如何实施「核心开源数据 + 外部API补充」的双层数据源策略。

## 已完成的变更

### 1. 数据库Schema更新

新增了以下字段和表：

#### LawArticle 表（法条）
- `dataSource`: 数据源标识
- `sourceId`: 原始数据源ID
- `importedAt`: 导入时间
- `lastSyncedAt`: 最后同步时间
- `syncStatus`: 同步状态 (SYNCED/PENDING/FAILED/NEED_UPDATE)

#### CaseExample 表（案例）
- `dataSource`: 数据源标识
- `sourceId`: CAIL案件ID
- `importedAt`: 导入时间

#### ExternalCache 表（新增）
用于缓存外部API调用的结果，减少重复调用和成本。

## 数据导入脚本

### 1. 司法部数据导入

脚本位置：`scripts/import-data/import-judiciary-data.ts`

**使用方法**：
```bash
npm run import:judiciary -- data/judiciary-laws.json
```

**数据格式**：
```json
[
  {
    "lawName": "民法典",
    "articleNumber": "第一条",
    "fullText": "为了保护民事主体的合法权益...",
    "category": "民事",
    "subCategory": "总则",
    "effectiveDate": "2021-01-01",
    "lawType": "法律",
    "issuingAuthority": "全国人民代表大会",
    "keywords": ["民事", "权益", "保护"],
    "tags": ["核心", "重要"]
  }
]
```

### 2. CAIL案例导入（待创建）

计划创建 `scripts/import-data/import-cail-data.ts`，用于导入CAIL数据集的案例。

### 3. LaWGPT数据导入（待创建）

计划创建 `scripts/import-data/import-lawgpt-data.ts`，用于导入LaWGPT的法条和问答数据。

## 外部API客户端更新

当前的外部API客户端（`src/lib/law-article/external-api-client.ts`）已经支持：

1. **法律之星**：主要外部API
2. **北大法宝**：备用数据源
3. **本地降级**：无外部API时的本地搜索

**建议改进**：
1. 外部API调用成功后，将结果持久化到 `ExternalCache` 表
2. 查询时先检查 `ExternalCache` 表
3. 监控外部API配额使用情况

## 实施步骤

### 阶段一：准备数据（1-2天）

#### 1.1 下载数据源

**司法部数据**：
1. 访问 https://flk.npc.gov.cn/
2. 下载最新的法律法规数据包
3. 解压到 `data/judiciary/` 目录

**CAIL数据**：
1. 访问 http://www.cail.cipsc.org.cn/
2. 下载CAIL数据集
3. 解压到 `data/cail/` 目录

**LaWGPT数据**：
1. 访问 https://github.com/ymcui/LaWGPT
2. Clone仓库或下载发布版本
3. 提取法条和问答数据

#### 1.2 数据格式转换

根据各个数据源的格式，编写转换脚本，将数据转换为标准格式。

### 阶段二：导入数据（2-3天）

#### 2.1 导入司法部数据

```bash
# 导入司法部法律法规
npm run import:judiciary -- data/judiciary/laws.json
```

#### 2.2 导入CAIL案例

```bash
# 导入CAIL案例（待创建）
npm run import:cail -- data/cail/cases.json
```

#### 2.3 导入LaWGPT数据

```bash
# 导入LaWGPT法条（待创建）
npm run import:lawgpt -- data/lawgpt/articles.json
```

### 阶段三：更新外部API客户端（1-2天）

#### 3.1 添加持久化缓存

修改 `src/lib/law-article/external-api-client.ts`：

```typescript
// 在CachedExternalAPIClient类中添加持久化逻辑
async search(query: string, options?: ExternalSearchOptions) {
  // 1. 检查内存缓存
  const memoryCached = this.cache.get(cacheKey);
  if (memoryCached) {
    return { ...memoryCached.data, cached: true };
  }

  // 2. 检查数据库缓存
  const dbCache = await prisma.externalCache.findFirst({
    where: {
      queryHash: cacheHash,
      expiresAt: { gt: new Date() }
    }
  });
  if (dbCache) {
    // 更新命中次数
    await prisma.externalCache.update({
      where: { id: dbCache.id },
      data: { 
        hitCount: dbCache.hitCount + 1,
        lastAccessedAt: new Date()
      }
    });
    return { ...dbCache.resultData, cached: true };
  }

  // 3. 调用外部API
  const result = await this.client.search(query, options);

  // 4. 保存到数据库缓存
  await prisma.externalCache.create({
    data: {
      source: result.source,
      query,
      queryHash: cacheHash,
      resultType: 'law_article',
      resultData: result,
      hitCount: 0,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天
      createdAt: new Date()
    }
  });

  // 5. 保存到内存缓存
  this.cache.set(cacheKey, {
    data: result,
    expiry: Date.now() + this.ttl
  });

  return result;
}
```

#### 3.2 添加配额监控

```typescript
// 在src/lib/law-article/external-api-client.ts中添加
async function checkQuota(source: string) {
  const cache = await prisma.externalCache.groupBy({
    by: ['source'],
    where: {
      source,
      createdAt: {
        gte: new Date(new Date().setDate(1)) // 本月
      }
    },
    _count: { id: true }
  });

  const usage = cache[0]?._count.id || 0;
  const limit = QUOTA_LIMITS[source as keyof typeof QUOTA_LIMITS];

  if (usage >= limit * 0.9) {
    console.warn(`${source} 配额使用即将用尽: ${usage}/${limit}`);
    // 发送告警
  }

  return { usage, limit };
}
```

### 阶段四：测试验证（1-2天）

#### 4.1 功能测试

1. 测试司法部数据导入
2. 测试CAIL案例导入
3. 测试外部API缓存
4. 测试配额监控

#### 4.2 性能测试

1. 本地查询响应时间
2. 外部API查询响应时间
3. 缓存命中率

## 数据更新策略

### 定期更新

| 数据源 | 更新频率 | 更新方式 |
|--------|----------|----------|
| 司法部 | 每月 | 下载最新数据包 |
| CAIL | 每季度 | 下载新版本数据集 |
| LaWGPT | 按需 | 更新到最新版本 |

### 增量更新

```typescript
// 增量更新脚本示例
async function incrementalUpdate(source: string) {
  // 1. 获取已导入的数据
  const existing = await prisma.lawArticle.findMany({
    where: { dataSource: source },
    select: { sourceId: true }
  });

  const existingIds = new Set(existing.map(item => item.sourceId));

  // 2. 读取新数据
  const newData = await fetchNewData(source);

  // 3. 只导入新增的数据
  const newItems = newData.filter(item => !existingIds.has(item.id));

  for (const item of newItems) {
    await prisma.lawArticle.create({
      data: {
        ...item,
        dataSource: source,
        importedAt: new Date()
      }
    });
  }

  console.log(`导入完成: ${newItems.length} 条新数据`);
}
```

## 监控与维护

### 1. 监控指标

- 外部API调用次数
- 配额使用情况
- 缓存命中率
- 查询响应时间

### 2. 告警规则

- 配额使用超过80%
- 外部API失败率超过10%
- 查询响应时间超过2秒
- 缓存命中率低于50%

### 3. 数据清理

```typescript
// 清理过期的缓存数据
async function cleanExpiredCache() {
  const result = await prisma.externalCache.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });
  console.log(`清理过期缓存: ${result.count} 条`);
}

// 清理低命中率的数据
async function cleanLowHitCache() {
  const result = await prisma.externalCache.deleteMany({
    where: {
      hitCount: { lt: 5 },
      createdAt: {
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30天前
      }
    }
  });
  console.log(`清理低命中率缓存: ${result.count} 条`);
}
```

## 成本优化建议

### 1. 智能缓存策略

- 热点数据（访问次数>10）：永久缓存
- 温数据（访问次数5-10）：缓存30天
- 冷数据（访问次数<5）：缓存7天

### 2. 外部API降级

```typescript
// 当配额不足时自动降级
if (quotaRemaining < 50) {
  console.warn('配额不足，切换到降级模式');
  return new LocalFallbackClient();
}
```

### 3. 批量查询优化

- 合并多个查询请求
- 使用外部API的批量查询接口（如果支持）

## 故障恢复

### 1. 外部API不可用

自动降级到本地数据库查询。

### 2. 数据库不可用

使用内存缓存作为临时降级方案。

### 3. 数据导入失败

- 记录错误日志
- 保存失败的数据
- 支持断点续传

## 附录

### A. 数据源链接

- 司法部法律法规公开平台：https://flk.npc.gov.cn/
- CAIL：http://www.cail.cipsc.org.cn/
- LaWGPT：https://github.com/ymcui/LaWGPT
- 法律之星：https://www.lawstar.cn/
- 北大法宝：https://www.pkulaw.com/

### B. 配额限制

| 服务 | 价格 | 配额 |
|------|------|------|
| 法律之星 | 1050元/年 | 5000次向量查询 + 1000次正文请求 |

### C. 常见问题

**Q: 如何添加新的数据源？**
A: 在 `src/lib/law-article/external-api-client.ts` 中添加新的客户端类，并实现 `IExternalLawArticleAPI` 接口。

**Q: 如何更新法条数据？**
A: 使用增量更新脚本，只导入新增或修改的数据。

**Q: 缓存会占用多少存储空间？**
A: 取决于查询量，预计每月1-5GB。

**Q: 如何监控外部API使用情况？**
A: 使用配额监控功能，定期检查配额使用情况。

## 下一步行动

1. [ ] 下载各数据源数据
2. [ ] 创建CAIL数据导入脚本
3. [ ] 创建LaWGPT数据导入脚本
4. [ ] 更新外部API客户端，添加持久化缓存
5. [ ] 执行数据导入
6. [ ] 测试验证
7. [ ] 部署到生产环境

## 联系方式

如有问题或建议，请联系项目维护者。
