# 知识图谱测试脚本审计报告

## 审计发现

### 🔴 严重问题 1: getRecommendations 参数不匹配

**测试脚本** (第281-291行):

```typescript
async getRecommendations(caseId?: string, text?: string) {
  const params = new URLSearchParams();
  if (caseId) params.append('caseId', caseId);
  if (text) params.append('text', text);
  return this.request('GET', `/api/v1/knowledge-graph/recommendations?${params.toString()}`);
}
```

**实际 API** (`src/app/api/v1/knowledge-graph/recommendations/route.ts`):

- 期望参数: `articleId` (必需)
- 可选参数: `mode`, `limit`, `relationTypes`
- 不支持: `caseId`, `text`

**测试调用** (第596行):

```typescript
const response = await client.getRecommendations(undefined, '合同纠纷案例分析');
```

**问题**: 调用时 `caseId` 为 `undefined`，`text` 被传入但 API 不识别

---

### 🔴 严重问题 2: browseGraph 返回类型不匹配

**测试脚本** (第303-308行):

```typescript
async browseGraph(cursor?: string, limit = 20): Promise<ApiResponse<{
  nodes: LawArticle[];
  nextCursor?: string;
}>>
```

**实际 API 返回**:

```typescript
{
  success: true,
  data: {
    nodes: GraphNode[];  // 不是 LawArticle[]
    links: GraphLink[];
  },
  pagination: {...}
}
```

**问题**:

1. 测试期望 `data.nodes`，实际返回 `data.data.nodes`
2. 测试期望 `LawArticle[]`，实际是 `GraphNode[]` (有 `level` 字段)
3. 测试期望 `nextCursor`，实际是 `pagination`

---

### 🔴 严重问题 3: getNeighbors 参数名错误

**测试脚本** (第295-298行):

```typescript
async getNeighbors(articleId: string, depth = 1) {
  return this.request('GET', `/api/v1/knowledge-graph/neighbors?id=${articleId}&depth=${depth}`);
}
```

**实际 API 期望** (`src/app/api/v1/knowledge-graph/neighbors/route.ts` 第44行):

```typescript
const nodeId = searchParams.get('nodeId'); // 不是 'id'
```

**问题**: 参数名 `id` vs `nodeId` 不匹配

---

### 🟡 中等问题 4: 测试期望与设计意图不符

**测试** (第544行):

```typescript
assert(response.success === true, 'Browse should succeed');
assert(Array.isArray(response.data?.nodes), 'nodes should be array');
```

**设计意图**: browse API 是一个**浏览接口**，应该：

1. 不要求特定参数
2. 返回图谱概览数据
3. 支持分页

**问题**: 测试期望旧格式，但 API 已更新为新格式

---

## 修复建议

### 方案 A: 修复测试脚本（推荐）

让测试脚本适配实际 API 设计。

### 方案 B: 修复 API 适配测试

让 API 适配测试脚本的期望（不推荐，可能破坏前端）。

---

## 决策

选择 **方案 A**：修复测试脚本以匹配实际 API 设计。
