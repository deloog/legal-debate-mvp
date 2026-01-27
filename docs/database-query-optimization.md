# 数据库查询优化分析报告

> 创建日期: 2026-01-27
> 优化目标: 提升查询性能，减少N+1问题

---

## 📊 当前查询状态分析

### 1. Cases API 查询分析

**端点**: `src/app/api/v1/cases/route.ts`

**查询方式**:
```typescript
await prisma.case.findMany({
  where,
  orderBy,
  skip,
  take: limit,
  include: {
    documents: {
      where: { deletedAt: null },
      select: { id: true, analysisStatus: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    },
    debates: {
      select: { id: true, status: true },
      take: 1,
      orderBy: { createdAt: 'desc' },
    },
    user: {
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
      },
    },
  },
});
```

**优化状态**: ✅ 已优化
- 使用`include`预加载关联数据，避免N+1查询
- 限制返回字段和数量（select, take）
- 索引配置完善

**相关索引**:
```prisma
model Case {
  @@index([userId])
  @@index([status])
  @@index([type])
  @@index([createdAt])
  @@index([userId, status, createdAt])
  @@index([userId, type, createdAt])
  @@index([status, createdAt])
  @@index([deletedAt])
}
```

---

### 2. AIInteraction 配额查询分析

**端点**: `src/lib/ai/quota.ts`

**查询方式**:
```typescript
// 查询今日使用量
await prisma.aIInteraction.aggregate({
  where: {
    request: {
      path: ['userId'],
      equals: userId,
    },
    createdAt: { gte: today },
    success: true,
  },
  _sum: { tokensUsed: true },
  _count: true,
});

// 查询本月使用量
await prisma.aIInteraction.count({
  where: {
    request: {
      path: ['userId'],
      equals: userId,
    },
    createdAt: { gte: monthStart },
    success: true,
  },
});
```

**优化状态**: ⚠️ 性能瓶颈
- **问题**: userId存储在JSON字段中，无法使用传统索引
- **影响**: 每次配额检查都需要全表扫描JSON字段
- **查询复杂度**: O(n) 全表扫描

**当前索引**:
```prisma
model AIInteraction {
  @@index([type])
  @@index([provider])
  @@index([success])
  @@index([createdAt])
}
```

**建议优化方案**:

#### 方案1: 添加独立userId字段（推荐）
```prisma
model AIInteraction {
  id         String   @id @default(cuid())
  type       String
  provider   String
  model      String?
  userId     String?  // 新增独立字段
  request    Json
  response   Json?
  tokensUsed Int?
  duration   Int?
  cost       Float?
  success    Boolean
  error      String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([userId, success, createdAt])
  @@index([createdAt])
  @@map("ai_interactions")
}
```

**优势**:
- 支持传统索引，查询性能提升至O(log n)
- 复合索引`(userId, success, createdAt)`完美匹配配额查询
- 保持JSON字段的灵活性

**实施步骤**:
1. 修改Prisma schema添加`userId`字段
2. 创建数据库迁移: `npx prisma migrate dev --name add_user_id_to_ai_interaction`
3. 更新配额查询代码使用新字段
4. 数据迁移：将JSON中的userId迁移到独立字段

#### 方案2: 使用PostgreSQL JSONB GIN索引
```sql
CREATE INDEX idx_ai_interactions_request_gin 
ON ai_interactions 
USING GIN (request);
```

**优势**:
- 无需修改schema
- 支持JSON字段查询

**劣势**:
- GIN索引存储空间大
- 查询性能不如B-Tree索引
- 复杂条件（如createdAt）仍需全表扫描

#### 方案3: 使用Generated Column
```prisma
model AIInteraction {
  id         String   @id @default(cuid())
  type       String
  provider   String
  model      String?
  request    Json
  userId     String @default("null") @db.Generated("((request->>'userId')::text)") // 生成列
  response   Json?
  tokensUsed Int?
  duration   Int?
  cost       Float?
  success    Boolean
  error      String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([userId, success, createdAt])
  @@index([createdAt])
}
```

**优势**:
- 自动从JSON提取userId
- 支持索引

**劣势**:
- PostgreSQL 12+才支持
- 写入性能略有影响

---

## 🎯 优化建议优先级

### P0 - 立即实施

#### 1. AIInteraction添加userId独立字段

**预计性能提升**: 90%以上
**实施时间**: 1-2小时
**风险**: 低（有回滚方案）

**迁移脚本示例**:
```sql
-- 1. 添加新字段
ALTER TABLE ai_interactions ADD COLUMN user_id TEXT;

-- 2. 创建索引
CREATE INDEX idx_ai_interactions_user_id ON ai_interactions(user_id);
CREATE INDEX idx_ai_interactions_user_id_success_created_at 
ON ai_interactions(user_id, success, created_at);

-- 3. 迁移数据
UPDATE ai_interactions 
SET user_id = (request->>'userId') 
WHERE request ? 'userId';

-- 4. 添加非空约束（可选）
ALTER TABLE ai_interactions ALTER COLUMN user_id SET NOT NULL;
```

**代码更新**:
```typescript
// 修改 src/lib/ai/quota.ts
await prisma.aIInteraction.aggregate({
  where: {
    userId: userId,  // 使用独立字段
    createdAt: { gte: today },
    success: true,
  },
  _sum: { tokensUsed: true },
  _count: true,
});
```

---

### P1 - 短期实施

#### 2. 添加文档索引

**分析**: `Document`表的复合索引可以进一步优化

```prisma
model Document {
  @@index([caseId, analysisStatus, createdAt])
  @@index([userId, analysisStatus, createdAt])
  // 建议添加：
  @@index([caseId, deletedAt])
  @@index([userId, deletedAt])
}
```

**预计性能提升**: 按案件或用户查询文档时提升30-50%

---

#### 3. Debate表索引优化

```prisma
model Debate {
  @@index([caseId, status, createdAt])
  // 建议添加：
  @@index([userId, deletedAt])
  @@index([caseId, deletedAt])
}
```

---

### P2 - 长期优化

#### 4. 考虑使用数据库视图

为复杂查询创建物化视图，如"用户今日AI使用统计"：

```sql
CREATE MATERIALIZED VIEW user_daily_ai_usage AS
SELECT 
  (request->>'userId') as user_id,
  DATE(created_at) as usage_date,
  COUNT(*) as interaction_count,
  SUM(tokens_used) as total_tokens
FROM ai_interactions
WHERE success = true
GROUP BY (request->>'userId'), DATE(created_at);

CREATE INDEX idx_user_daily_ai_usage_user_id 
ON user_daily_ai_usage(user_id, usage_date);

-- 定期刷新（每小时）
CREATE REFRESH MATERIALIZED VIEW CONCURRENTLY user_daily_ai_usage;
```

**优势**:
- 配额查询直接读取物化视图，性能极佳
- 减少实时聚合计算

**劣势**:
- 数据延迟（需要定期刷新）
- 需要维护刷新逻辑

---

#### 5. 数据库分区

对于大型表（如`ai_interactions`）考虑按时间分区：

```sql
CREATE TABLE ai_interactions (
  id TEXT PRIMARY KEY,
  type TEXT,
  -- ... 其他字段
  created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- 按月分区
CREATE TABLE ai_interactions_2025_01 PARTITION OF ai_interactions
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE ai_interactions_2025_02 PARTITION OF ai_interactions
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

**适用场景**:
- AIInteraction表数据量>100万条
- 主要查询基于时间范围

---

## 📈 性能测试基准

### 测试方法

使用`EXPLAIN ANALYZE`分析查询执行计划：

```sql
-- 配额查询（当前版本）
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM ai_interactions
WHERE (request->>'userId') = 'user-123'
  AND created_at >= CURRENT_DATE
  AND success = true;

-- 优化后
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM ai_interactions
WHERE user_id = 'user-123'
  AND created_at >= CURRENT_DATE
  AND success = true;
```

### 预期结果

| 场景 | 当前耗时 | 优化后耗时 | 提升 |
|------|---------|-----------|------|
| 用户今日配额查询（100万条数据） | ~500ms | ~5ms | 99% |
| 用户本月配额查询（1000万条数据） | ~5000ms | ~50ms | 99% |
| Cases列表查询（分页20条） | ~50ms | ~30ms | 40% |

---

## 🔄 实施计划

### 第一阶段（立即实施）
- [ ] 修改Prisma schema添加AIInteraction.userId字段
- [ ] 创建数据库迁移
- [ ] 更新配额查询代码
- [ ] 执行性能测试验证
- [ ] 部署到生产环境

### 第二阶段（1-2周后）
- [ ] 添加Document和Debate表的索引
- [ ] 创建数据库视图（如需要）
- [ ] 监控查询性能

### 第三阶段（按需）
- [ ] 考虑数据库分区（数据量增长后）
- [ ] 引入查询缓存（如Redis）

---

## ⚠️ 注意事项

### 回滚计划
```bash
# 如果优化导致问题，回滚迁移
npx prisma migrate resolve --rolled-back [migration_name]

# 恢复旧代码版本
git revert [commit_hash]
```

### 监控指标
- 配额查询平均响应时间
- 数据库CPU使用率
- 慢查询日志（PostgreSQL pg_stat_statements）

### 兼容性
- 确保所有现有API端点正常工作
- 测试配额限制功能
- 验证数据一致性

---

## 📝 结论

当前系统的主要性能瓶颈在于**AIInteraction表的配额查询**，由于userId存储在JSON字段中导致无法使用索引。通过添加独立的userId字段并创建复合索引，可以将查询性能提升99%以上。

其他查询（如Cases API）已经进行了良好的优化，使用了`include`避免N+1问题，索引配置完善。

**建议优先实施P0级别的优化**，预计实施时间1-2小时，风险低，收益显著。

---

**文档维护**: 随着优化实施进度更新，记录实际性能提升数据。
