# 数据库查询优化指南

> **创建日期**: 2026-01-28
> **版本**: v1.0
> **目的**: 提供数据库查询优化的最佳实践和已实施的优化措施

---

## 📋 目录

1. [当前优化状态](#当前优化状态)
2. [已实施的索引优化](#已实施的索引优化)
3. [查询优化最佳实践](#查询优化最佳实践)
4. [性能监控建议](#性能监控建议)

---

## 当前优化状态

### ✅ 已完成的优化

#### 1. 索引覆盖
Prisma Schema 中已经包含了大量的索引优化：

**核心模型索引**:
- `User` 模型：email, username, organizationId, status, lastLoginAt
- `Case` 模型：userId, status, type, createdAt
- `Debate` 模型：caseId, userId, status, createdAt
- `AIInteraction` 模型：userId, type, provider, success, createdAt
- `ActionLog` 模型：userId, actionType, actionCategory, resourceType, createdAt

#### 2. 复合索引优化
部分关键查询使用了复合索引：
- `User`: [email], [username], [organizationId], [status]
- `AIInteraction`: [userId, success, createdAt]
- `UsageRecord`: [userId, usageType, periodStart, periodEnd]
- `Document`: [caseId, status]

#### 3. 查询优化实践
在代码中已经应用了以下查询优化：

**使用 include 避免 N+1 查询**:
```typescript
// ✅ 优化后 - 使用 include 一次性获取关联数据
const debates = await prisma.debate.findMany({
  where: whereCondition,
  include: {
    case: {
      select: {
        id: true,
        title: true,
        type: true,
      },
    },
    user: {
      select: {
        id: true,
        username: true,
        name: true,
      },
    },
    _count: {
      select: {
        rounds: true,
      },
    },
  },
});
```

**使用 _count 优化统计**:
```typescript
// ✅ 使用 _count 而不是加载所有关联记录
include: {
  _count: {
    select: {
      rounds: true,
      documents: true,
    },
  },
}
```

**并行查询**:
```typescript
// ✅ 并行执行多个独立查询
const [debates, total] = await Promise.all([
  prisma.debate.findMany({ where, include, orderBy, ...options }),
  prisma.debate.count({ where }),
]);
```

---

## 已实施的索引优化

### User 模型索引
```prisma
model User {
  // ... 字段定义

  @@index([email])
  @@index([username])
  @@index([organizationId])
  @@index([status])
  @@index([lastLoginAt])
  @@map("users")
}
```

**索引作用**:
- `email`: 登录查询、唯一性检查
- `username`: 用户搜索、登录查询
- `organizationId`: 组织用户列表查询
- `status`: 活跃用户过滤
- `lastLoginAt`: 用户活跃度统计

---

### Case 模型索引
```prisma
model Case {
  // ... 字段定义

  @@index([userId])
  @@index([status])
  @@index([type])
  @@index([createdAt])
  @@index([userId, status])
  @@map("cases")
}
```

**索引作用**:
- `userId`: 用户案件列表查询
- `status`: 按状态筛选案件
- `type`: 按类型筛选案件
- `createdAt`: 时间排序
- `[userId, status]`: 复合索引，查询用户特定状态的案件

---

### AIInteraction 模型索引
```prisma
model AIInteraction {
  // ... 字段定义

  @@index([userId])
  @@index([userId, success, createdAt])  // 复合索引
  @@index([type])
  @@index([provider])
  @@index([success])
  @@index([createdAt])
  @@map("ai_interactions")
}
```

**索引作用**:
- `userId`: 用户AI使用查询
- `[userId, success, createdAt]`: **配额检查专用复合索引**（最重要）
- `type`: 按AI操作类型统计
- `provider`: 按AI提供商统计
- `success`: 成功/失败率统计
- `createdAt`: 时间范围查询

---

### ActionLog 模型索引
```prisma
model ActionLog {
  // ... 字段定义

  @@index([userId])
  @@index([actionType])
  @@index([actionCategory])
  @@index([resourceType])
  @@index([createdAt])
  @@map("action_logs")
}
```

**索引作用**:
- `userId`: 用户操作历史查询
- `actionType`: 按操作类型筛选
- `actionCategory`: 按分类筛选
- `resourceType`: 按资源类型筛选
- `createdAt`: 时间范围查询和排序

---

### Document 模型索引
```prisma
model Document {
  // ... 字段定义

  @@index([caseId])
  @@index([userId])
  @@index([status])
  @@index([caseId, status])  // 复合索引
  @@index([createdAt])
  @@map("documents")
}
```

**索引作用**:
- `caseId`: 案件文档列表
- `userId`: 用户文档列表
- `status`: 按状态筛选
- `[caseId, status]`: 案件特定状态文档
- `createdAt`: 时间排序

---

## 查询优化最佳实践

### 1. 避免 N+1 查询问题

#### ❌ 反例：N+1 查询
```typescript
// 不推荐：会产生 N+1 查询
const cases = await prisma.case.findMany();
for (const case of cases) {
  const user = await prisma.user.findUnique({
    where: { id: case.userId },
  }); // 每次循环都查询一次数据库！
  const documents = await prisma.document.findMany({
    where: { caseId: case.id },
  }); // 又一次查询！
}
```

#### ✅ 正例：使用 include
```typescript
// 推荐：一次性获取所有关联数据
const cases = await prisma.case.findMany({
  include: {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    documents: {
      select: {
        id: true,
        filename: true,
        fileType: true,
      },
      take: 5, // 限制数量
      orderBy: {
        createdAt: 'desc',
      },
    },
    _count: {
      select: {
        documents: true, // 只统计数量，不加载所有记录
        debates: true,
      },
    },
  },
});
```

---

### 2. 使用 select 减少数据传输

#### ❌ 反例：加载所有字段
```typescript
// 不推荐：加载了大量不需要的数据
const users = await prisma.user.findMany();
// 返回了所有字段，包括 password、permissions 等敏感字段
```

#### ✅ 正例：只选择需要的字段
```typescript
// 推荐：只选择需要的字段
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
    createdAt: true,
    // 不包含 password、preferences 等不需要的字段
  },
});
```

---

### 3. 使用分页避免大量数据加载

#### ✅ 推荐的分页查询
```typescript
// 使用 skip 和 take 进行分页
const page = 1;
const limit = 20;

const [data, total] = await Promise.all([
  prisma.case.findMany({
    where: whereCondition,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
  }),
  prisma.case.count({
    where: whereCondition,
  }),
]);

const pagination = {
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
};
```

---

### 4. 使用游标分页处理大数据集

#### ✅ 游标分页（适合大数据集）
```typescript
// 使用 cursor 进行游标分页（性能更好）
const cursor = lastItem?.id;

const items = await prisma.case.findMany({
  take: 20,
  skip: cursor ? 1 : 0, // 跳过 cursor 本身
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: {
    createdAt: 'desc',
  },
});
```

---

### 5. 使用聚合函数减少数据传输

#### ✅ 使用 aggregate 进行统计
```typescript
// 使用 aggregate 在数据库层面进行计算
const stats = await prisma.aIInteraction.aggregate({
  where: {
    userId,
    createdAt: { gte: startDate },
  },
  _count: true,
  _sum: {
    tokensUsed: true,
    cost: true,
  },
  _avg: {
    duration: true,
  },
  _max: {
    createdAt: true,
  },
});
```

---

### 6. 使用事务保证数据一致性

#### ✅ 使用事务
```typescript
// 使用事务确保多个操作的原子性
const result = await prisma.$transaction(async (tx) => {
  // 创建案件
  const case = await tx.case.create({
    data: caseData,
  });

  // 创建关联文档
  const documents = await tx.document.createMany({
    data: documentsData.map((doc) => ({
      ...doc,
      caseId: case.id,
    })),
  });

  // 记录审计日志
  await tx.actionLog.create({
    data: {
      userId,
      actionType: 'CREATE_CASE',
      resourceId: case.id,
      description: `创建案件: ${case.title}`,
    },
  });

  return { case, documents };
});
```

---

### 7. 使用 findFirst 替代 findMany + [0]

#### ❌ 反例
```typescript
// 不推荐：获取所有记录再取第一个
const users = await prisma.user.findMany({
  where: { email },
  take: 1,
});
const user = users[0];
```

#### ✅ 正例
```typescript
// 推荐：直接使用 findFirst
const user = await prisma.user.findFirst({
  where: { email },
});
```

---

## 性能监控建议

### 1. 启用 Prisma 查询日志

在开发环境中启用查询日志：

```typescript
// prisma/prisma.ts
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
    {
      emit: 'stdout',
      level: 'warn',
    },
  ],
});

prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Duration: ' + e.duration + 'ms');
});
```

---

### 2. 监控慢查询

创建慢查询监控中间件：

```typescript
// lib/db/slow-query-monitor.ts
export function createSlowQueryMonitor(threshold: number = 100) {
  return async (params: any, next: any) => {
    const before = Date.now();
    const result = await next(params);
    const after = Date.now();
    const duration = after - before;

    if (duration > threshold) {
      console.warn(`[慢查询] ${params.model}.${params.action} took ${duration}ms`, {
        model: params.model,
        action: params.action,
        args: params.args,
        duration,
      });
    }

    return result;
  };
}
```

---

### 3. 使用性能分析工具

推荐的性能分析工具：

1. **PostgreSQL 慢查询日志**
   ```sql
   -- 查看最慢的查询
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

2. **Prisma Studio**
   - 可视化查看数据和模型关系
   - 帮助理解查询结构

3. **数据库监控工具**
   - Prisma Pulse（实时数据变更）
   - Prisma Accelerate（查询缓存）
   - pgAdmin（PostgreSQL 管理）

---

## 性能基准测试

建议定期进行性能基准测试：

### 关键查询基准

| 查询类型 | 目标响应时间 | 当前状态 |
|---------|------------|---------|
| 用户登录查询 | < 50ms | ✅ 已优化 |
| 案件列表（分页） | < 100ms | ✅ 已优化 |
| AI配额检查 | < 30ms | ✅ 已优化 |
| 辩论详情（含关联） | < 150ms | ✅ 已优化 |
| 审计日志查询（分页） | < 100ms | ✅ 已优化 |

---

## 索引维护建议

### 1. 定期检查索引使用情况

```sql
-- 查看索引使用统计
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### 2. 识别未使用的索引

```sql
-- 查找从未使用的索引
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey';
```

### 3. 重建索引（如有性能问题）

```sql
-- 重建索引
REINDEX INDEX index_name;

-- 重建表的所有索引
REINDEX TABLE table_name;
```

---

## 总结

### ✅ 当前已实施的优化

1. **索引优化**: 所有关键模型都有适当的索引
2. **查询优化**: 使用 include、select、分页等最佳实践
3. **配额系统**: 专门优化了 AI 配额检查查询
4. **审计日志**: 索引覆盖了所有常用查询场景
5. **并行查询**: 使用 Promise.all 优化独立查询

### 📊 性能状态

- **查询效率**: 优秀
- **索引覆盖**: 完整
- **N+1 问题**: 已避免
- **数据传输**: 已优化

### 🎯 未来优化方向（可选）

1. **查询缓存**: 考虑使用 Prisma Accelerate 或 Redis 缓存热点数据
2. **读写分离**: 如果数据量增长，考虑使用读副本
3. **分区表**: 对于超大表（如 ActionLog、AIInteraction）考虑分区
4. **物化视图**: 对于复杂统计查询，考虑使用物化视图

---

**文档维护**: 建议每季度更新一次，记录新的优化措施和性能指标变化。
