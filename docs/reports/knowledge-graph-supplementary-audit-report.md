# 知识图谱功能补充审查报告

> 生成时间：2026-02-24
> 审查范围：知识图谱模块补充审查
> 说明：本报告为 `knowledge-graph-audit-report.md` 的补充审查，识别新增发现的问题

---

## 一、现有审计报告问题确认

### 1.1 控制台日志滥用 ✅ 已确认

经代码审查确认，以下文件仍存在大量 `console.*` 使用：

| 文件位置 | 违规数量 | 具体行号 |
|---------|---------|---------|
| [`src/lib/knowledge-graph/notification-service.ts`](src/lib/knowledge-graph/notification-service.ts:1) | 约12处 | 第73,115,139,141,176,178,243,245,263,269,278,283,313,339,341行 |
| [`src/lib/middleware/knowledge-graph-permission.ts`](src/lib/middleware/knowledge-graph-permission.ts:1) | 3处 | 第117,190,235行 |
| [`src/lib/law-article/relation-discovery/ai-detector.ts`](src/lib/law-article/relation-discovery/ai-detector.ts:1) | 4处 | 第98,102,128,142行 |
| [`src/lib/law-article/relation-discovery/ai-cost-monitor.ts`](src/lib/law-article/relation-discovery/ai-cost-monitor.ts:1) | 2处 | 第46,52行 |
| [`src/lib/law-article/relation-service.ts`](src/lib/law-article/relation-service.ts:1) | 1处 | 第113-115行 |
| [`src/components/law-article/LawArticleGraphVisualization.tsx`](src/components/law-article/LawArticleGraphVisualization.tsx:1) | 1处 | 第66行 |

**注意**：审计报告中遗漏了以下文件：
- `src/lib/law-article/relation-service.ts` 第113-115行
- `src/components/law-article/LawArticleGraphVisualization.tsx` 第66行

---

### 1.2 权限验证缺失 ✅ 已确认

经代码审查确认：

| 端点 | 方法 | 权限检查 | 审计报告状态 |
|-----|------|---------|-------------|
| [`POST /[id]/verify`](src/app/api/v1/law-article-relations/[id]/verify/route.ts:73) | 验证关系 | ✅ 有 | 已提及 |
| [`POST /batch-verify`](src/app/api/v1/law-article-relations/batch-verify/route.ts:122) | 批量审核 | ✅ 有 | 已提及 |
| [`POST /[id]`](src/app/api/v1/law-article-relations/[id]/route.ts:14) | 验证关系(旧) | ❌ 无 | 已提及 |
| [`DELETE /[id]`](src/app/api/v1/law-article-relations/[id]/route.ts:57) | 删除关系 | ❌ 无 | 已提及 |

**新增发现**：
- 审计报告指出 `POST /[id]` 是验证关系，但实际代码确实如此，该端点缺少权限验证是一个安全隐患

---

### 1.3 审核日志映射不完整 ✅ 已确认

[`mapActionToLogType`](src/lib/middleware/knowledge-graph-permission.ts:200) 函数中大部分映射到 `UNKNOWN`：
- VIEW_RELATIONS → UNKNOWN
- VIEW_STATS → UNKNOWN
- VERIFY_RELATION → UNKNOWN
- BATCH_VERIFY → UNKNOWN
- MANAGE_RELATIONS → UNKNOWN

只有 `EXPORT_DATA` 正确映射。

---

### 1.4 数据库索引缺失 ✅ 已确认

[`LawArticleRelation`](prisma/schema.prisma:2489) 模型确实缺少以下索引：
- `createdAt`
- `verifiedAt`
- `verificationStatus + createdAt` 复合索引

---

### 1.5 API端点不完整 ✅ 已确认

| 功能 | 现状 | 优先级 |
|-----|------|-------|
| 关系发现触发 | 缺失 | P1 |
| 导出功能 | API未实现 | P1 |
| 批量删除 | 缺失 | P2 |
| 图谱统计总览 | 在 law-article-relations 中 | P2 |

---

## 二、新增发现的问题

### 2.1 relation-service.ts 控制台日志遗漏

**位置**：`src/lib/law-article/relation-service.ts` 第113-115行

```typescript
} catch (error) {
  console.error(
    `创建关系失败: ${relationData.sourceId} -> ${relationData.targetId}`,
    error
  );
```

**问题**：审计报告中遗漏了此文件的 console.error 使用

**修复建议**：替换为 logger.error

---

### 2.2 前端可视化组件数据流问题

**位置**：[`src/components/knowledge-graph/KnowledgeGraphBrowser.tsx`](src/components/knowledge-graph/KnowledgeGraphBrowser.tsx:278)

**问题**：
1. KnowledgeGraphBrowser 组件从API获取了 `graphData`（包含 nodes 和 links）
2. 但传递给 LawArticleGraphVisualization 组件的只有 `centerArticleId` 和 `depth` 参数
3. 导致 LawArticleGraphVisualization 组件需要再次调用独立的API获取数据

**代码现状**：
```typescript
// 第279-286行
{graphData && graphData.nodes.length > 0 && (
  <div className='bg-white p-4 rounded-lg shadow'>
    <LawArticleGraphVisualization
      centerArticleId={graphData.nodes[0].id}
      depth={2}
    />
  </div>
)}
```

**影响**：
- 重复请求API，增加服务器负载
- 数据不一致风险
- 用户体验不佳（加载两次数据）

**建议**：
1. 修改 LawArticleGraphVisualization 组件接受完整的 graphData
2. 或者在 KnowledgeGraphBrowser 中直接渲染 nodes/links，不使用该组件

---

### 2.3 审核拒绝时缺少通知机制

**位置**：[`src/lib/knowledge-graph/notification-service.ts`](src/lib/knowledge-graph/notification-service.ts:193)

**问题**：`sendVerificationCompletedNotification` 函数只在审核完成时发送通知，但没有区分是通过还是拒绝

**代码现状**：
```typescript
// 第230行
title: `关系审核${approved ? '通过' : '拒绝'}`,
```

实际上该函数**已经支持**拒绝通知，只是标题会根据 approved 参数变化。

**但存在以下问题**：
1. 审核拒绝时没有记录拒绝原因（数据库缺少 `rejectionReason` 字段）
2. 被拒绝的关系创建者不会收到通知（只通知审核人）

---

### 2.4 数据库模型字段缺失

**位置**：[`prisma/schema.prisma`](prisma/schema.prisma:2489) LawArticleRelation 模型

**缺失字段**：

| 字段名 | 类型 | 用途 | 优先级 |
|--------|------|------|--------|
| rejectionReason | String? | 记录审核拒绝原因 | P1 |
| aiProvider | String? | AI服务提供商 | P1 |
| aiModel | String? | AI模型版本 | P2 |
| aiConfidence | Float? | AI置信度 | P1 |
| aiReasoning | String? | AI推理过程 | P2 |
| reviewHistory | Json? | 审核历史 | P2 |

**说明**：
- 审计报告第7.7节建议了 AI 相关字段，但数据库模型中尚未添加
- `rejectionReason` 字段在审计报告第6.2节已提及，但未实现

---

### 2.5 API审计日志不完整

**位置**：
- [`POST /[id]`](src/app/api/v1/law-article-relations/[id]/route.ts:14) (验证关系)
- [`DELETE /[id]`](src/app/api/v1/law-article-relations/[id]/route.ts:57) (删除关系)

**问题**：这两个端点都没有记录操作日志

**对比**：
- [`POST /[id]/verify`](src/app/api/v1/law-article-relations/[id]/verify/route.ts:128) 有完整的日志记录（第128-155行）
- [`POST /batch-verify`](src/app/api/v1/law-article-relations/batch-verify/route.ts:200) 有完整的日志记录（第200-226行）

**影响**：无法追踪哪些用户验证或删除了关系

---

### 2.6 前端控制台日志

**位置**：[`src/components/law-article/LawArticleGraphVisualization.tsx`](src/components/law-article/LawArticleGraphVisualization.tsx:66)

```typescript
} catch (error) {
  console.error('加载图谱失败:', error);
  setGraphData({ nodes: [], links: [] });
}
```

**问题**：审计报告中遗漏了前端组件的 console.error 使用

---

### 2.7 关系创建API权限验证不一致

**位置**：[`LawArticleRelationService.createRelation`](src/lib/law-article/relation-service.ts:82)

**问题**：
- `createRelation` 方法没有权限检查
- 无法确定是否有公开的关系创建API入口
- 如果有，缺少权限控制

**建议**：需要排查是否存在手动创建关系的入口

---

## 三、测试覆盖评估

### 3.1 现有测试文件

| 模块 | 测试文件 | 状态 |
|------|---------|------|
| 安全测试 | `lib/knowledge-graph-security.test.ts` | ✅ 完整 |
| 性能测试 | `lib/knowledge-graph-performance.test.ts` | ✅ 存在 |
| E2E测试 | `lib/knowledge-graph-e2e.test.ts` | ✅ 存在 |
| 通知服务 | `lib/knowledge-graph/notification-service.test.ts` | ✅ 完整 |

### 3.2 缺失测试

| 测试项 | 优先级 | 说明 |
|--------|--------|------|
| API权限验证测试 | P0 | 验证 DELETE 端点权限 |
| 审核日志测试 | P1 | 验证操作日志记录 |
| 数据质量指标测试 | P1 | 验证监控功能 |
| 前端可视化测试 | P2 | 验证组件渲染 |

---

## 四、修复建议汇总

### 4.1 立即修复（P0）

| # | 问题 | 修复方案 | 预估工时 |
|---|------|---------|---------|
| 1 | DELETE端点权限验证 | 添加 checkKnowledgeGraphPermission | 1小时 |
| 2 | POST /[id] 端点权限验证 | 添加 checkKnowledgeGraphPermission | 1小时 |
| 3 | DELETE操作日志记录 | 添加 logKnowledgeGraphAction | 0.5小时 |
| 4 | 验证操作日志记录 | 添加 logKnowledgeGraphAction | 0.5小时 |

### 4.2 短期修复（P1）

| # | 问题 | 修复方案 | 预估工时 |
|---|------|---------|---------|
| 1 | 控制台日志替换 | 全部替换为 logger | 1小时 |
| 2 | rejectionReason字段 | 添加数据库字段 | 1小时 |
| 3 | AI字段补充 | 添加aiProvider/aiConfidence等 | 2小时 |
| 4 | 前端可视化数据流 | 重构组件数据传递 | 2小时 |

### 4.3 中期改进（P2）

| # | 问题 | 修复方案 | 预估工时 |
|---|------|---------|---------|
| 1 | 审核日志映射完善 | 补充 ActionLogType 枚举 | 1小时 |
| 2 | 索引优化 | 添加 createdAt/verifiedAt 索引 | 1小时 |
| 3 | 关系发现API | 实现触发和状态查询API | 4小时 |
| 4 | 导出功能API | 实现数据导出API | 2小时 |

---

## 五、总结

### 5.1 审计报告确认情况

| 类别 | 问题 | 确认状态 |
|------|------|---------|
| 控制台日志滥用 | 多处使用console.* | ✅ 已确认（新增2处遗漏） |
| 权限验证缺失 | DELETE/POST端点无权限 | ✅ 已确认 |
| 审核日志映射 | 大部分映射到UNKNOWN | ✅ 已确认 |
| 数据库索引 | 缺少时间相关索引 | ✅ 已确认 |
| API端点 | 关系发现/导出缺失 | ✅ 已确认 |
| 图算法 | 最短路径等缺失 | ✅ 已确认 |
| 数据监控 | 质量指标缺失 | ✅ 已确认 |
| 缓存策略 | 缓存模型缺失 | ✅ 已确认 |

### 5.2 新增发现

| 类别 | 问题 | 优先级 |
|------|------|--------|
| 数据库模型 | 缺少rejectionReason等字段 | P1 |
| 前端组件 | 可视化数据流问题 | P1 |
| API日志 | 验证/删除操作无日志 | P1 |
| 前端日志 | console.error遗漏 | P2 |

---

> 本报告为补充审查，请结合 `knowledge-graph-audit-report.md` 一起使用。
