# 项目类型规范（最小化迁移方案）

> **方案A - 直接修改现有文件，不创建新目录** - 2024年修订

## 核心原则

1. **不创建新目录** - 在现有 `src/types/` 基础上直接扩展
2. **直接修改现有文件** - 不创建 `domain/`、`enums/` 等新目录
3. **API 边界类型转换** - 在 API 路由层处理 Prisma 与业务类型的转换
4. **渐进式迁移** - 按模块逐个修复，每步可验证

---

## 当前问题分析

### 核心问题

1. **类型别名被用作值** - `TeamType` 是类型但被当作值使用（`TeamType.PROJECT`）
2. **Prisma 枚举与业务类型不一致** - Prisma 使用大写（`PLAINTIFF`），业务代码可能使用小写
3. **缺少运行时常量** - 类型定义没有对应的运行时值

### 问题代码示例

```typescript
// ❌ 错误：类型别名被用作值
import { TeamType } from '@/types/team';
const teamType = TeamType.PROJECT; // 运行时错误！

// ✅ 正确：使用运行时常量
import { TeamTypeValues } from '@/types/team';
const teamType = TeamTypeValues.PROJECT;
```

---

## 最小化迁移方案

### 策略：在现有文件中添加运行时常量，不改变文件结构

#### 步骤 1：在现有类型文件中添加运行时常量

**修改文件**: `src/types/team.ts`

```typescript
// 现有类型定义（保留不变）
export type TeamType =
  | 'PROJECT'
  | 'DEPARTMENT'
  | 'COMMITTEE'
  | 'TASK_FORCE'
  | 'LAW_FIRM'
  | 'LEGAL_TEAM'
  | 'LEGAL_DEPT'
  | 'OTHER';
export type TeamStatus = 'ACTIVE' | 'ARCHIVED' | 'DISBANDED' | 'INACTIVE';
export type TeamRole =
  | 'ADMIN'
  | 'MEMBER'
  | 'VIEWER'
  | 'LAWYER'
  | 'PARALEGAL'
  | 'LEAD_COUNSEL';
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'REMOVED';

// 新增：运行时常量（直接添加在原文件中）
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

export const TeamStatusValues = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DISBANDED: 'DISBANDED',
  INACTIVE: 'INACTIVE',
} as const;

export const TeamRoleValues = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
  LAWYER: 'LAWYER',
  PARALEGAL: 'PARALEGAL',
  LEAD_COUNSEL: 'LEAD_COUNSEL',
} as const;

export const MemberStatusValues = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  REMOVED: 'REMOVED',
} as const;

// 类型导出（方便批量导入）
export type TeamTypeValue =
  (typeof TeamTypeValues)[keyof typeof TeamTypeValues];
export type TeamStatusValue =
  (typeof TeamStatusValues)[keyof typeof TeamStatusValues];
export type TeamRoleValue =
  (typeof TeamRoleValues)[keyof typeof TeamRoleValues];
export type MemberStatusValue =
  (typeof MemberStatusValues)[keyof typeof MemberStatusValues];
```

#### 步骤 2：创建类型转换工具（不创建新目录，放在 `src/lib/`）

**修改文件**: `src/lib/types/type-converters.ts`（新建，但放在现有 lib 目录）

```typescript
/**
 * 类型转换工具
 *
 * 在 API 边界处理 Prisma 枚举与业务类型的转换
 */

import { Prisma } from '@prisma/client';

// =============================================================================
// 辩论模块转换
// =============================================================================

export function toPrismaDebateStatus(status: string): Prisma.DebateStatus {
  // 确保值是大写的（Prisma 枚举通常是大写）
  return status.toUpperCase() as Prisma.DebateStatus;
}

export function fromPrismaDebateStatus(status: Prisma.DebateStatus): string {
  return status;
}

export function toPrismaArgumentSide(side: string): Prisma.ArgumentSide {
  return side.toUpperCase() as Prisma.ArgumentSide;
}

export function fromPrismaArgumentSide(side: Prisma.ArgumentSide): string {
  return side;
}

// =============================================================================
// 案件模块转换
// =============================================================================

export function toPrismaCaseStatus(status: string): Prisma.CaseStatus {
  return status.toUpperCase() as Prisma.CaseStatus;
}

export function fromPrismaCaseStatus(status: Prisma.CaseStatus): string {
  return status;
}

export function toPrismaCaseType(type: string): Prisma.CaseType {
  return type.toUpperCase() as Prisma.CaseType;
}

export function fromPrismaCaseType(type: Prisma.CaseType): string {
  return type;
}

// =============================================================================
// 用户模块转换
// =============================================================================

export function toPrismaUserStatus(status: string): Prisma.UserStatus {
  return status.toUpperCase() as Prisma.UserStatus;
}

export function fromPrismaUserStatus(status: Prisma.UserStatus): string {
  return status;
}

export function toPrismaUserRole(role: string): Prisma.UserRole {
  return role.toUpperCase() as Prisma.UserRole;
}

export function fromPrismaUserRole(role: Prisma.UserRole): string {
  return role;
}

// =============================================================================
// 团队模块转换
// =============================================================================

export function toPrismaTeamType(type: string): Prisma.TeamType {
  return type.toUpperCase() as Prisma.TeamType;
}

export function fromPrismaTeamType(type: Prisma.TeamType): string {
  return type;
}

export function toPrismaTeamStatus(status: string): Prisma.TeamStatus {
  return status.toUpperCase() as Prisma.TeamStatus;
}

export function fromPrismaTeamStatus(status: Prisma.TeamStatus): string {
  return status;
}

export function toPrismaTeamRole(role: string): Prisma.TeamRole {
  return role.toUpperCase() as Prisma.TeamRole;
}

export function fromPrismaTeamRole(role: Prisma.TeamRole): string {
  return role;
}

export function toPrismaMemberStatus(status: string): Prisma.MemberStatus {
  return status.toUpperCase() as Prisma.MemberStatus;
}

export function fromPrismaMemberStatus(status: Prisma.MemberStatus): string {
  return status;
}

// =============================================================================
// 会员模块转换
// =============================================================================

export function toPrismaMembershipStatus(
  status: string
): Prisma.MembershipStatus {
  return status.toUpperCase() as Prisma.MembershipStatus;
}

export function fromPrismaMembershipStatus(
  status: Prisma.MembershipStatus
): string {
  return status;
}

export function toPrismaMembershipTier(tier: string): Prisma.MembershipTier {
  return tier.toUpperCase() as Prisma.MembershipTier;
}

export function fromPrismaMembershipTier(tier: Prisma.MembershipTier): string {
  return tier;
}

// =============================================================================
// 通知模块转换
// =============================================================================

export function toPrismaNotificationType(
  type: string
): Prisma.NotificationType {
  return type.toUpperCase() as Prisma.NotificationType;
}

export function fromPrismaNotificationType(
  type: Prisma.NotificationType
): string {
  return type;
}

export function toPrismaNotificationChannel(
  channel: string
): Prisma.NotificationChannel {
  return channel.toUpperCase() as Prisma.NotificationChannel;
}

export function fromPrismaNotificationChannel(
  channel: Prisma.NotificationChannel
): string {
  return channel;
}

export function toPrismaReminderType(type: string): Prisma.ReminderType {
  return type.toUpperCase() as Prisma.ReminderType;
}

export function fromPrismaReminderType(type: Prisma.ReminderType): string {
  return type;
}

// =============================================================================
// 合同模块转换
// =============================================================================

export function toPrismaContractStatus(status: string): Prisma.ContractStatus {
  return status.toUpperCase() as Prisma.ContractStatus;
}

export function fromPrismaContractStatus(
  status: Prisma.ContractStatus
): string {
  return status;
}

export function toPrismaFeeType(type: string): Prisma.FeeType {
  return type.toUpperCase() as Prisma.FeeType;
}

export function fromPrismaFeeType(type: Prisma.FeeType): string {
  return type;
}

// =============================================================================
// 订单/支付模块转换
// =============================================================================

export function toPrismaOrderStatus(status: string): Prisma.OrderStatus {
  return status.toUpperCase() as Prisma.OrderStatus;
}

export function fromPrismaOrderStatus(status: Prisma.OrderStatus): string {
  return status;
}

export function toPrismaPaymentStatus(status: string): Prisma.PaymentStatus {
  return status.toUpperCase() as Prisma.PaymentStatus;
}

export function fromPrismaPaymentStatus(status: Prisma.PaymentStatus): string {
  return status;
}
```

#### 步骤 3：创建类型守卫工具

**修改文件**: `src/lib/types/type-guards.ts`（新建，放在现有 lib 目录）

```typescript
/**
 * 类型守卫工具
 *
 * 提供运行时类型检查函数
 */

// =============================================================================
// 基础类型守卫
// =============================================================================

/**
 * 检查字符串是否为有效的枚举值
 */
export function isEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return typeof value === 'string' && allowedValues.includes(value as T);
}

/**
 * 安全获取枚举值的标签
 */
export function getEnumLabel<T extends string, L extends string>(
  value: T,
  labels: Record<T, L>,
  defaultLabel: L
): L {
  return labels[value] || defaultLabel;
}

// =============================================================================
// 辩论模块守卫
// =============================================================================

import { DebateStatusValues, type DebateStatusValue } from '@/types/debate';

export function isDebateStatus(value: unknown): value is DebateStatusValue {
  return isEnumValue(
    value,
    Object.values(DebateStatusValues) as readonly DebateStatusValue[]
  );
}

import { ArgumentSideValues, type ArgumentSideValue } from '@/types/debate';

export function isArgumentSide(value: unknown): value is ArgumentSideValue {
  return isEnumValue(
    value,
    Object.values(ArgumentSideValues) as readonly ArgumentSideValue[]
  );
}

// =============================================================================
// 案件模块守卫
// =============================================================================

import { CaseStatusValues, type CaseStatusValue } from '@/types/case';
import { CaseTypeValues, type CaseTypeValue } from '@/types/case';

export function isCaseStatus(value: unknown): value is CaseStatusValue {
  return isEnumValue(
    value,
    Object.values(CaseStatusValues) as readonly CaseStatusValue[]
  );
}

export function isCaseType(value: unknown): value is CaseTypeValue {
  return isEnumValue(
    value,
    Object.values(CaseTypeValues) as readonly CaseTypeValue[]
  );
}

// =============================================================================
// 团队模块守卫
// =============================================================================

import {
  TeamTypeValues,
  type TeamTypeValue,
  TeamStatusValues,
  type TeamStatusValue,
  TeamRoleValues,
  type TeamRoleValue,
  MemberStatusValues,
  type MemberStatusValue,
} from '@/types/team';

export function isTeamType(value: unknown): value is TeamTypeValue {
  return isEnumValue(
    value,
    Object.values(TeamTypeValues) as readonly TeamTypeValue[]
  );
}

export function isTeamStatus(value: unknown): value is TeamStatusValue {
  return isEnumValue(
    value,
    Object.values(TeamStatusValues) as readonly TeamStatusValue[]
  );
}

export function isTeamRole(value: unknown): value is TeamRoleValue {
  return isEnumValue(
    value,
    Object.values(TeamRoleValues) as readonly TeamRoleValue[]
  );
}

export function isMemberStatus(value: unknown): value is MemberStatusValue {
  return isEnumValue(
    value,
    Object.values(MemberStatusValues) as readonly MemberStatusValue[]
  );
}

// =============================================================================
// 会员模块守卫
// =============================================================================

import {
  MembershipStatusValues,
  type MembershipStatusValue,
  MembershipTierValues,
  type MembershipTierValue,
} from '@/types/membership';

export function isMembershipStatus(
  value: unknown
): value is MembershipStatusValue {
  return isEnumValue(
    value,
    Object.values(MembershipStatusValues) as readonly MembershipStatusValue[]
  );
}

export function isMembershipTier(value: unknown): value is MembershipTierValue {
  return isEnumValue(
    value,
    Object.values(MembershipTierValues) as readonly MembershipTierValue[]
  );
}

// =============================================================================
// 通知模块守卫
// =============================================================================

import {
  NotificationTypeValues,
  type NotificationTypeValue,
  NotificationChannelValues,
  type NotificationChannelValue,
  ReminderTypeValues,
  type ReminderTypeValue,
  ReminderStatusValues,
  type ReminderStatusValue,
} from '@/types/notification';

export function isNotificationType(
  value: unknown
): value is NotificationTypeValue {
  return isEnumValue(
    value,
    Object.values(NotificationTypeValues) as readonly NotificationTypeValue[]
  );
}

export function isNotificationChannel(
  value: unknown
): value is NotificationChannelValue {
  return isEnumValue(
    value,
    Object.values(
      NotificationChannelValues
    ) as readonly NotificationChannelValue[]
  );
}

export function isReminderType(value: unknown): value is ReminderTypeValue {
  return isEnumValue(
    value,
    Object.values(ReminderTypeValues) as readonly ReminderTypeValue[]
  );
}

export function isReminderStatus(value: unknown): value is ReminderStatusValue {
  return isEnumValue(
    value,
    Object.values(ReminderStatusValues) as readonly ReminderStatusValue[]
  );
}

// =============================================================================
// 合同模块守卫
// =============================================================================

import {
  ContractStatusValues,
  type ContractStatusValue,
  FeeTypeValues,
  type FeeTypeValue,
} from '@/types/contract';

export function isContractStatus(value: unknown): value is ContractStatusValue {
  return isEnumValue(
    value,
    Object.values(ContractStatusValues) as readonly ContractStatusValue[]
  );
}

export function isFeeType(value: unknown): value is FeeTypeValue {
  return isEnumValue(
    value,
    Object.values(FeeTypeValues) as readonly FeeTypeValue[]
  );
}

// =============================================================================
// 订单/支付模块守卫
// =============================================================================

import {
  OrderStatusValues,
  type OrderStatusValue,
  PaymentStatusValues,
  type PaymentStatusValue,
} from '@/types/order';

export function isOrderStatus(value: unknown): value is OrderStatusValue {
  return isEnumValue(
    value,
    Object.values(OrderStatusValues) as readonly OrderStatusValue[]
  );
}

export function isPaymentStatus(value: unknown): value is PaymentStatusValue {
  return isEnumValue(
    value,
    Object.values(PaymentStatusValues) as readonly PaymentStatusValue[]
  );
}
```

---

## 分阶段迁移计划

### 阶段 1：辩论模块（1 周）

| 任务             | 文件                            | 状态   |
| ---------------- | ------------------------------- | ------ |
| 添加辩论状态常量 | `src/types/debate.ts`           | 待实施 |
| 添加辩论立场常量 | `src/types/debate.ts`           | 待实施 |
| 添加类型守卫     | `src/lib/types/type-guards.ts`  | 待实施 |
| 更新组件使用     | `src/components/debate/*.tsx`   | 待实施 |
| 更新 API 路由    | `src/app/api/debates/**/*.ts`   | 待实施 |
| 修复测试文件     | `src/__tests__/lib/debate/*.ts` | 待实施 |

### 阶段 2：案件/用户模块（2 周）

| 任务             | 文件                | 状态   |
| ---------------- | ------------------- | ------ |
| 添加案件类型常量 | `src/types/case.ts` | 待实施 |
| 添加用户状态常量 | `src/types/user.ts` | 待实施 |
| 更新组件和 API   | 相关文件            | 待实施 |
| 修复测试文件     | 相关测试文件        | 待实施 |

### 阶段 3：其他模块（1 周）

| 模块     | 任务               |
| -------- | ------------------ |
| 团队模块 | 添加常量、更新使用 |
| 会员模块 | 添加常量、更新使用 |
| 通知模块 | 添加常量、更新使用 |
| 合同模块 | 添加常量、更新使用 |
| 订单模块 | 添加常量、更新使用 |

---

## API 边界类型转换示例

### 示例 1：团队创建 API

**文件**: `src/app/api/teams/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { TeamTypeValues, TeamStatusValues } from '@/types/team';
import {
  toPrismaTeamType,
  toPrismaTeamStatus,
} from '@/lib/types/type-converters';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // 类型转换：从业务类型转换为 Prisma 类型
  const teamData = {
    name: body.name,
    type: toPrismaTeamType(body.type), // 业务类型 -> Prisma 枚举
    status: toPrismaTeamStatus(body.status || TeamStatusValues.ACTIVE),
    description: body.description,
  };

  const team = await prisma.team.create({
    data: teamData,
  });

  // 类型转换：从 Prisma 类型转换为业务类型
  return NextResponse.json({
    id: team.id,
    name: team.name,
    type: team.type, // Prisma 枚举直接返回（保持大写）
    status: team.status,
    createdAt: team.createdAt,
  });
}
```

### 示例 2：团队列表 API

**文件**: `src/app/api/teams/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};

  if (type) {
    // 类型守卫检查
    if (Object.values(TeamTypeValues).includes(type as any)) {
      where.type = toPrismaTeamType(type);
    }
  }

  if (status) {
    if (Object.values(TeamStatusValues).includes(status as any)) {
      where.status = toPrismaTeamStatus(status);
    }
  }

  const teams = await prisma.team.findMany({ where });

  return NextResponse.json({
    teams: teams.map(team => ({
      id: team.id,
      name: team.name,
      type: team.type,
      status: team.status,
    })),
  });
}
```

---

## 修复测试文件

### 示例：修复团队测试

**文件**: `src/__tests__/api/teams/teams-list.test.ts`

```typescript
// ❌ 迁移前：错误使用类型别名作为值
import { TeamType } from '@/types/team';
const teamType = TeamType.LAW_FIRM; // 运行时错误！

// ✅ 迁移后：使用运行时常量
import { TeamTypeValues, TeamStatusValues } from '@/types/team';
const teamType = TeamTypeValues.LAW_FIRM;
const teamStatus = TeamStatusValues.ACTIVE;
```

---

## 迁移检查清单

### 迁移前

- [ ] 备份当前代码库
- [ ] 创建分支进行迁移
- [ ] 确保测试覆盖率 > 80%
- [ ] 运行基准 TypeScript 检查

### 迁移中（每个模块）

- [ ] 在现有类型文件中添加运行时常量
- [ ] 创建类型转换工具（如需要）
- [ ] 更新组件使用新常量
- [ ] 更新 API 路由使用类型转换
- [ ] 修复测试文件
- [ ] 运行单元测试
- [ ] 运行类型检查

### 迁移后

- [ ] 运行完整测试套件
- [ ] 生成类型覆盖率报告
- [ ] 代码审查
- [ ] 更新相关文档

---

## 预期结果

| 指标              | 当前值 | 目标值 |
| ----------------- | ------ | ------ |
| TypeScript 错误数 | ~800+  | < 50   |
| 类型覆盖率        | 未知   | > 85%  |
| 硬编码枚举数      | 大量   | 0      |
| 类型不一致问题    | 大量   | 0      |

---

## 相关文档

- `docs/COMPREHENSIVE_TYPE_CONSISTENCY_FIX_SUMMARY.md` - 类型一致性修复总结
- `docs/TYPES_REFACTORING_PROGRESS.md` - 重构进度跟踪
- `prisma/schema.prisma` - Prisma 数据库模式
