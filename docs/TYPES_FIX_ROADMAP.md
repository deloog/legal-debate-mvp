# 类型修复路线图（一次性全面修复）

> 创建日期: 2024年 | 状态: 待执行

## 执行摘要

- **当前问题**: 238 个 TypeScript 类型错误
- **修复目标**: 0 个类型错误
- **预计工作量**: 6-8 小时
- **风险等级**: 中（需要系统化执行）

---

## 第一部分：错误分类统计

### 1.1 按错误类型分类

| 错误类型                    | 数量 | 占比 | 严重程度 |
| --------------------------- | ---- | ---- | -------- |
| 类型被用作值 (TS2693)       | ~80  | 34%  | 高       |
| 缺少类型导出 (TS2305)       | ~50  | 21%  | 高       |
| 对象字面量属性缺失 (TS2353) | ~40  | 17%  | 中       |
| 测试框架配置问题            | ~30  | 13%  | 中       |
| 其他 (TS2339, TS2322)       | ~38  | 15%  | 低       |

### 1.2 按模块分类

| 模块                | 文件数 | 错误数 | 优先级 |
| ------------------- | ------ | ------ | ------ |
| membership (会员)   | 12     | ~75    | P0     |
| notification (通知) | 8      | ~45    | P0     |
| team (团队)         | 5      | ~25    | P1     |
| task (任务)         | 4      | ~15    | P1     |
| evidence (证据)     | 3      | ~20    | P2     |
| 其他组件            | 15     | ~58    | P2     |

---

## 第二部分：需要修复的类型文件

### 2.1 会员模块 (src/types/membership.ts)

**当前状态**: 部分完成，需要补充缺失的类型

**缺失的导出**:

```typescript
// 需要添加
export type BillingCycle = 'MONTHLY' | 'YEARLY' | 'QUARTERLY';
export const BillingCycleValues = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  QUARTERLY: 'QUARTERLY',
} as const;

export interface TierLimitConfig {
  cases: number;
  debates: number;
  documents: number;
  storage: number;
  aiTokens: number;
  users: number;
  features: string[];
}

export interface UserMembership {
  id: string;
  userId: string;
  tier: MembershipTier;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  limits: TierLimitConfig;
  usage: Record<string, number>;
}

export interface MembershipTierDef {
  id: string;
  name: string;
  level: number;
  price: number;
  billingCycle: BillingCycle;
  features: string[];
  limits: TierLimitConfig;
}

export interface MembershipHistory {
  id: string;
  membershipId: string;
  changeType: MembershipChangeType;
  previousTier: MembershipTier | null;
  newTier: MembershipTier;
  previousStatus: MembershipStatus | null;
  newStatus: MembershipStatus;
  reason: string | null;
  createdAt: Date;
}

export interface UsageRecord {
  id: string;
  membershipId: string;
  usageType: UsageType;
  amount: number;
  resetAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
```

### 2.2 通知模块 (src/types/notification.ts)

**当前状态**: 已完成（包含所有运行时常量）

**验证**: 以下导出已存在

- ✅ NotificationType / NotificationTypeValues
- ✅ NotificationChannel / NotificationChannelValues
- ✅ ReminderType / ReminderTypeValues
- ✅ ReminderStatus / ReminderStatusValues
- ✅ ReminderPreferences（需要添加缺失字段）

**需要修复**: ReminderPreferences 接口缺少 `courtSchedule`、`deadline`、`followUp` 字段

### 2.3 任务模块 (src/types/task.ts)

**当前状态**: 需要添加状态和优先级常量

**需要添加**:

```typescript
export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OVERDUE';
export const TaskStatusValues = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  OVERDUE: 'OVERDUE',
} as const;

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export const TaskPriorityValues = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
```

### 2.4 团队模块 (src/types/team.ts)

**当前状态**: 已完成（包含所有运行时常量）

**验证**: 以下导出已存在

- ✅ TeamType / TeamTypeValues
- ✅ TeamStatus / TeamStatusValues
- ✅ TeamRole / TeamRoleValues
- ✅ MemberStatus / MemberStatusValues

### 2.5 证据模块 (src/types/evidence.ts) - 需要创建

**需要创建**: 如果文件不存在

```typescript
export type EvidenceStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ARCHIVED';
export const EvidenceStatusValues = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type EvidenceType =
  | 'DOCUMENT'
  | 'IMAGE'
  | 'AUDIO'
  | 'VIDEO'
  | 'WITNESS'
  | 'EXPERT'
  | 'OTHER';
export const EvidenceTypeValues = {
  DOCUMENT: 'DOCUMENT',
  IMAGE: 'IMAGE',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  WITNESS: 'WITNESS',
  EXPERT: 'EXPERT',
  OTHER: 'OTHER',
} as const;

export interface EvidenceDetail {
  id: string;
  caseId: string;
  title: string;
  description: string | null;
  type: EvidenceType;
  status: EvidenceStatus;
  content: string;
  fileUrl: string | null;
  metadata: Record<string, unknown>;
  submittedBy: string;
  submittedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidenceListResponse {
  evidence: EvidenceDetail[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

## 第三部分：需要修复的测试文件

### 3.1 会员组件测试 (src/**tests**/components/membership/)

| 文件                       | 错误数 | 主要问题                                                               |
| -------------------------- | ------ | ---------------------------------------------------------------------- |
| MembershipInfo.test.tsx    | 15     | 缺少 TierLimitConfig, UserMembership, MembershipTier, MembershipStatus |
| PriceBreakdown.test.tsx    | 2      | 缺少 BillingCycle                                                      |
| TierUpgradeCard.test.tsx   | 25     | 缺少 MembershipTierDef, BillingCycle, MembershipTier 用作值            |
| UpgradeComparison.test.tsx | 8      | 缺少 BillingCycle, MembershipTier 用作值                               |
| UsageHistory.test.tsx      | 35     | 缺少 MembershipHistory, 多处 MembershipTier/Status 用作值              |
| TierSelection.test.tsx     | 6      | 缺少 BillingCycle, MembershipTier 用作值                               |

**修复策略**: 添加缺失的类型导出，并在测试中使用 Values 常量

### 3.2 通知组件测试 (src/**tests**/components/reminder/)

| 文件                      | 错误数 | 主要问题                                                 |
| ------------------------- | ------ | -------------------------------------------------------- |
| ReminderList.test.tsx     | 12     | ReminderType/NotificationChannel/ReminderStatus 用作值   |
| ReminderSettings.test.tsx | 10     | ReminderPreferences 缺少字段, NotificationChannel 用作值 |

### 3.3 团队组件测试 (src/**tests**/components/)

| 文件               | 错误数 | 主要问题                                                              |
| ------------------ | ------ | --------------------------------------------------------------------- |
| team-form.test.tsx | 8      | TeamType/TeamStatus 用作值                                            |
| team-list.test.tsx | 8      | 缺少 TEAM_TYPE_LABELS, TEAM_STATUS_LABELS, TeamType/TeamStatus 用作值 |

### 3.4 任务组件测试 (src/**tests**/components/task/)

| 文件               | 错误数 | 主要问题                                           |
| ------------------ | ------ | -------------------------------------------------- |
| TaskForm.test.tsx  | 5      | 缺少 TaskStatus, TaskPriority                      |
| task-list.test.tsx | 6      | 缺少 TaskStatus, TaskPriority, assignedTo 属性问题 |

### 3.5 证据组件测试 (src/**tests**/components/evidence/)

| 文件                  | 错误数 | 主要问题                                             |
| --------------------- | ------ | ---------------------------------------------------- |
| EvidenceForm.test.tsx | 8      | 缺少 EvidenceStatus.ACCEPTED, EvidenceType.WITNESS   |
| EvidenceList.test.tsx | 12     | 缺少 EvidenceDetail.name, EvidenceStatus.ACCEPTED 等 |

### 3.6 反馈组件测试 (src/**tests**/components/feedback/)

| 文件                                  | 错误数 | 主要问题                                       |
| ------------------------------------- | ------ | ---------------------------------------------- |
| RecommendationFeedbackButton.test.tsx | 18     | testing-library 匹配器缺失 (toBeInTheDocument) |
| RelationFeedbackButton.test.tsx       | 18     | 同上                                           |

**修复策略**: 这些是测试框架配置问题，需要检查 jest.setup.ts 是否引入了 @testing-library/jest-dom

---

## 第四部分：需要修复的 Lib 文件

### 4.1 通知相关

| 文件                                               | 错误数 | 主要问题                                               |
| -------------------------------------------------- | ------ | ------------------------------------------------------ |
| lib/notification/in-app-message-service.test.ts    | 40     | ReminderType/NotificationChannel/ReminderStatus 用作值 |
| lib/notification/reminder-sender.test.ts           | 10     | 同上                                                   |
| lib/notification/reminder/reminder-service.test.ts | 35     | 同上 + ReminderPreferences 缺少字段                    |

### 4.2 任务相关

| 文件                      | 错误数 | 主要问题                                                   |
| ------------------------- | ------ | ---------------------------------------------------------- |
| lib/task/task-reminder.ts | 8      | 缺少 TaskPriority, NotificationChannel/ReminderType 用作值 |

### 4.3 使用量相关

| 文件                      | 错误数 | 主要问题                              |
| ------------------------- | ------ | ------------------------------------- |
| lib/usage/record-usage.ts | 12     | UsageType 不兼容, UsageStats 属性缺失 |

### 4.4 计算相关

| 文件                                               | 错误数 | 主要问题                   |
| -------------------------------------------------- | ------ | -------------------------- |
| lib/calculation/statute-reminder-generator.test.ts | 8      | NotificationChannel 用作值 |

### 4.5 Cron 相关

| 文件                                      | 错误数 | 主要问题                   |
| ----------------------------------------- | ------ | -------------------------- |
| lib/cron/send-follow-up-reminders.test.ts | 8      | NotificationChannel 用作值 |

---

## 第五部分：执行计划

### 阶段 1：基础类型修复（1-2 小时）

#### 步骤 1.1: 修复 membership.ts

- [ ] 添加 BillingCycle 类型和常量
- [ ] 添加 TierLimitConfig 接口
- [ ] 添加 UserMembership 接口
- [ ] 添加 MembershipTierDef 接口
- [ ] 添加 MembershipHistory 接口
- [ ] 添加 UsageRecord 接口

#### 步骤 1.2: 修复 task.ts

- [ ] 添加 TaskStatus 类型和常量
- [ ] 添加 TaskPriority 类型和常量

#### 步骤 1.3: 创建/修复 evidence.ts

- [ ] 检查文件是否存在
- [ ] 如果不存在，创建证据类型定义
- [ ] 如果存在，补充缺失的导出

#### 步骤 1.4: 修复 notification.ts

- [ ] 补充 ReminderPreferences 缺失字段（courtSchedule, deadline, followUp）

### 阶段 2：测试文件修复（2-3 小时）

#### 步骤 2.1: 修复会员组件测试

- [ ] MembershipInfo.test.tsx
- [ ] PriceBreakdown.test.tsx
- [ ] TierUpgradeCard.test.tsx
- [ ] UpgradeComparison.test.tsx
- [ ] UsageHistory.test.tsx
- [ ] TierSelection.test.tsx

#### 步骤 2.2: 修复通知组件测试

- [ ] ReminderList.test.tsx
- [ ] ReminderSettings.test.tsx

#### 步骤 2.3: 修复团队组件测试

- [ ] team-form.test.tsx
- [ ] team-list.test.tsx

#### 步骤 2.4: 修复任务组件测试

- [ ] TaskForm.test.tsx
- [ ] task-list.test.tsx

#### 步骤 2.5: 修复证据组件测试

- [ ] EvidenceForm.test.tsx
- [ ] EvidenceList.test.tsx

#### 步骤 2.6: 修复反馈组件测试

- [ ] 检查 jest.setup.ts 配置
- [ ] 添加 @testing-library/jest-dom 引入（如缺失）

### 阶段 3：Lib 文件修复（1-2 小时）

#### 步骤 3.1: 修复通知 Lib 文件

- [ ] lib/notification/in-app-message-service.test.ts
- [ ] lib/notification/reminder-sender.test.ts
- [ ] lib/notification/reminder/reminder-service.test.ts

#### 步骤 3.2: 修复任务 Lib 文件

- [ ] lib/task/task-reminder.ts

#### 步骤 3.3: 修复使用量 Lib 文件

- [ ] lib/usage/record-usage.ts

#### 步骤 3.4: 修复计算和 Cron 文件

- [ ] lib/calculation/statute-reminder-generator.test.ts
- [ ] lib/cron/send-follow-up-reminders.test.ts

### 阶段 4：验证和清理（30 分钟）

#### 步骤 4.1: 运行类型检查

- [ ] 执行 `npx tsc --noEmit`
- [ ] 确认错误数 < 10

#### 步骤 4.2: 运行测试

- [ ] 执行 `npm test`
- [ ] 确认测试通过率 > 90%

#### 步骤 4.3: 清理文档

- [ ] 更新 COMPREHENSIVE_TYPE_CONSISTENCY_FIX_SUMMARY.md
- [ ] 更新 TYPES_REFACTORING_PROGRESS.md

---

## 第六部分：风险评估

### 6.1 高风险项

| 风险                         | 影响           | 缓解措施                         |
| ---------------------------- | -------------- | -------------------------------- |
| 测试文件修改过多             | 可能引入回归   | 逐个文件验证，只改导入和常量引用 |
| ReminderPreferences 结构变更 | 可能影响运行时 | 只添加可选字段，不删除现有字段   |

### 6.2 中风险项

| 风险                   | 影响         | 缓解措施                   |
| ---------------------- | ------------ | -------------------------- |
| 新类型与 Prisma 不兼容 | 编译错误     | 使用与 Prisma 相同的枚举值 |
| 测试框架配置问题       | 测试无法运行 | 先检查配置，再决定是否修改 |

### 6.3 低风险项

| 风险         | 影响         | 缓解措施           |
| ------------ | ------------ | ------------------ |
| 遗漏某些错误 | 需要多轮修复 | 使用自动化工具检查 |

---

## 第七部分：成功标准

### 7.1 量化指标

| 指标              | 当前值 | 目标值 |
| ----------------- | ------ | ------ |
| TypeScript 错误数 | 238    | < 10   |
| 类型覆盖率        | 未知   | > 80%  |
| 测试通过率        | 未知   | > 90%  |

### 7.2 质量标准

- [ ] 所有类型都有对应的运行时常量
- [ ] 测试文件使用常量而非类型别名作为值
- [ ] 没有使用 `any` 类型
- [ ] 文档已更新

---

## 第八部分：相关文档

- `docs/COMPREHENSIVE_TYPE_CONSISTENCY_FIX_SUMMARY.md` - 原始问题分析
- `docs/TYPE_SPECIFICATION.md` - 类型规范（方案A）
- `prisma/schema.prisma` - Prisma 数据库模式（枚举参考）

---

## 附录 A：快速修复脚本

```bash
#!/bin/bash
# 类型修复快速检查脚本

echo "=== TypeScript 类型检查 ==="
npx tsc --noEmit 2>&1 | tee type-errors.txt

echo ""
echo "=== 错误统计 ==="
echo "总错误数: $(grep -c 'error TS' type-errors.txt)"
echo "按类型统计:"
grep 'error TS' type-errors.txt | sed 's/.*error TS[0-9]*:.*//' | sort | uniq -c | sort -rn
```

---

## 附录 B：需要修改的文件清单

### 类型文件（5 个）

- [ ] src/types/membership.ts
- [ ] src/types/task.ts
- [ ] src/types/notification.ts
- [ ] src/types/evidence.ts（可能需要创建）
- [ ] src/types/team.ts（验证）

### 测试文件（20+ 个）

- src/**tests**/components/membership/\*.tsx（6 个）
- src/**tests**/components/reminder/\*.tsx（2 个）
- src/**tests**/components/team\*.tsx（2 个）
- src/**tests**/components/task\*.tsx（3 个）
- src/**tests**/components/evidence/\*.tsx（2 个）
- src/**tests**/components/feedback/\*.tsx（2 个）
- src/**tests**/lib/notification/\*.ts（3 个）
- src/**tests**/lib/calculation/\*.ts（1 个）
- src/**tests**/lib/cron/\*.ts（1 个）

### Lib 文件（5 个）

- [ ] src/lib/task/task-reminder.ts
- [ ] src/lib/usage/record-usage.ts

### 配置文件（1 个）

- [ ] jest.setup.ts（如果 testing-library 匹配器缺失）

---

> **注意**: 此路线图将根据实际修复过程中的发现持续更新。
