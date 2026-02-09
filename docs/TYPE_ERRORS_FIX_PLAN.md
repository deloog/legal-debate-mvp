# 类型错误修复计划

## 错误统计
- 初始错误：**304** 个
- 当前剩余：**198** 个
  - 库文件：**20** 个
  - 测试文件：**178** 个

## 修复进度
- ✅ 已修复核心类型定义（106个错误）
- 🔄 正在修复库文件中的类型使用（剩余20个）
- ⏳ 待修复测试文件类型错误（178个）

## 修复状态说明
- ⏳ 待修复
- 🔄 修复中
- ✅ 已修复
- ❌ 跳过/无需修复

---

## 已完成的核心类型修复

### ✅ 1. Usage 类型（已完成）
- 更新 `UsageType` 枚举匹配 Prisma Schema
- 扩展 `UsageStats` 接口添加所有缺失属性

### ✅ 2. Membership 类型（已完成）
- 添加 `MembershipPermissionConfig` 导出
- 添加 `MembershipChangeType` 运行时常量
- 扩展 `UserMembership` 添加 `tierId`
- 扩展 `MembershipHistory` 添加 `userId`, `performedBy`
- 扩展 `MembershipTierDef` 添加 `currency` 等兼容字段

### ✅ 3. Reminder 类型（已完成）
- 添加 `DISMISSED` 到 `ReminderStatus`
- 扩展 `Reminder` 添加 `relatedType`, `relatedId`
- 扩展 `CreateReminderInput` 添加所有缺失属性
- 扩展 `ReminderQueryParams` 和 `ReminderListResponse`

### ✅ 4. Notification 类型（已完成）
- 添加 Email 相关类型
- 扩展 SMS 类型添加 `CONSOLE` 提供商
- 扩展 `ReminderPreferences` 添加兼容字段

### ✅ 5. JWT 类型（已完成）
- 扩展 `JwtVerifyResult` 添加便捷访问属性

### ✅ 6. Task 类型（已完成）
- 添加 `AssignTaskInput` 类型
- 导出所有验证函数和标签函数

### ✅ 7. 其他类型（已完成）
- 添加 `FeeType` 别名
- 扩展 `RedisInfo` 类型
- 修复 `DebateGenerationConfig` 默认值

---

## 错误分类与修复计划

### 1. Jest 测试类型错误 (约50个错误) ⏳
**文件范围**：
- `src/__tests__/components/feedback/RecommendationFeedbackButton.test.tsx`
- `src/__tests__/components/feedback/RelationFeedbackButton.test.tsx`

**问题**：
- Jest DOM matchers (`toBeInTheDocument`, `toBeDisabled`, `toHaveClass`) 类型不存在
- Mock 类型不匹配 (`Mock<UnknownFunction>` vs `fetch` 类型)

**修复方案**：
- 确保 `@testing-library/jest-dom` 正确导入
- 修复 fetch mock 的类型定义

---

### 2. Membership 类型错误 (约80个错误) 🔄

**修复进度**：
- ✅ 添加 `MembershipPermissionConfig` 导出
- ⏳ 修复测试文件中的类型使用
**文件范围**：
- `src/__tests__/components/membership/*.test.tsx`
- `src/__tests__/prisma/seed-membership-*.test.ts`

**问题**：
- `MembershipTier`, `MembershipStatus`, `MembershipChangeType` 类型未导出或不存在
- `MembershipTierDef` 缺少 `level` 和 `limits` 属性
- `UserMembership` 使用 `tierId` 而非 `tier`
- `MembershipHistory` 属性不匹配
- `MembershipPermissionConfig` 未导出

**修复方案**：
- 检查并修复 `src/types/membership.ts` 中的类型定义
- 确保所有必需的类型都被正确导出
- 统一 Membership 相关的类型定义

---

### 3. Reminder 类型错误 (约60个错误) 🔄

**修复进度**：
- ✅ 添加 `DISMISSED` 到 `ReminderStatus` 枚举
- ✅ 扩展 `Reminder` 接口添加 `relatedType` 和 `relatedId`
- ✅ 扩展 `CreateReminderInput` 添加缺失属性
- ✅ 扩展 `UpdateReminderInput` 添加 `metadata`
- ✅ 扩展 `ReminderQueryParams` 添加缺失属性
- ✅ 扩展 `ReminderListResponse` 添加 `total`, `page`, `limit`
- ✅ 扩展 `ReminderPreferences` 添加 `hoursBefore` 等兼容字段

### 7. Notification 类型错误 (约15个错误) 🔄

**修复进度**：
- ✅ 添加 `EmailSendOptions`, `EmailSendResult`, `EmailTemplate` 类型
- ✅ 添加 `NotificationSendResult` 类型
- ✅ 扩展 `SMSSendResult` 添加 `devMessage`
- ✅ 扩展 `SMSSendOptions` 添加 `templateCode`
- ✅ 添加 `CONSOLE` 到 `SMSProvider` 枚举
**文件范围**：
- `src/__tests__/components/reminder/*.test.tsx`
- `src/__tests__/lib/notification/reminder/*.test.ts`
- `src/lib/notification/reminder-*.ts`
- `src/lib/case/case-status-monitor.ts`
- `src/lib/task/task-reminder.ts`

**问题**：
- `ReminderType` 枚举值不匹配：
  - 代码中使用 `DEADLINE`, `TASK` 但枚举中不存在
  - 应该使用 `CASE_DEADLINE`, `TASK_DUE`
- `ReminderStatus` 缺少 `DISMISSED` 值
- `CreateReminderInput` 缺少属性：`message`, `reminderTime`, `relatedType`, `relatedId`
- `UpdateReminderInput` 缺少 `metadata` 属性
- `ReminderQueryParams` 缺少属性：`startTime`, `endTime`, `limit`
- `ReminderListResponse` 缺少 `total`, `page`, `limit` 属性
- `ReminderPreferences` 类型结构不匹配
- Reminder 类型缺少属性：`content`, `scheduledAt`, `channel`, `sentAt`

**修复方案**：
- 更新 `src/types/notification.ts` 中的 Reminder 相关类型
- 统一 ReminderType 枚举的使用
- 添加缺失的属性到相关接口

---

### 4. Task 类型错误 (约30个错误) ✅

**修复进度**：
- ✅ 添加 `AssignTaskInput` 类型
- ✅ 导出验证函数：`isValidTaskStatus`, `isValidTaskPriority`
- ✅ 导出验证函数：`validateCreateTaskInput`, `validateUpdateTaskInput`, `validateAssignTaskInput`
- ✅ 导出标签函数：`getTaskStatusLabel`, `getTaskPriorityLabel`
**文件范围**：
- `src/__tests__/types/task.test.ts`
- `src/__tests__/components/reminder/*.test.tsx`

**问题**：
- 未导出的类型和函数：
  - `AssignTaskInput`
  - `isValidTaskStatus`, `isValidTaskPriority`
  - `validateCreateTaskInput`, `validateUpdateTaskInput`, `validateAssignTaskInput`
  - `getTaskStatusLabel`, `getTaskPriorityLabel`
- `CreateTaskInput` 缺少 `type` 属性（必需）
- `CreateTaskInput` 不应包含 `status`, `estimatedHours`
- `UpdateTaskInput` 不应包含 `actualHours`, `completedAt`
- `TaskPriority` 类型不匹配（`string[]` vs `TaskPriority[]`）

**修复方案**：
- 更新 `src/types/task.ts`，导出所有必需的类型和函数
- 修正 `CreateTaskInput` 和 `UpdateTaskInput` 的属性定义

---

### 5. Usage 类型错误 (约40个错误) 🔄

**修复进度**：
- ✅ 更新 `UsageType` 枚举以匹配 Prisma Schema
- ✅ 扩展 `UsageStats` 接口添加缺失属性
**文件范围**：
- `src/__tests__/usage/record-usage.test.ts`
- `src/lib/usage/record-usage.ts`
- `src/lib/middleware/check-usage-limit.ts`

**问题**：
- `UsageType` 枚举不匹配：
  - 代码中使用：`CASE`, `CASE_CREATED`, `DEBATE_GENERATED`, `DOCUMENT_ANALYZED`, `LAW_ARTICLE_SEARCHED`, `AI_TOKEN_USED`, `STORAGE_USED`
  - Prisma 中的枚举值不同
- `UsageStats` 属性不匹配：
  - 缺少：`userId`, `casesCreated`, `debatesGenerated`, `documentsAnalyzed`, `lawArticleSearches`, `aiTokensUsed`, `storageUsedMB`, `limits`, `remaining`, `periodStart`, `periodEnd`
  - 可能有：`used`, `limit`

**修复方案**：
- 检查 Prisma schema 中的 `UsageType` 枚举定义
- 更新 `src/types/membership.ts` 中的 `UsageStats` 类型
- 统一使用正确的 UsageType 枚举值

---

### 6. JWT 类型错误 (约10个错误) ✅

**修复进度**：
- ✅ 扩展 `JwtVerifyResult` 添加 `userId`, `email`, `role` 便捷访问属性
**文件范围**：
- `src/lib/security/permissions.ts`

**问题**：
- `JwtVerifyResult` 缺少属性：`userId`, `role`

**修复方案**：
- 更新 `src/lib/auth/jwt.ts` 中的 `JwtVerifyResult` 类型定义

---

### 7. Notification 类型错误 (约15个错误) ⏳
**文件范围**：
- `src/lib/notification/email-service.ts`
- `src/lib/notification/notification-service.ts`
- `src/lib/notification/sms-service.ts`
- `src/lib/notification/reminder-service.ts`
- `src/components/reminder/ReminderSettings.tsx`

**问题**：
- 未导出的类型：
  - `EmailSendOptions`, `EmailSendResult`, `EmailTemplate`
  - `NotificationSendResult`
- `SMSSendResult` 缺少 `devMessage` 属性
- `SMSSendOptions` 使用 `templateCode` 而非 `templateId`
- `SMSProvider` 缺少 `CONSOLE` 值
- `NotificationChannel` 类型不匹配（`string[]` vs `NotificationChannel[]`）

**修复方案**：
- 更新 `src/types/notification.ts`，添加缺失的类型和属性
- 统一 SMS 相关的属性命名

---

### 8. 其他类型错误 (约19个错误) 🔄

**修复进度**：
- ✅ 添加 `FeeType` 作为 `ExpenseCategory` 的别名
- ⏳ 修复 `RedisInfo` 类型
- ⏳ 修复 `DebateGenerationConfig` 类型
- ⏳ 修复 `TeamForm` 验证逻辑
- ⏳ 检查 Contract Prisma 模型
**文件范围**：
- `src/lib/calculation/fee-calculation-service.ts`
- `src/lib/cache/monitor.ts`
- `src/lib/debate/debate-generator.ts`
- `src/components/team/TeamForm.tsx`
- `src/lib/security/permissions.ts`

**问题**：
- `FeeType` 未定义
- `RedisInfo` 缺少 `memory` 和 `stats` 属性
- `DebateGenerationConfig` 的 `debateMode` 应该是必需的
- `TeamForm` 中的验证结果类型错误
- Contract 模型缺少 `userId` 字段

**修复方案**：
- 添加 `FeeType` 类型定义到 `src/types/calculation.ts`
- 更新 `RedisInfo` 类型
- 修正 `DebateGenerationConfig` 类型
- 修复 TeamForm 的验证逻辑
- 检查 Contract Prisma 模型

---

## 修复优先级

### 高优先级（核心类型定义）
1. **Membership 类型** - 影响范围最广
2. **Reminder 类型** - 多处使用
3. **Usage 类型** - 核心功能
4. **Task 类型** - 基础功能

### 中优先级（功能模块）
5. **Notification 类型**
6. **JWT 类型**
7. **其他类型**

### 低优先级（测试文件）
8. **Jest 测试类型** - 不影响运行时

---

## 修复步骤

1. 先修复核心类型定义文件（`src/types/*.ts`）
2. 再修复使用这些类型的库文件（`src/lib/**/*.ts`）
3. 最后修复测试文件（`src/__tests__/**/*.ts`）
4. 每修复一个分类后运行类型检查验证

---

## 预计修复时间
- 核心类型定义：需要仔细检查和修正
- 库文件修复：根据新的类型定义调整
- 测试文件修复：相对简单，主要是类型导入和 mock 修复
