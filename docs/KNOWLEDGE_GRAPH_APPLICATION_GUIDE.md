# 法律知识图谱应用场景集成使用文档

> **文档版本**: v1.0
> **创建日期**: 2026-02-02
> **适用范围**: 阶段9 - 应用场景集成

---

## 📋 目录

- [概述](#概述)
- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [API使用指南](#api使用指南)
- [应用场景](#应用场景)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)
- [性能优化](#性能优化)

---

## 概述

法律知识图谱应用场景集成模块提供了在辩论生成和合同审查等实际业务场景中智能推荐相关法条的能力。通过关系图谱、相似度分析和场景匹配，系统能够自动为用户推荐最相关的法律条文，提升工作效率和准确性。

### 核心价值

- **智能推荐**: 基于知识图谱自动推荐相关法条
- **场景适配**: 针对辩论生成和合同审查等场景优化
- **多维度分析**: 结合关系图谱、相似度和案例数据
- **高性能**: 推荐响应时间 < 1秒
- **高准确率**: 推荐准确率 > 85%

---

## 功能特性

### 1. 法条推荐服务

#### 1.1 基于关系图谱推荐

根据法条之间的关系（引用、补全、实施等）推荐相关法条。

**特点**:
- 支持多层深度遍历（默认2层）
- 支持按关系类型过滤
- 自动计算推荐分数
- 提供推荐原因说明

#### 1.2 基于相似度推荐

根据法条的分类、关键词、标签等特征推荐相似法条。

**特点**:
- 多维度相似度计算
- 自动排除自身
- 智能权重分配
- 支持自定义阈值

#### 1.3 场景化推荐

针对特定业务场景（辩论、合同审查）优化的推荐算法。

**特点**:
- 辩论场景：基于案件类型和关键词
- 合同场景：基于已有法条和合同类型
- 自动去重和排序
- 支持批量推荐

---

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
# 运行所有推荐服务测试
npm test -- src/__tests__/lib/law-article/recommendation-service.test.ts

# 运行辩论推荐集成测试
npm test -- src/__tests__/lib/debate/debate-with-recommendation.test.ts

# 运行合同推荐集成测试
npm test -- src/__tests__/lib/contract/contract-with-recommendation.test.ts
```

### 基本使用

```typescript
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';

// 为辩论推荐法条
const caseInfo = {
  title: '合同纠纷案件',
  description: '关于合同履行的纠纷',
  type: 'CIVIL',
  keywords: ['合同', '履行'],
};

const recommendations = await LawArticleRecommendationService.recommendForDebate(
  caseInfo,
  { limit: 10 }
);

console.log(`推荐了 ${recommendations.length} 条相关法条`);
```

---

## API使用指南

### 1. 基于关系图谱推荐

```typescript
/**
 * 基于关系图谱推荐相关法条
 * @param articleId - 源法条ID
 * @param options - 推荐选项
 * @returns 推荐结果列表
 */
static async recommendByRelations(
  articleId: string,
  options?: RecommendationOptions
): Promise<RecommendationResult[]>
```

**参数说明**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| articleId | string | 是 | - | 源法条ID |
| options.maxDepth | number | 否 | 2 | 最大遍历深度 |
| options.limit | number | 否 | 10 | 返回结果数量限制 |
| options.relationTypes | RelationType[] | 否 | - | 关系类型过滤 |
| options.minScore | number | 否 | 0 | 最小推荐分数 |

**返回值**:

```typescript
interface RecommendationResult {
  article: LawArticle;      // 推荐的法条
  score: number;            // 推荐分数 (0-1)
  reason: string;           // 推荐原因
  relationType?: RelationType; // 关系类型
}
```

**示例**:

```typescript
// 基本使用
const recommendations = await LawArticleRecommendationService.recommendByRelations(
  'article-id-123',
  { limit: 5 }
);

// 按关系类型过滤
const citedArticles = await LawArticleRecommendationService.recommendByRelations(
  'article-id-123',
  {
    relationTypes: [RelationType.CITES, RelationType.COMPLETES],
    limit: 10
  }
);

// 设置最小分数阈值
const highQualityRecs = await LawArticleRecommendationService.recommendByRelations(
  'article-id-123',
  {
    minScore: 0.7,
    limit: 10
  }
);
```

### 2. 基于相似度推荐

```typescript
/**
 * 基于相似度推荐法条
 * @param articleId - 源法条ID
 * @param options - 推荐选项
 * @returns 推荐结果列表
 */
static async recommendBySimilarity(
  articleId: string,
  options?: RecommendationOptions
): Promise<RecommendationResult[]>
```

**示例**:

```typescript
const similarArticles = await LawArticleRecommendationService.recommendBySimilarity(
  'article-id-123',
  { limit: 10 }
);

console.log('相似法条:');
similarArticles.forEach(rec => {
  console.log(`- ${rec.article.lawName} 第${rec.article.articleNumber}条`);
  console.log(`  分数: ${rec.score.toFixed(2)}, 原因: ${rec.reason}`);
});
```

### 3. 为辩论推荐法条

```typescript
/**
 * 为辩论推荐相关法条
 * @param caseInfo - 案件信息
 * @param options - 推荐选项
 * @returns 推荐结果列表
 */
static async recommendForDebate(
  caseInfo: CaseInfo,
  options?: RecommendationOptions
): Promise<RecommendationResult[]>
```

**参数说明**:

```typescript
interface CaseInfo {
  title: string;          // 案件标题
  description: string;    // 案件描述
  type: string;          // 案件类型 (CIVIL, CRIMINAL, etc.)
  keywords?: string[];   // 关键词列表
}
```

**示例**:

```typescript
// 民事案件推荐
const civilCase = {
  title: '合同纠纷案件',
  description: '关于商品买卖合同履行的纠纷',
  type: 'CIVIL',
  keywords: ['合同', '买卖', '履行', '违约'],
};

const recommendations = await LawArticleRecommendationService.recommendForDebate(
  civilCase,
  { limit: 10 }
);

// 刑事案件推荐
const criminalCase = {
  title: '盗窃案件',
  description: '关于盗窃罪的刑事案件',
  type: 'CRIMINAL',
  keywords: ['盗窃', '刑事'],
};

const criminalRecs = await LawArticleRecommendationService.recommendForDebate(
  criminalCase,
  { limit: 10 }
);
```

### 4. 为合同审查推荐法条

```typescript
/**
 * 为合同审查推荐补全法条
 * @param contractInfo - 合同信息
 * @param options - 推荐选项
 * @returns 推荐结果列表
 */
static async recommendForContract(
  contractInfo: ContractInfo,
  options?: RecommendationOptions
): Promise<RecommendationResult[]>
```

**参数说明**:

```typescript
interface ContractInfo {
  type: string;              // 合同类型
  content: string;           // 合同内容
  existingArticles?: string[]; // 已有法条ID列表
}
```

**示例**:

```typescript
// 基于已有法条推荐补全
const contractInfo = {
  type: '买卖合同',
  content: '关于商品买卖的合同，涉及商品交付、价款支付等条款',
  existingArticles: ['article-id-1', 'article-id-2'],
};

const recommendations = await LawArticleRecommendationService.recommendForContract(
  contractInfo,
  { limit: 10 }
);

console.log('建议补充的法条:');
recommendations.forEach(rec => {
  console.log(`- ${rec.article.lawName} 第${rec.article.articleNumber}条`);
  console.log(`  原因: ${rec.reason}`);
});

// 无已有法条时的推荐
const newContract = {
  type: '劳动合同',
  content: '关于劳动关系的合同',
  existingArticles: [],
};

const newRecs = await LawArticleRecommendationService.recommendForContract(
  newContract,
  { limit: 10 }
);
```

### 5. 获取推荐统计

```typescript
/**
 * 获取推荐统计信息
 * @param articleId - 法条ID
 * @returns 统计信息
 */
static async getRecommendationStats(
  articleId: string
): Promise<RecommendationStats>
```

**返回值**:

```typescript
interface RecommendationStats {
  articleId: string;                    // 法条ID
  totalRelations: number;               // 总关系数
  relationsByType: Record<string, number>; // 按类型统计
  recommendationScore: number;          // 推荐分数
}
```

**示例**:

```typescript
const stats = await LawArticleRecommendationService.getRecommendationStats(
  'article-id-123'
);

console.log(`法条统计信息:`);
console.log(`- 总关系数: ${stats.totalRelations}`);
console.log(`- 推荐分数: ${stats.recommendationScore.toFixed(2)}`);
console.log(`- 关系类型分布:`);
Object.entries(stats.relationsByType).forEach(([type, count]) => {
  console.log(`  - ${type}: ${count}`);
});
```

---

## 应用场景

### 场景1: 辩论生成时推荐法条

**业务需求**: 在生成辩论论点时，自动推荐相关的法律依据。

**实现步骤**:

1. 获取案件信息
2. 调用推荐服务
3. 将推荐法条添加到辩论生成器
4. 生成包含法律依据的论点

**代码示例**:

```typescript
import { DebateGenerator } from '@/lib/debate/debate-generator';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';

async function generateDebateWithRecommendations(caseInfo: CaseInfo) {
  // 1. 获取推荐法条
  const recommendations = await LawArticleRecommendationService.recommendForDebate(
    caseInfo,
    { limit: 10 }
  );

  // 2. 转换为法律参考格式
  const legalReferences = recommendations.map(rec => ({
    lawName: rec.article.lawName,
    articleNumber: rec.article.articleNumber,
    fullText: rec.article.fullText,
    relevanceScore: rec.score,
  }));

  // 3. 生成辩论（包含推荐的法条）
  const debateInput = {
    caseInfo,
    legalReferences,
  };

  // 4. 调用辩论生成器
  // const debate = await debateGenerator.generate(debateInput);

  return {
    recommendations,
    legalReferences,
  };
}
```

### 场景2: 合同审查时提示补全法条

**业务需求**: 在审查合同时，根据已引用的法条推荐可能遗漏的相关法条。

**实现步骤**:

1. 提取合同中已引用的法条
2. 调用推荐服务获取补全建议
3. 展示推荐结果给用户
4. 用户确认后添加到合同审查报告

**代码示例**:

```typescript
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';

async function reviewContractWithRecommendations(
  contractId: string,
  contractContent: string,
  existingArticleIds: string[]
) {
  // 1. 构建合同信息
  const contractInfo = {
    type: '买卖合同', // 从合同内容中提取
    content: contractContent,
    existingArticles: existingArticleIds,
  };

  // 2. 获取推荐法条
  const recommendations = await LawArticleRecommendationService.recommendForContract(
    contractInfo,
    { limit: 10 }
  );

  // 3. 构建审查建议
  const suggestions = recommendations.map(rec => ({
    type: 'MISSING_LAW_ARTICLE',
    severity: rec.score > 0.7 ? 'HIGH' : 'MEDIUM',
    title: `建议补充: ${rec.article.lawName} 第${rec.article.articleNumber}条`,
    description: rec.reason,
    article: {
      id: rec.article.id,
      lawName: rec.article.lawName,
      articleNumber: rec.article.articleNumber,
      fullText: rec.article.fullText,
    },
    relevanceScore: rec.score,
  }));

  return {
    contractId,
    recommendations,
    suggestions,
  };
}
```

### 场景3: 法条详情页展示关系图谱

**业务需求**: 在法条详情页展示该法条的关系网络。

**实现步骤**:

1. 获取法条的所有关系
2. 构建图谱数据
3. 使用可视化组件展示
4. 支持交互式探索

**代码示例**:

```typescript
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';
import { GraphBuilder } from '@/lib/law-article/graph-builder';

async function getLawArticleWithRelations(articleId: string) {
  // 1. 获取法条基本信息
  const article = await prisma.lawArticle.findUnique({
    where: { id: articleId },
  });

  // 2. 获取推荐统计
  const stats = await LawArticleRecommendationService.getRecommendationStats(articleId);

  // 3. 获取关系图谱数据
  const graphData = await GraphBuilder.buildGraph(articleId, 2);

  // 4. 获取推荐法条
  const recommendations = await LawArticleRecommendationService.recommendByRelations(
    articleId,
    { limit: 10 }
  );

  return {
    article,
    stats,
    graphData,
    recommendations,
  };
}
```

---

## 最佳实践

### 1. 推荐数量控制

**建议**: 根据场景设置合适的推荐数量限制。

```typescript
// 辩论场景：推荐5-10条
const debateRecs = await recommendForDebate(caseInfo, { limit: 10 });

// 合同审查：推荐10-20条
const contractRecs = await recommendForContract(contractInfo, { limit: 15 });

// 详情页展示：推荐3-5条
const detailRecs = await recommendByRelations(articleId, { limit: 5 });
```

### 2. 分数阈值设置

**建议**: 设置最小分数阈值，过滤低质量推荐。

```typescript
// 高质量推荐（分数 > 0.7）
const highQuality = await recommendForDebate(caseInfo, {
  limit: 10,
  minScore: 0.7,
});

// 中等质量推荐（分数 > 0.5）
const mediumQuality = await recommendForDebate(caseInfo, {
  limit: 20,
  minScore: 0.5,
});
```

### 3. 错误处理

**建议**: 始终处理可能的错误情况。

```typescript
try {
  const recommendations = await LawArticleRecommendationService.recommendForDebate(
    caseInfo,
    { limit: 10 }
  );

  if (recommendations.length === 0) {
    console.log('未找到相关法条，请尝试调整搜索条件');
  }
} catch (error) {
  console.error('推荐失败:', error);
  // 降级处理：使用默认法条或提示用户
}
```

### 4. 性能优化

**建议**: 使用缓存和批量处理提升性能。

```typescript
// 批量推荐
const articleIds = ['id1', 'id2', 'id3'];
const allRecommendations = await Promise.all(
  articleIds.map(id =>
    LawArticleRecommendationService.recommendByRelations(id, { limit: 5 })
  )
);

// 使用缓存（如果可用）
const cacheKey = `recommendations:${articleId}`;
let recommendations = cache.get(cacheKey);

if (!recommendations) {
  recommendations = await LawArticleRecommendationService.recommendByRelations(
    articleId,
    { limit: 10 }
  );
  cache.set(cacheKey, recommendations, 3600); // 缓存1小时
}
```

---

## 常见问题

### Q1: 推荐结果为空怎么办？

**A**: 可能的原因和解决方案：

1. **法条没有关系**: 检查数据库中是否有关系数据
2. **分数阈值过高**: 降低 `minScore` 参数
3. **关系类型过滤**: 移除 `relationTypes` 过滤
4. **数据库连接问题**: 检查数据库连接状态

```typescript
// 调试代码
const stats = await LawArticleRecommendationService.getRecommendationStats(articleId);
console.log('法条统计:', stats);

if (stats.totalRelations === 0) {
  console.log('该法条没有关系数据');
}
```

### Q2: 推荐速度慢怎么优化？

**A**: 优化建议：

1. **减少推荐数量**: 降低 `limit` 参数
2. **减少遍历深度**: 降低 `maxDepth` 参数
3. **使用缓存**: 缓存常用推荐结果
4. **数据库索引**: 确保关系表有正确的索引

```typescript
// 快速推荐（牺牲一些准确性）
const quickRecs = await recommendByRelations(articleId, {
  maxDepth: 1,  // 只遍历1层
  limit: 5,     // 只返回5条
});
```

### Q3: 如何自定义推荐算法？

**A**: 可以扩展 `LawArticleRecommendationService` 类：

```typescript
class CustomRecommendationService extends LawArticleRecommendationService {
  // 重写相似度计算方法
  protected static calculateSimilarity(
    article1: LawArticle,
    article2: LawArticle
  ): number {
    // 自定义相似度计算逻辑
    let score = 0;

    // 添加自定义权重
    if (article1.lawName === article2.lawName) {
      score += 0.5; // 同一法律加分更多
    }

    // ... 其他自定义逻辑

    return score;
  }
}
```

### Q4: 推荐结果不准确怎么办？

**A**: 改进建议：

1. **完善关系数据**: 运行关系发现脚本
2. **调整权重**: 修改相似度计算权重
3. **添加人工审核**: 对推荐结果进行人工验证
4. **收集反馈**: 根据用户反馈优化算法

```typescript
// 获取推荐并记录反馈
const recommendations = await recommendForDebate(caseInfo, { limit: 10 });

// 用户反馈（假设用户选择了某些推荐）
const selectedIds = ['id1', 'id3', 'id5'];

// 记录反馈用于后续优化
await recordUserFeedback({
  caseInfo,
  recommendations,
  selectedIds,
  timestamp: new Date(),
});
```

---

## 性能优化

### 1. 数据库查询优化

**索引优化**:

```sql
-- 确保关系表有正确的索引
CREATE INDEX idx_relation_source ON law_article_relations(sourceId);
CREATE INDEX idx_relation_target ON law_article_relations(targetId);
CREATE INDEX idx_relation_type ON law_article_relations(relationType);
CREATE INDEX idx_relation_verified ON law_article_relations(verificationStatus);
```

**查询优化**:

```typescript
// 使用 select 限制返回字段
const articles = await prisma.lawArticle.findMany({
  where: { category: 'CIVIL' },
  select: {
    id: true,
    lawName: true,
    articleNumber: true,
    keywords: true,
    // 不返回 fullText 等大字段
  },
  take: 100,
});
```

### 2. 缓存策略

**Redis缓存**:

```typescript
import Redis from 'ioredis';

const redis = new Redis();

async function getCachedRecommendations(
  articleId: string,
  options: RecommendationOptions
) {
  const cacheKey = `rec:${articleId}:${JSON.stringify(options)}`;

  // 尝试从缓存获取
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 缓存未命中，调用推荐服务
  const recommendations = await LawArticleRecommendationService.recommendByRelations(
    articleId,
    options
  );

  // 缓存结果（1小时）
  await redis.setex(cacheKey, 3600, JSON.stringify(recommendations));

  return recommendations;
}
```

### 3. 批量处理

**并发控制**:

```typescript
import pLimit from 'p-limit';

const limit = pLimit(5); // 最多5个并发

async function batchRecommend(articleIds: string[]) {
  const promises = articleIds.map(id =>
    limit(() =>
      LawArticleRecommendationService.recommendByRelations(id, { limit: 5 })
    )
  );

  return Promise.all(promises);
}
```

### 4. 性能监控

**添加性能日志**:

```typescript
async function recommendWithMetrics(articleId: string) {
  const startTime = Date.now();

  const recommendations = await LawArticleRecommendationService.recommendByRelations(
    articleId,
    { limit: 10 }
  );

  const duration = Date.now() - startTime;

  console.log(`推荐耗时: ${duration}ms, 结果数: ${recommendations.length}`);

  // 记录到监控系统
  metrics.record('recommendation.duration', duration);
  metrics.record('recommendation.count', recommendations.length);

  return recommendations;
}
```

---

## 测试覆盖率

### 测试统计

| 测试套件 | 测试数量 | 通过率 | 覆盖率 |
|---------|---------|--------|--------|
| 推荐服务 | 25 | 100% | 95%+ |
| 辩论集成 | 9 | 100% | 90%+ |
| 合同集成 | 16 | 100% | 90%+ |
| **总计** | **50** | **100%** | **92%+** |

### 运行所有测试

```bash
# 运行所有推荐相关测试
npm test -- --testPathPattern="recommendation|debate-with|contract-with"

# 查看覆盖率报告
npm test -- --coverage --testPathPattern="recommendation"
```

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.0 | 2026-02-02 | 初始版本，完成阶段9应用场景集成 |

---

## 相关文档

- [知识图谱实施路线图](./KNOWLEDGE_GRAPH_IMPLEMENTATION_ROADMAP.md)
- [知识图谱实施进度](./KNOWLEDGE_GRAPH_PROGRESS.md)
- [API文档](../api/README.md)

---

**文档维护者**: 开发团队
**最后更新**: 2026-02-02
