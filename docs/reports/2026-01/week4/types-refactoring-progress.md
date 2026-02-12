# 类型重构渐进式修复进度报告

## 概述

本报告记录了类型一致性问题的渐进式修复进展。

## 已完成的修复

### 1. 集中式类型文件

- ✅ `src/types/api-response.ts`
- ✅ `src/types/admin-user.ts`
- ✅ `src/types/admin-role.ts`
- ✅ `src/types/admin-membership.ts`
- ✅ `src/types/admin-order.ts`
- ✅ `src/types/admin-enterprise.ts`
- ✅ `src/types/case-type-config.ts`
- ✅ `src/types/membership.ts` - 添加了枚举类型和常量
- ✅ `src/types/team.ts` - 添加了枚举类型和运行时常量
- ✅ `src/types/notification.ts` - 添加了枚举类型、接口和运行时常量
- ✅ `src/types/contract.ts` - 添加了枚举类型和运行时常量
- ✅ `src/types/index.ts` - 集中式导出索引

### 2. 运行时类型常量

```typescript
// src/types/team.ts
export const TeamTypeValues = {
  PROJECT: 'PROJECT',
  DEPARTMENT: 'DEPARTMENT',
  COMMITTEE: 'COMMITTEE',
  TASK_FORCE: 'TASK_FORCE',
  LAW_FIRM: 'LAW_FIRM',
  LEGAL_TEAM: 'LEGAL_TEAM',
  LEGAL_DEPT: 'LEGAL_DEPT',
  OTHER: 'OTHER',
} as const;

export const TeamRoleValues = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
  LAWYER: 'LAWYER',
  PARALEGAL: 'PARALEGAL',
  LEAD_COUNSEL: 'LEAD_COUNSEL',
} as const;

// src/types/membership.ts
export const MembershipStatusValues = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  PAUSED: 'PAUSED',
} as const;

export const MembershipTierValues = {
  FREE: 'FREE',
  BASIC: 'BASIC',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
} as const;

// src/types/notification.ts
export const NotificationChannelValues = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  WEBHOOK: 'WEBHOOK',
} as const;

export const ReminderTypeValues = {
  CASE_DEADLINE: 'CASE_DEADLINE',
  TASK_DUE: 'TASK_DUE',
  HEARING_DATE: 'HEARING_DATE',
  PAYMENT_DUE: 'PAYMENT_DUE',
  FOLLOW_UP: 'FOLLOW_UP',
  CUSTOM: 'CUSTOM',
} as const;

// src/types/contract.ts
export const ContractStatusValues = {
  DRAFT: 'DRAFT',
  PENDING_SIGNATURE: 'PENDING_SIGNATURE',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  TERMINATED: 'TERMINATED',
  CANCELLED: 'CANCELLED',
} as const;

export const FeeTypeValues = {
  FIXED: 'FIXED',
  HOURLY: 'HOURLY',
  CONTINGENCY: 'CONTINGENCY',
  RETAINER: 'RETAINER',
  MIXED: 'MIXED',
} as const;
```

### 3. 测试文件修复

- ✅ `src/__tests__/api/teams/teams-id.test.ts` - 已修复
- ✅ `src/__tests__/api/teams/teams-list.test.ts` - 已修复
- ✅ `src/__tests__/api/teams/teams-members.test.ts` - 已修复

**修复示例**：

```typescript
// ❌ 错误
import { TeamType } from '@/types/team';
const type = TeamType.PROJECT;

// ✅ 正确
import { TeamTypeValues } from '@/types/team';
const type = TeamTypeValues.PROJECT;
```

### 4. API 路由修复

- ✅ 所有 Admin 模块路由文件
- ✅ Contracts 路由文件
- ✅ Memberships 路由文件

## 剩余问题

### 高优先级：组件测试文件修复

以下测试文件需要将类型导入改为使用常量值：

| 文件                                                             | 错误数 | 状态   |
| ---------------------------------------------------------------- | ------ | ------ |
| `src/__tests__/components/membership/MembershipInfo.test.tsx`    | 20+    | 待修复 |
| `src/__tests__/components/membership/TierUpgradeCard.test.tsx`   | 20+    | 待修复 |
| `src/__tests__/components/membership/UpgradeComparison.test.tsx` | 10+    | 待修复 |

### 中优先级：Lib 文件类型引用

以下 lib 文件需要修复类型引用：

| 文件                                         | 错误数 | 缺失常量                          |
| -------------------------------------------- | ------ | --------------------------------- |
| `src/lib/notification/reminder-generator.ts` | 10+    | NotificationChannel, ReminderType |
| `src/lib/notification/reminder-sender.ts`    | 5+     | NotificationChannel               |
| `src/lib/notification/reminder-service.ts`   | 10+    | ReminderStatus                    |
| `src/lib/notification/sms-service.ts`        | 15+    | SMSProvider                       |
| `src/lib/task/task-reminder.ts`              | 5+     | NotificationChannel, ReminderType |
| `src/lib/validations/contract.ts`            | 5+     | FeeType, ContractStatus           |

### 低优先级：架构问题

以下问题需要更大规模重构：

1. **Prisma 枚举不一致**
   - `@prisma/client` 生成的枚举与自定义类型不匹配
   - 示例：`UsageType` 期望 `"CASE"`，但代码使用 `"CASE_CREATED"`

2. **LimitType 运行时需求**
   - Prisma tier 文件需要 `LimitType` 作为运行时值
   - 解决方案：在 `src/types/membership.ts` 中创建 `LimitTypeValues`

## 修复步骤

### 步骤 1：修复组件测试文件（预计 1-2 小时）

```bash
# 需要修复的文件
src/__tests__/components/membership/MembershipInfo.test.tsx
src/__tests__/components/membership/TierUpgradeCard.test.tsx
src/__tests__/components/membership/UpgradeComparison.test.tsx
```

### 步骤 2：修复 Lib 文件（预计 2-3 小时）

```bash
# 需要修复的文件
src/lib/notification/reminder-generator.ts
src/lib/notification/reminder-sender.ts
src/lib/notification/reminder-service.ts
src/lib/notification/sms-service.ts
src/lib/task/task-reminder.ts
src/lib/validations/contract.ts
```

### 步骤 3：创建 LimitTypeValues（预计 15 分钟）

```typescript
// src/types/membership.ts
export const LimitTypeValues = {
  MAX_CASES: 'MAX_CASES',
  MAX_DEBATES: 'MAX_DEBATES',
  MAX_DOCUMENTS: 'MAX_DOCUMENTS',
  MAX_EVIDENCE: 'MAX_EVIDENCE',
  MAX_STORAGE: 'MAX_STORAGE',
  MAX_USERS: 'MAX_USERS',
} as const;
```

## 风险评估

| 风险           | 级别 | 缓解措施         |
| -------------- | ---- | ---------------- |
| 测试文件遗漏   | 中   | 逐个验证所有测试 |
| 运行时行为变化 | 低   | 只修改导入语句   |
| 验证逻辑失效   | 低   | 保持值不变       |

## 建议

1. **短期**：继续修复组件测试文件导入
2. **中期**：修复所有 lib 文件中的类型引用
3. **长期**：制定类型规范，统一枚举来源

## 结论

渐进式修复已取得重要进展：

- ✅ 已完成：团队测试文件全部修复
- ✅ 已完成：添加所有核心类型运行时常量
- ⏳ 剩余：组件测试文件（Membership）
- ⏳ 剩余：Lib 文件类型引用

预计总时间投入：

- 已完成：3-4 小时
- 剩余：4-6 小时
