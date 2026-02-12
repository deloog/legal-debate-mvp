# API 路径常量迁移指南

> **创建日期**: 2026-02-12
> **状态**: 已完成核心常量定义和示例迁移

---

## 📋 概述

为了解决项目中大量硬编码 API 路径字符串的问题，我们创建了统一的 API 路径常量管理系统。这可以：

- ✅ **提高可维护性**：统一管理所有 API 路径，避免路径拼写错误
- ✅ **类型安全**：TypeScript 类型检查，避免路径错误
- ✅ **易于重构**：修改 API 路径时只需改一处
- ✅ **代码提示**：IDE 自动补全，提高开发效率

---

## 📁 核心文件

### API 路径常量文件

**文件位置**: `src/lib/constants/api-paths.ts`

**主要内容**:
- 所有 API 路径的常量定义
- `buildUrl()` 辅助函数：构建带查询参数的 URL
- `isValidApiPath()` 验证函数：检查路径是否有效

---

## 🔧 使用方法

### 1. 导入常量

```typescript
import {
  CASE_API,
  DEBATE_API,
  ADMIN_API,
  buildUrl
} from '@/lib/constants/api-paths';
```

### 2. 使用常量

#### 简单路径（不带参数）

```typescript
// ❌ 旧写法
const response = await fetch('/api/v1/cases');

// ✅ 新写法
const response = await fetch(CASE_API.LIST);
```

#### 动态路径（需要 ID）

```typescript
// ❌ 旧写法
const response = await fetch(`/api/v1/debates/${debateId}`);

// ✅ 新写法
const response = await fetch(DEBATE_API.detail(debateId));
```

#### 带查询参数的路径

```typescript
// ❌ 旧写法
const params = new URLSearchParams({ page: '1', limit: '20' });
const response = await fetch(`/api/v1/cases?${params.toString()}`);

// ✅ 新写法 - 方法1（推荐）
const params = new URLSearchParams({ page: '1', limit: '20' });
const response = await fetch(
  buildUrl(CASE_API.LIST, Object.fromEntries(params.entries()))
);

// ✅ 新写法 - 方法2
const response = await fetch(
  buildUrl(CASE_API.LIST, { page: 1, limit: 20 })
);
```

---

## 📦 已定义的 API 常量

### 案件相关 (CASE_API)

```typescript
CASE_API.LIST                    // GET /api/v1/cases
CASE_API.CREATE                  // POST /api/v1/cases
CASE_API.detail(id)              // GET /api/v1/cases/:id
CASE_API.update(id)              // PUT /api/v1/cases/:id
CASE_API.delete(id)              // DELETE /api/v1/cases/:id
CASE_API.share(id)               // POST /api/cases/:id/share
CASE_API.teamMembers(id)         // GET /api/cases/:id/team-members
CASE_API.witnesses(id)           // GET /api/cases/:id/witnesses
```

### 咨询相关 (CONSULTATION_API)

```typescript
CONSULTATION_API.LIST            // GET /api/consultations
CONSULTATION_API.CREATE          // POST /api/consultations
CONSULTATION_API.detail(id)      // GET /api/consultations/:id
CONSULTATION_API.CALCULATE_FEE   // POST /api/consultations/calculate-fee
```

### 辩论相关 (DEBATE_API)

```typescript
DEBATE_API.LIST                  // GET /api/v1/debates
DEBATE_API.CREATE                // POST /api/v1/debates
DEBATE_API.detail(id)            // GET /api/v1/debates/:id
DEBATE_API.status(id)            // GET /api/v1/debates/:id/status
DEBATE_API.rounds(id)            // GET /api/v1/debates/:id/rounds
DEBATE_API.arguments(id)         // GET /api/v1/debates/:id/arguments
```

### 证据相关 (EVIDENCE_API)

```typescript
EVIDENCE_API.LIST                // GET /api/evidence
EVIDENCE_API.CREATE              // POST /api/evidence
EVIDENCE_API.UPLOAD              // POST /api/evidence/upload
EVIDENCE_API.BULK                // POST /api/evidence/bulk
EVIDENCE_API.detail(id)          // GET /api/evidence/:id
EVIDENCE_API.delete(id)          // DELETE /api/evidence/:id
```

### 订单相关 (ORDER_API)

```typescript
ORDER_API.LIST                   // GET /api/orders
ORDER_API.CREATE                 // POST /api/orders/create
ORDER_API.detail(id)             // GET /api/orders/:id
ORDER_API.cancel(id)             // POST /api/orders/:id/cancel
```

### 通知相关 (NOTIFICATION_API)

```typescript
NOTIFICATION_API.LIST            // GET /api/notifications
NOTIFICATION_API.MARK_READ       // POST /api/notifications/mark-read
NOTIFICATION_API.MARK_ALL_READ   // POST /api/notifications/mark-all-read
```

### 管理员 API (ADMIN_API)

```typescript
// 用户管理
ADMIN_API.USERS.LIST             // GET /api/admin/users
ADMIN_API.USERS.CREATE           // POST /api/admin/users
ADMIN_API.USERS.detail(id)       // GET /api/admin/users/:id
ADMIN_API.USERS.update(id)       // PUT /api/admin/users/:id
ADMIN_API.USERS.delete(id)       // DELETE /api/admin/users/:id

// 角色管理
ADMIN_API.ROLES.LIST             // GET /api/admin/roles
ADMIN_API.ROLES.detail(id)       // GET /api/admin/roles/:id

// 权限管理
ADMIN_API.PERMISSIONS.LIST       // GET /api/admin/permissions

// 订单管理
ADMIN_API.ORDERS.LIST            // GET /api/admin/orders
ADMIN_API.ORDERS.detail(id)      // GET /api/admin/orders/:id

// 会员管理
ADMIN_API.MEMBERSHIPS.LIST       // GET /api/admin/memberships
ADMIN_API.MEMBERSHIPS.EXPORT     // GET /api/admin/memberships/export
ADMIN_API.MEMBERSHIPS.detail(id) // GET /api/admin/memberships/:id

// 法律条文管理
ADMIN_API.LAW_ARTICLES.LIST      // GET /api/admin/law-articles
ADMIN_API.LAW_ARTICLES.IMPORT    // POST /api/admin/law-articles/import
ADMIN_API.LAW_ARTICLES.detail(id)// GET /api/admin/law-articles/:id
ADMIN_API.LAW_ARTICLES.review(id)// POST /api/admin/law-articles/:id/review
```

### 统计相关 (STATS_API)

```typescript
STATS_API.PERFORMANCE.RESPONSE_TIME     // GET /api/stats/performance/response-time
STATS_API.PERFORMANCE.ERROR_RATE        // GET /api/stats/performance/error-rate
STATS_API.DEBATES.GENERATION_COUNT      // GET /api/stats/debates/generation-count
STATS_API.DEBATES.QUALITY_SCORE         // GET /api/stats/debates/quality-score
STATS_API.CASES.TYPE_DISTRIBUTION       // GET /api/stats/cases/type-distribution
STATS_API.CASES.EFFICIENCY              // GET /api/stats/cases/efficiency
```

### 其他 API

详见 `src/lib/constants/api-paths.ts` 文件，包括：
- `WITNESS_API` - 见证人
- `TEAM_API` - 团队
- `COMMUNICATION_API` - 沟通记录
- `DISCUSSION_API` - 讨论
- `TIMELINE_API` - 时间线
- `INVOICE_API` - 发票
- `CALCULATION_API` - 计算
- `COURT_SCHEDULE_API` - 法庭日程
- `CONTRACT_API` - 合同
- `FEEDBACK_API` - 反馈
- `CLIENT_API` - 客户
- `REMINDER_API` - 提醒
- `USER_API` - 用户设置
- `AUTH_API` - 认证

---

## ✅ 已迁移的文件

以下文件已完成 API 路径常量迁移，可作为参考示例：

### Hooks
- ✅ `src/lib/hooks/use-cases.ts` - 案件列表 Hook
- ✅ `src/lib/hooks/use-consultations.ts` - 咨询列表 Hook
- ✅ `src/lib/hooks/use-debate.ts` - 辩论详情 Hook

### 组件
- ✅ `src/components/evidence/EvidenceList.tsx` - 证据列表组件
- ✅ `src/components/admin/UserList.tsx` - 用户管理列表组件

---

## 📊 迁移进度

### 统计数据

- **待迁移文件总数**: 约 108 个文件包含硬编码 API 路径
- **已完成迁移**: 5 个代表性文件（展示所有迁移模式）
- **常量定义完成度**: 100%（覆盖所有已知 API 端点）

### 迁移策略

由于项目中有大量文件使用硬编码路径，建议采用**渐进式迁移**策略：

1. **新功能开发**: 强制使用 API 路径常量
2. **Bug 修复**: 在修复相关文件时顺便迁移
3. **重构时机**: 在大规模重构时批量迁移相关模块

---

## 🚀 迁移步骤

### 对于普通开发者

1. **导入常量**
   ```typescript
   import { CASE_API, buildUrl } from '@/lib/constants/api-paths';
   ```

2. **替换硬编码路径**
   - 简单路径：直接使用常量
   - 动态路径：调用函数传入 ID
   - 带参数：使用 `buildUrl()` 辅助函数

3. **测试验证**
   - 运行相关测试确保功能正常
   - 检查网络请求路径是否正确

### 批量迁移脚本（可选）

如果需要批量迁移，可以使用以下正则表达式查找替换：

```regex
# 查找模式
fetch\s*\(\s*[`'"]/(api/[^`'"]+)[`'"]

# 需要手动判断并替换为对应的常量
```

---

## ⚠️ 注意事项

### 1. 不要混用

```typescript
// ❌ 错误：混用硬编码和常量
const response1 = await fetch('/api/v1/cases');
const response2 = await fetch(CASE_API.LIST);

// ✅ 正确：统一使用常量
const response1 = await fetch(CASE_API.LIST);
const response2 = await fetch(CASE_API.detail(caseId));
```

### 2. 参数类型

```typescript
// ❌ 错误：传入错误类型
buildUrl(CASE_API.LIST, { page: '1' })  // page 应该是 number

// ✅ 正确：使用正确类型
buildUrl(CASE_API.LIST, { page: 1 })
```

### 3. null/undefined 处理

```typescript
// ✅ buildUrl 会自动过滤 null/undefined
buildUrl(CASE_API.LIST, {
  page: 1,
  search: undefined,  // 会被自动过滤掉
  type: null,         // 会被自动过滤掉
});
// 结果: /api/v1/cases?page=1
```

---

## 🔍 查找待迁移的文件

可以使用以下命令查找项目中还未迁移的文件：

```bash
# 查找所有硬编码 fetch('/api/...) 的文件
grep -r "fetch\s*\(\s*['\`\"]/(api|auth)/" src --include="*.ts" --include="*.tsx"

# 查找特定模式
grep -rn 'fetch.*"/api/' src
```

---

## 📚 相关文档

- [API 路径常量定义](../src/lib/constants/api-paths.ts)
- [代码质量修复报告](../CODE_QUALITY_FIX_FINAL_REPORT.md)
- [环境变量配置指南](./ENVIRONMENT_VARIABLES.md)

---

## 🔄 版本历史

- **v1.0.0** (2026-02-12): 初始版本，完成所有 API 常量定义和示例迁移

---

**最后更新**: 2026-02-12
**维护者**: 开发团队
**反馈**: 如有问题，请提交 Issue 或 Pull Request
