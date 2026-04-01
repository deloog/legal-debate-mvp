# 知识图谱修复五维审计报告

**审计时间**: 2026-04-01  
**审计对象**: 知识图谱 API 修复代码  
**审计维度**: 功能正确性、代码质量、安全性、性能、可维护性

---

## 📊 审计概览

| 文件                         | 功能正确性 | 代码质量 | 安全性 | 性能 | 可维护性 | 综合评级 |
| ---------------------------- | ---------- | -------- | ------ | ---- | -------- | -------- |
| `relations/route.ts` GET     | ⚠️         | ✅       | ⚠️     | ✅   | ✅       | B        |
| `recommendations/route.ts`   | ❌         | ⚠️       | ⚠️     | ⚠️   | ⚠️       | C        |
| `browse/route.ts` 降级       | ✅         | ✅       | ✅     | ⚠️   | ✅       | B+       |
| `version-control/service.ts` | ❌         | ⚠️       | ⚠️     | ⚠️   | ⚠️       | D+       |
| `neighbors/paths/conflicts`  | ✅         | ✅       | ✅     | ✅   | ✅       | A        |

**评级说明**: A=优秀, B=良好, C=及格, D=需改进, F=不合格

---

## 1️⃣ 功能正确性审计

### 1.1 relations/route.ts GET 方法

**状态**: ⚠️ 基本正确，存在边界问题

**问题 1**: sourceId/targetId 空字符串验证缺失

```typescript
// 当前代码
if (sourceId) {
  where.sourceId = sourceId; // 空字符串 "" 会被视为有效值
}

// 应该改为
if (sourceId && sourceId.trim()) {
  where.sourceId = sourceId.trim();
}
```

**影响**: 可能查询不到预期结果，或返回错误数据

**修复建议**:

```typescript
if (sourceId?.trim()) {
  where.sourceId = sourceId.trim();
}
```

---

### 1.2 recommendations/route.ts

**状态**: ❌ 存在严重逻辑错误

**问题 1**: graph_distance 模式的 SQL 逻辑错误

```typescript
// 当前代码（第 197-210 行）
NOT: {
  AND: [
    { sourceId: { not: articleId } },
    { targetId: { not: articleId } },
  ],
},
```

**分析**: 这个 NOT + AND + not 的组合逻辑混乱，实际效果与预期不符

**预期**: 排除与源法条直接相关的关系
**实际**: 可能包含不正确的数据

**修复建议**:

```typescript
// 正确的逻辑：排除与源法条直接相连的关系
NOT: [
  { sourceId: articleId },
  { targetId: articleId },
],
```

**问题 2**: 2跳推荐可能包含直接邻居

- 由于 SQL 逻辑错误，2跳结果可能包含 1 跳节点
- 需要去重逻辑增强

**问题 3**: similarity 模式缺少 category 字段

- `orderBy: { createdAt: 'desc' }` 改为 `relevanceScore` 后字段不存在
- 可能返回低相关度结果

---

### 1.3 browse/route.ts 降级策略

**状态**: ✅ 逻辑正确

**问题**: 降级后仍然查询 VERIFIED 关系

```typescript
// 降级后 seedArticles 已获取，但 Step 2 仍然查询 VERIFIED 关系
// 这可能导致 relations 为空，但这是预期行为
```

**建议**: 降级情况应该放宽关系查询条件

```typescript
// 建议修改：降级情况下查询所有关系
const relationWhere: {
  verificationStatus?: VerificationStatus;
  relationType?: RelationType;
  sourceId: { in: string[] };
} = {
  sourceId: { in: seedIds },
  ...(seedArticles.length < total
    ? {}
    : { verificationStatus: VerificationStatus.VERIFIED }),
};
```

---

### 1.4 version-control/service.ts 快照查询

**状态**: ❌ 存在严重问题

**问题 1**: $queryRaw 模板字符串用法错误

```typescript
// 当前代码（第 128-138 行）
prisma.$queryRaw`
  SELECT * FROM "knowledge_graph_snapshots"
  ${where.version ? prisma.$queryRaw`WHERE version = ${where.version}` : prisma.$queryRaw``}
  ORDER BY "snapshotDate" DESC
  LIMIT ${pageSize}
  OFFSET ${skip}
`;
```

**分析**:

- 三元运算符在模板字符串中条件插入 $queryRaw 是**危险的做法**
- Prisma 的 `$queryRaw` 模板标签不支持这种动态条件构造
- 可能导致 SQL 语法错误或注入风险

**修复建议**:

```typescript
// 方法 1: 使用简单的 if-else
if (where.version) {
  snapshots = await prisma.$queryRaw`
    SELECT * FROM "knowledge_graph_snapshots"
    WHERE version = ${where.version}
    ORDER BY "snapshotDate" DESC
    LIMIT ${pageSize}
    OFFSET ${skip}
  `;
} else {
  snapshots = await prisma.$queryRaw`
    SELECT * FROM "knowledge_graph_snapshots"
    ORDER BY "snapshotDate" DESC
    LIMIT ${pageSize}
    OFFSET ${skip}
  `;
}

// 方法 2: 使用 Prisma Client（推荐）
const prismaAny = prisma as any;
return await prismaAny.knowledgeGraphSnapshot.findMany({
  where: options?.version ? { version: options.version } : {},
  orderBy: { snapshotDate: 'desc' },
  skip,
  take: pageSize,
});
```

**问题 2**: where 条件构建后未在 $queryRaw 中使用

- 构建了复杂的 where 对象，但只在 catch 块中使用
- 主查询中只使用了 where.version

---

### 1.5 neighbors/paths/conflicts 错误处理

**状态**: ✅ 正确

改进后的错误处理逻辑正确，能提供有用的错误信息。

---

## 2️⃣ 代码质量审计

### 2.1 类型安全

| 文件            | 类型断言使用                               | 评级        |
| --------------- | ------------------------------------------ | ----------- |
| relations       | `as RelationType`, `as VerificationStatus` | ⚠️ 适度     |
| recommendations | `as RelationType[]`, `as any`              | ❌ 过度使用 |
| browse          | `as LawCategory`, `as RelationType`        | ⚠️ 适度     |
| snapshots       | `as unknown`, `as Promise<>`               | ❌ 过度使用 |

**建议**: 使用 Zod 进行运行时验证

```typescript
import { z } from 'zod';

const QuerySchema = z.object({
  relationType: z.nativeEnum(RelationType).optional(),
  verificationStatus: z.nativeEnum(VerificationStatus).optional(),
});
```

### 2.2 代码重复

**recommendations/route.ts**:

- 三个推荐函数有大量重复代码（节点信息提取、去重逻辑）
- `getRelationTypeLabel` 可以提取到工具函数

**建议**: 提取公共逻辑

```typescript
// 提取到 lib/knowledge-graph/recommendation-utils.ts
export function deduplicateRecommendations(
  results: RecommendationResult[]
): RecommendationResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.articleId)) return false;
    seen.add(r.articleId);
    return true;
  });
}
```

### 2.3 文件长度

| 文件                     | 行数 | 评级      |
| ------------------------ | ---- | --------- |
| relations/route.ts       | 370  | ✅ 可接受 |
| recommendations/route.ts | 420  | ⚠️ 过长   |
| browse/route.ts          | 320  | ✅ 可接受 |

**建议**: 将 recommendations 拆分为多个文件

```
src/app/api/v1/knowledge-graph/recommendations/
├── route.ts          # 主路由，仅处理请求分发
├── strategies/
│   ├── relation-based.ts
│   ├── graph-distance.ts
│   └── similarity.ts
└── utils.ts          # 公共工具函数
```

### 2.4 注释覆盖

- 主要函数有 JSDoc 注释 ✅
- 但复杂算法（如 graph_distance 的 2 跳查询）缺少详细注释 ⚠️

---

## 3️⃣ 安全性审计

### 3.1 输入验证

| 检查项             | relations | recommendations | browse | snapshots | 状态     |
| ------------------ | --------- | --------------- | ------ | --------- | -------- |
| 认证检查           | ✅        | ✅              | ✅     | N/A       | 通过     |
| 权限检查           | ✅        | ✅              | ✅     | N/A       | 通过     |
| page/pageSize 范围 | ✅        | ✅ (缺少)       | ✅     | N/A       | 部分通过 |
| ID 格式验证        | ❌        | ❌              | N/A    | N/A       | **高危** |
| SQL 注入防护       | N/A       | N/A             | N/A    | ⚠️        | 需改进   |

**高危问题**: ID 参数未验证格式

```typescript
// 当前代码
const sourceId = searchParams.get('sourceId');
if (sourceId) {
  where.sourceId = sourceId; // 未验证 UUID/CUID 格式
}

// 应该添加验证
import { validateCUID } from '@/lib/validation';
if (sourceId && !validateCUID(sourceId)) {
  return NextResponse.json({ error: '无效的 ID 格式' }, { status: 400 });
}
```

### 3.2 SQL 注入风险

**snapshots/service.ts**:

```typescript
// 潜在风险：动态条件构造
${where.version ? prisma.$queryRaw`WHERE version = ${where.version}` : prisma.$queryRaw``}
```

虽然 Prisma 的模板标签会参数化，但**动态拼接模板字符串**的方式不推荐。

**修复**: 使用参数化查询

```typescript
const snapshots = await prisma.$queryRaw`
  SELECT * FROM "knowledge_graph_snapshots"
  WHERE (${where.version} IS NULL OR version = ${where.version})
  ORDER BY "snapshotDate" DESC
  LIMIT ${pageSize}
  OFFSET ${skip}
`;
```

### 3.3 信息泄露

**recommendations/route.ts**:

```typescript
return NextResponse.json(
  { success: false, error: '源法条不存在' }, // 泄露信息
  { status: 404 }
);
```

**建议**: 模糊错误信息

```typescript
return NextResponse.json(
  { success: false, error: '请求的资源不存在' },
  { status: 404 }
);
```

---

## 4️⃣ 性能审计

### 4.1 数据库查询性能

#### browse/route.ts 降级策略

```
问题: 可能执行两次 count 查询
- 第一次: count with VERIFIED filter
- 第二次: count without filter (降级时)

影响: 数据库压力翻倍
```

**优化建议**:

```typescript
// 使用单个查询
const result = await prisma.$queryRaw`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN "verificationStatus" = 'VERIFIED' THEN 1 END) as verified_count
  FROM law_articles
  WHERE ...
`;
```

#### recommendations/route.ts

**graph_distance 模式**:

```typescript
// 问题 1: 查询了所有直接邻居关系
const directRelations = await prisma.lawArticleRelation.findMany({
  // 可能返回大量数据
});

// 问题 2: IN 查询可能包含大量 ID
const secondHopRelations = await prisma.lawArticleRelation.findMany({
  where: {
    OR: [
      { sourceId: { in: directNeighborIds } }, // 可能 1000+ IDs
      { targetId: { in: directNeighborIds } },
    ],
  },
});
```

**性能影响**:

- IN 子句长度限制（PostgreSQL 约 32767）
- 查询计划可能退化为全表扫描

**优化建议**:

```typescript
// 限制直接邻居数量
const directNeighborIds = directRelations
  .map(r => (r.sourceId === articleId ? r.targetId : r.sourceId))
  .slice(0, 100); // 限制 100 个

// 或使用递归 CTE（推荐）
const results = await prisma.$queryRaw`
  WITH RECURSIVE graph AS (
    -- 1-hop 查询
    SELECT target_id, 1 as depth
    FROM law_article_relations
    WHERE source_id = ${articleId} AND verification_status = 'VERIFIED'
    
    UNION ALL
    
    -- 2-hop 查询
    SELECT r.target_id, g.depth + 1
    FROM law_article_relations r
    JOIN graph g ON r.source_id = g.target_id
    WHERE g.depth < 2
      AND r.verification_status = 'VERIFIED'
  )
  SELECT * FROM graph WHERE depth = 2
  LIMIT ${limit}
`;
```

#### snapshots/service.ts

**原始 SQL 问题**:

```sql
SELECT * FROM "knowledge_graph_snapshots"
ORDER BY "snapshotDate" DESC
LIMIT ${pageSize}
OFFSET ${skip}
```

**潜在问题**:

- `SELECT *` 可能包含大字段（snapshotData, changes）
- OFFSET 在大页码时性能下降（O(n) 复杂度）

**优化建议**:

```typescript
// 只查询需要的字段
const snapshots = await prisma.$queryRaw`
  SELECT id, version, "versionLabel", "totalArticles", 
         "totalRelations", "verifiedRelations", status,
         "snapshotDate", description, "createdBy"
  FROM "knowledge_graph_snapshots"
  ORDER BY "snapshotDate" DESC
  LIMIT ${pageSize}
  OFFSET ${skip}
`;

// 或使用游标分页（大表推荐）
```

### 4.2 内存使用

**recommendations/route.ts**:

```typescript
// 可能占用大量内存
const recommendations: RecommendationResult[] = [];
// ... 最多 limit * 3 个元素

// 使用 Set 去重
const seenIds = new Set<string>();
```

**内存占用**: O(limit \* 3) ≈ 150 个对象，可接受

---

## 5️⃣ 可维护性审计

### 5.1 代码组织结构

**当前问题**:

```
src/app/api/v1/knowledge-graph/
├── relations/route.ts      # 250行（GET+POST）
├── recommendations/route.ts # 420行（过于庞大）
├── browse/route.ts         # 320行
```

**推荐结构**:

```
src/app/api/v1/knowledge-graph/
├── relations/
│   ├── route.ts           # 仅路由分发
│   ├── GET.ts             # GET 处理器
│   └── POST.ts            # POST 处理器
├── recommendations/
│   ├── route.ts           # 仅路由分发
│   ├── strategies/
│   │   ├── index.ts
│   │   ├── relation-based.ts
│   │   ├── graph-distance.ts
│   │   └── similarity.ts
│   └── utils.ts
└── lib/                   # 共享逻辑
    ├── validators.ts
    ├── formatters.ts
    └── types.ts
```

### 5.2 错误处理一致性

**不一致的错误格式**:

```typescript
// relations GET
{ success: false, error: '未授权，请先登录' }

// relations POST
{ success: false, error: '缺少必需参数: sourceId' }

// browse
{ error: '服务器错误' }  // 没有 success 字段
```

**建议标准化**:

```typescript
// 统一错误格式
interface ApiError {
  success: false;
  error: {
    code: string; // 错误码，如 UNAUTHORIZED, VALIDATION_ERROR
    message: string; // 用户友好的错误信息
    details?: unknown; // 详细信息（可选）
  };
}

// 使用辅助函数
import { createError } from '@/lib/api/errors';
return NextResponse.json(createError('UNAUTHORIZED', '未授权，请先登录'), {
  status: 401,
});
```

### 5.3 配置管理

**硬编码值**:

```typescript
const limit = Math.min(50, Math.max(1, parseInt(...)));  // 50 硬编码
const pageSize = Math.min(100, Math.max(1, ...));        // 100 硬编码
const MIN_STRENGTH = 0.5;                                // 0.5 硬编码
```

**建议**:

```typescript
// src/lib/knowledge-graph/config.ts
export const KG_CONFIG = {
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
    defaultPageSize: 20,
    maxPageSize: 100,
  },
  recommendations: {
    defaultLimit: 10,
    maxLimit: 50,
    minStrength: 0.5,
    maxHops: 2,
  },
} as const;
```

### 5.4 测试覆盖

**缺失测试**:

- recommendations/route.ts 无单元测试
- snapshots/service.ts 降级逻辑无测试
- browse/route.ts 降级场景无测试

---

## 🎯 关键问题汇总

### 🔴 严重问题（必须修复）

| 优先级 | 问题                        | 文件                      | 修复建议                      |
| ------ | --------------------------- | ------------------------- | ----------------------------- |
| P0     | $queryRaw 模板字符串错误    | snapshots/service.ts      | 使用 if-else 或 Prisma Client |
| P0     | graph_distance SQL 逻辑错误 | recommendations/route.ts  | 修正 NOT 条件逻辑             |
| P0     | ID 格式未验证               | relations/recommendations | 添加 UUID/CUID 验证           |

### 🟡 中等问题（建议修复）

| 优先级 | 问题             | 文件               | 修复建议             |
| ------ | ---------------- | ------------------ | -------------------- |
| P1     | 空字符串验证缺失 | relations/route.ts | 使用 `?.trim()`      |
| P1     | 重复 count 查询  | browse/route.ts    | 合并为单次查询       |
| P1     | 代码文件过长     | recommendations    | 拆分为模块           |
| P1     | 错误格式不一致   | 多个文件           | 使用统一错误辅助函数 |

### 🟢 低优先级（可选优化）

| 优先级 | 问题     | 文件            | 修复建议       |
| ------ | -------- | --------------- | -------------- |
| P2     | 硬编码值 | 多个文件        | 提取到配置文件 |
| P2     | 缺少测试 | 新增文件        | 补充单元测试   |
| P2     | 信息泄露 | recommendations | 模糊错误信息   |

---

## 📋 修复任务清单

```markdown
- [ ] P0: 修复 snapshots/service.ts 的 $queryRaw 用法
- [ ] P0: 修复 recommendations graph_distance SQL 逻辑
- [ ] P0: 添加 ID 格式验证中间件
- [ ] P1: 添加空字符串验证
- [ ] P1: 优化 browse 的双 count 查询
- [ ] P1: 拆分 recommendations 为模块
- [ ] P1: 统一错误处理格式
- [ ] P2: 提取配置常量
- [ ] P2: 补充单元测试
- [ ] P2: 使用 Zod 进行运行时验证
```

---

## 📈 改进后预期评级

执行所有 P0 和 P1 修复后，预期评级：

| 文件            | 当前 | 预期 |
| --------------- | ---- | ---- |
| relations GET   | B    | A-   |
| recommendations | C    | B+   |
| browse 降级     | B+   | A-   |
| snapshots       | D+   | B+   |

**整体代码质量**: C → B+

---

_审计完成时间_: 2026-04-01  
_审计人员_: AI Assistant
