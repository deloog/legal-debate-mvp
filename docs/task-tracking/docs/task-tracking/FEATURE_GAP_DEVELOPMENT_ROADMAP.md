# 功能缺失开发原子化路线图

## 📋 文档信息

**生成时间**: 2026年1月19日  
**文档版本**: v1.0  
**文档目的**: 基于功能缺失分析，制定详细的原子化开发路线图，系统化补齐业务功能缺失

---

## 📊 执行摘要

### 路线图定位

本文档与《项目生产上线修复路线图》（PRODUCTION_FIX_ROADMAP.md）是互补关系：

- **修复路线图**：专注于修复已开发完成但存在问题的功能，确保生产上线
- **本路线图**：专注于开发当前缺失的业务功能，实现完整的律师助手系统

### 建议实施顺序

**第1步**：执行修复路线图中的所有任务（约5周）
- 修复企业认证审核
- 完善支付功能
- 创建Dashboard和报告管理系统
- 其他生产上线必须解决的问题

**第2步**：执行本路线图中的核心业务功能开发（3-4个月）
- 客户关系管理（CRM）
- 案件全周期管理
- 团队协作

**第3步**：执行本路线图中的专业工具和数据分析开发（3-4个月）
- 法律文书模板库
- 费用计算器
- 各类分析报告

### 功能完成度目标

| 阶段 | 当前完成度 | 目标完成度 | 预估时间 |
| ----- | ---------- | ---------- | -------- |
| 修复路线图 | 35% | 100% | 5周 |
| 核心业务功能 | 35% | 85% | 3-4个月 |
| 专业工具和分析 | 35% | 90% | 3-4个月 |
| **最终目标** | **55%** | **90%+** | **6-8个月** |

---

## 🎯 原子化任务设计原则

### 原则1：原子化任务

**定义**：每个任务必须独立可交付，功能完整且可测试

**要求**：
- 单个任务工作量：1-5个工作日
- 功能独立性：不依赖其他未完成的任务
- 测试完整性：任务完成后可独立测试
- 验收标准明确：有清晰的完成标准

**示例**：
- ✅ **好**：任务"客户档案管理" - 完整的CRUD功能，3天完成
- ❌ **差**：任务"CRM系统" - 包含多个子功能，2周完成

### 原则2：文件行数控制

**要求**：
- 单个文件代码行数：**200行左右**
- 超过400行必须拆分
- 硬性上限：500行

**拆分策略**：
```typescript
// ❌ 错误：单个文件过长（500+行）
// src/components/client/ClientManagement.tsx (520行)

// ✅ 正确：拆分为多个小文件
// src/components/client/ClientList.tsx (180行)
// src/components/client/ClientForm.tsx (165行)
// src/components/client/ClientDetail.tsx (192行)
```

### 原则3：不创建重复文件

**要求**：
- 所有改进必须在原文件上进行
- 禁止创建增强版、v2版、new版等重复文件
- 使用Git进行版本控制

**示例**：
```bash
# ❌ 禁止
src/lib/client/client-manager-v2.ts
src/lib/client/enhanced-client-manager.ts
src/lib/client/client-manager-new.ts

# ✅ 正确
src/lib/client/client-manager.ts（直接修改）
```

### 原则4：类型安全

**要求**：
- 生产代码禁止使用`any`类型
- 不确定类型时使用`unknown`类型
- 使用TypeScript interface定义类型

**示例**：
```typescript
// ❌ 错误
function processData(data: any): any {
  return data;
}

// ✅ 正确
function processData(data: unknown): Result {
  if (isValidData(data)) {
    return transformData(data);
  }
  throw new Error('Invalid data');
}
```

### 原则5：测试覆盖率要求

**要求**：
- 单元测试通过率：**100%**
- 测试覆盖率：**90%以上**
- 不得为了通过测试而简化测试

**测试文件位置**：
- 必须放在 `src/__tests__/` 目录
- 按照源码结构组织测试文件

---

## 🗂️ 功能模块分类

根据法律行业的实际需求，将功能分为以下6大类：

### 1. 客户关系管理（CRM）

**优先级**: 🔴 高  
**预估总工期**: 12个工作日（约2.5周）

**业务价值**: 系统化管理客户信息，提升客户服务质量

**现状**: 完成度35%，只有用户账户，缺少客户档案

---

### 2. 案件全周期管理增强

**优先级**: 🔴 高  
**预估总工期**: 22个工作日（约4.5周）

**业务价值**: 完整的案件管理，从立案到结案全流程覆盖

**现状**: 完成度65%，基础管理完整，缺少时间线、提醒等高级功能

---

### 3. 团队协作

**优先级**: 🔴 高  
**预估总工期**: 14个工作日（约3周）

**业务价值**: 支持团队协作办案，提升团队效率

**现状**: 完成度25%，只有角色和权限，缺少团队维度

---

### 4. 专业工具

**优先级**: 🟡 中  
**预估总工期**: 13个工作日（约2.5周）

**业务价值**: 提升专业性，提供法律工作专用工具

**现状**: 完成度30%，只有法条检索，缺少文书模板、费用计算器等

---

### 5. AI功能增强

**优先级**: 🟡 中  
**预估总工期**: 16个工作日（约3周）

**业务价值**: 提升AI分析的深度和广度，提供更多智能功能

**现状**: 完成度95%，核心功能完整，缺少证据链分析等高级功能

---

### 6. 数据分析报告

**优先级**: 🟢 低  
**预估总工期**: 6个工作日（约1.5周）

**业务价值**: 数据驱动决策，了解业务运营情况

**现状**: 完成度55%，后端API完整，前端部分缺失（Dashboard在修复路线图）

---

## 📅 第一阶段：核心业务功能开发（1-3个月）

### 阶段目标

补齐核心业务功能，使系统成为一个可用的律师助手

**工期**: 48个工作日（约10周）

---

## 1. 客户关系管理（CRM）模块

### 任务1.1：客户档案管理

**任务ID**: CRM-001  
**优先级**: 🔴 高  
**预估工作量**: 3个工作日  
**状态**: 未开始

#### 功能描述

创建客户档案管理功能，系统化客户信息

#### 具体任务

**1.1.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model Client {
  id                String         @id @default(cuid())
  userId            String         // 关联的用户ID（律师/法务）
  clientType        ClientType     @default(INDIVIDUAL)
  name              String
  gender            String?
  age               Int?
  profession        String?
  phone             String?
  email             String?
  address           String?
  idCardNumber      String?        // 身份证号
  company           String?        // 企业名称
  creditCode        String?        // 统一社会信用代码
  legalRep         String?        // 法人代表
  source            ClientSource?  // 客户来源
  tags             String[]       @default([])
  status            ClientStatus   @default(ACTIVE)
  notes             String?       @db.Text
  metadata         Json?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  deletedAt        DateTime?

  cases            Case[]
  communications   CommunicationRecord[]

  @@index([userId])
  @@index([clientType])
  @@index([status])
  @@index([source])
  @@map("clients")
}

enum ClientType {
  INDIVIDUAL      // 个人客户
  ENTERPRISE       // 企业客户
  POTENTIAL        // 潜在客户
}

enum ClientSource {
  REFERRAL        // 推荐
  ONLINE          // 网络
  EVENT           // 活动
  ADVERTISING     // 广告
  OTHER           // 其他
}

enum ClientStatus {
  ACTIVE          // 活跃
  INACTIVE        // 非活跃
  LOST            // 流失
  BLACKLISTED     // 黑名单
}
```

**1.1.2 API开发**（1天）

创建以下API路由：

- `POST /api/clients` - 创建客户
- `GET /api/clients` - 获取客户列表
- `GET /api/clients/[id]` - 获取客户详情
- `PUT /api/clients/[id]` - 更新客户信息
- `DELETE /api/clients/[id]` - 删除客户

文件结构：
```
src/app/api/clients/
├── route.ts                (列表和创建)
└── [id]/
    └── route.ts            (详情、更新、删除)
```

**1.1.3 前端页面开发**（1.5天）

创建前端页面和组件：

- `src/app/clients/page.tsx` - 客户列表页面（约200行）
- `src/app/clients/[id]/page.tsx` - 客户详情页面（约200行）
- `src/components/client/ClientForm.tsx` - 客户表单组件（约180行）
- `src/components/client/ClientList.tsx` - 客户列表组件（约180行）

#### 验收标准

- [ ] 可以创建、编辑、删除客户
- [ ] 支持客户类型分类（个人、企业、潜在）
- [ ] 支持客户标签管理
- [ ] 支持客户来源记录
- [ ] 支持客户状态管理
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

#### 文件清单

| 文件路径 | 预估行数 | 说明 |
| -------- | ---------- | ---- |
| `prisma/migrations/xxx_create_client.ts` | 50 | 数据库迁移 |
| `src/types/client.ts` | 80 | 类型定义 |
| `src/app/api/clients/route.ts` | 150 | API路由 |
| `src/app/api/clients/[id]/route.ts` | 150 | API路由 |
| `src/app/clients/page.tsx` | 200 | 列表页面 |
| `src/app/clients/[id]/page.tsx` | 200 | 详情页面 |
| `src/components/client/ClientForm.tsx` | 180 | 表单组件 |
| `src/components/client/ClientList.tsx` | 180 | 列表组件 |
| `src/__tests__/api/clients.test.ts` | 300 | API测试 |
| `src/__tests__/app/clients/page.test.tsx` | 400 | 页面测试 |

---

### 任务1.2：客户案件历史视图

**任务ID**: CRM-002  
**优先级**: 🔴 高  
**预估工作量**: 2个工作日  
**状态**: 未开始

#### 功能描述

按客户维度查看所有历史案件，了解客户法律需求历史

#### 具体任务

**1.2.1 数据库关联**（0.5天）

在Case表添加clientId字段（如果还没有）：

```prisma
model Case {
  // ... 现有字段
  clientId         String?       // 关联的客户ID
  client           Client?       @relation(fields: [clientId], references: [id])
  
  @@index([clientId])
}
```

**1.2.2 API扩展**（0.5天）

在客户详情API中包含案件历史：

- `GET /api/clients/[id]?include=cases` - 获取客户详情和案件历史

**1.2.3 前端组件**（1天）

创建客户案件历史组件：

- `src/components/client/ClientCaseHistory.tsx`（约180行）
- 在客户详情页面展示案件历史时间线

#### 验收标准

- [ ] 可以查看客户的案件历史
- [ ] 按时间顺序展示案件
- [ ] 支持跳转到案件详情
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务1.3：客户沟通记录管理

**任务ID**: CRM-003  
**优先级**: 🔴 高  
**预估工作量**: 3个工作日  
**状态**: 未开始

#### 功能描述

记录客户沟通历史，跟踪客户沟通情况

#### 具体任务

**1.3.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model CommunicationRecord {
  id                String                 @id @default(cuid())
  clientId          String
  userId            String
  type              CommunicationType     @default(PHONE)
  summary           String                @db.Text
  content           String?               @db.Text
  nextFollowUpDate  DateTime?
  isImportant        Boolean               @default(false)
  metadata         Json?
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt

  client            Client                 @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([userId])
  @@index([type])
  @@index([nextFollowUpDate])
  @@index([createdAt])
  @@map("communication_records")
}

enum CommunicationType {
  PHONE            // 电话
  EMAIL            // 邮件
  MEETING          // 面谈
  WECHAT           // 微信
  OTHER            // 其他
}
```

**1.3.2 API开发**（1天）

创建以下API路由：

- `POST /api/communications` - 创建沟通记录
- `GET /api/communications?clientId=xxx` - 获取沟通记录列表
- `GET /api/communications/[id]` - 获取沟通记录详情
- `PUT /api/communications/[id]` - 更新沟通记录
- `DELETE /api/communications/[id]` - 删除沟通记录

**1.3.3 前端开发**（1.5天）

创建前端组件：

- `src/components/client/CommunicationRecordList.tsx`（约180行）
- `src/components/client/CommunicationRecordForm.tsx`（约180行）
- 在客户详情页面展示沟通记录

#### 验收标准

- [ ] 可以创建、编辑、删除沟通记录
- [ ] 支持多种沟通类型
- [ ] 支持设置下次跟进时间
- [ ] 支持标记重要沟通
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务1.4：客户跟进管理

**任务ID**: CRM-004  
**优先级**: 🟡 中  
**预估工作量**: 2个工作日  
**状态**: 未开始

#### 功能描述

系统化跟进客户，提升转化率

#### 具体任务

**1.4.1 跟进任务管理**（1天）

创建跟进任务功能：

- `src/lib/client/follow-up-task-manager.ts`（约180行）
- 基于沟通记录的nextFollowUpDate生成跟进任务
- 提供跟进提醒功能

**1.4.2 跟进提醒**（0.5天）

- 集成到案件提醒系统（任务2.3）
- 提供多渠道提醒（站内、邮件）

**1.4.3 前端组件**（0.5天）

- `src/components/client/FollowUpTasks.tsx`（约160行）
- 显示待跟进的客户列表

#### 验收标准

- [ ] 自动生成跟进任务
- [ ] 支持跟进提醒
- [ ] 支持标记跟进完成
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务1.5：客户统计分析

**任务ID**: CRM-005  
**优先级**: 🟡 中  
**预估工作量**: 2个工作日  
**状态**: 未开始

#### 功能描述

分析客户数据，了解客户结构和价值

#### 具体任务

**1.5.1 统计API**（1天）

创建客户统计API：

- `GET /api/clients/statistics` - 客户统计数据
  - 客户总数
  - 按类型分布
  - 按来源分布
  - 按状态分布
  - 月度新增客户趋势

- `src/app/api/clients/statistics/route.ts`（约200行）

**1.5.2 前端图表**（1天）

创建客户统计图表组件：

- `src/components/client/ClientStatistics.tsx`（约180行）
- 客户分布饼图
- 客户增长趋势图
- 客户来源分析图

#### 验收标准

- [ ] 显示客户总数和分布
- [ ] 显示客户增长趋势
- [ ] 显示客户来源分析
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

## 2. 案件全周期管理增强

### 任务2.1：案件时间线管理

**任务ID**: CASE-001  
**优先级**: 🔴 高  
**预估工作量**: 4个工作日  
**状态**: 进行中  
**实际进度**:
- 2.1.1 数据库设计: ✅ 已完成
- 2.1.2 API开发: ✅ 已完成（测试通过率100%）
- 2.1.3 前端组件: 🔄 进行中（组件已存在，测试通过率55%）
- 2.1.4 自动时间线: ✅ 已完成

#### 功能描述

创建案件时间线功能，直观了解案件进展

#### 具体任务

**2.1.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model CaseTimeline {
  id                String               @id @default(cuid())
  caseId            String
  eventType        CaseTimelineEventType
  title             String
  description       String?              @db.Text
  eventDate        DateTime
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  case              Case                 @relation(fields: [caseId], references: [id], onDelete: Cascade)

  @@index([caseId])
  @@index([eventType])
  @@index([eventDate])
  @@map("case_timelines")
}

enum CaseTimelineEventType {
  FILING          // 立案
  PRETRIAL         // 审前准备
  TRIAL           // 开庭
  JUDGMENT        // 判决
  APPEAL          // 上诉
  EXECUTION       // 执行
  CLOSED          // 结案
}
```

**2.1.2 API开发**（1天）

创建以下API路由：

- `POST /api/cases/[id]/timeline` - 创建时间线事件
- `GET /api/cases/[id]/timeline` - 获取时间线
- `PUT /api/timeline-events/[id]` - 更新时间线事件
- `DELETE /api/timeline-events/[id]` - 删除时间线事件

**2.1.3 前端组件**（2天）

创建时间线展示组件：

- `src/components/case/CaseTimeline.tsx`（约200行）- 时间线可视化
- `src/components/case/TimelineEventForm.tsx`（约160行）- 时间线事件表单
- 在案件详情页面展示时间线

**2.1.4 自动时间线**（0.5天）

根据案件状态自动生成时间线事件：

- `src/lib/case/timeline-generator.ts`（约150行）

#### 验收标准

- [ ] 可以手动添加时间线事件
- [ ] 根据案件状态自动生成时间线
- [ ] 时间线可视化展示
- [ ] 支持编辑和删除时间线事件
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务2.2：法庭日历管理

**任务ID**: CASE-002  
**优先级**: 🔴 高  
**预估工作量**: 5个工作日  
**状态**: 未开始

#### 功能描述

系统管理法庭时间，避免冲突和遗漏

#### 具体任务

**2.2.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model CourtSchedule {
  id                String               @id @default(cuid())
  caseId            String
  title             String
  type              CourtScheduleType    @default(TRIAL)
  startTime        DateTime
  endTime          DateTime
  location          String?
  judge            String?
  notes             String?              @db.Text
  status           CourtScheduleStatus  @default(SCHEDULED)
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  case              Case                 @relation(fields: [caseId], references: [id], onDelete: Cascade)

  @@unique([caseId, startTime])
  @@index([caseId])
  @@index([type])
  @@index([startTime])
  @@index([status])
  @@map("court_schedules")
}

enum CourtScheduleType {
  TRIAL           // 开庭
  MEDIATION       // 调解
  ARBITRATION     // 仲裁
  MEETING         // 会谈
  OTHER           // 其他
}

enum CourtScheduleStatus {
  SCHEDULED       // 已安排
  CONFIRMED       // 已确认
  COMPLETED       // 已完成
  CANCELLED       // 已取消
  RESCHEDULED     // 已改期
}
```

**2.2.2 API开发**（1.5天）

创建以下API路由：

- `POST /api/court-schedules` - 创建法庭日程
- `GET /api/court-schedules` - 获取法庭日程列表
- `GET /api/court-schedules/[id]` - 获取法庭日程详情
- `PUT /api/court-schedules/[id]` - 更新法庭日程
- `DELETE /api/court-schedules/[id]` - 删除法庭日程
- `GET /api/court-schedules/conflicts` - 检测日程冲突

**2.2.3 冲突检测**（1天）

实现日程冲突检测逻辑：

- `src/lib/court/schedule-conflict-detector.ts`（约200行）
- 检测同一用户同一时间的多个日程
- 检测同一案件的时间重叠

**2.2.4 前端页面**（1.5天）

创建法庭日历页面：

- `src/app/court-schedule/page.tsx`（约200行）- 法庭日历主页
- `src/components/court/CourtCalendar.tsx`（约180行）- 日历组件
- `src/components/court/CourtScheduleForm.tsx`（约170行）- 日程表单

#### 验收标准

- [ ] 可以创建、编辑、删除法庭日程
- [ ] 日历视图展示日程
- [ ] 自动检测日程冲突
- [ ] 支持日程邀请和确认
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务2.3：案件提醒功能

**任务ID**: CASE-003  
**优先级**: 🔴 高  
**预估工作量**: 3个工作日  
**状态**: 未开始

#### 功能描述

多渠道提醒重要时间节点，避免错过期限

#### 具体任务

**2.3.1 提醒系统设计**（0.5天）

创建Prisma模型（如果还没有）：

```prisma
model Reminder {
  id                String               @id @default(cuid())
  userId            String
  type              ReminderType
  title             String
  message           String?              @db.Text
  reminderTime     DateTime
  channels         String[]             @default([])
  status           ReminderStatus        @default(PENDING)
  relatedType      String?              // 关联类型：case、court_schedule等
  relatedId        String?              // 关联ID
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  @@index([userId])
  @@index([type])
  @@index([reminderTime])
  @@index([status])
  @@map("reminders")
}

enum ReminderType {
  COURT_SCHEDULE   // 法庭提醒
  DEADLINE        // 截止日期提醒
  FOLLOW_UP       // 跟进提醒
  CUSTOM          // 自定义提醒
}

enum ReminderStatus {
  PENDING         // 待发送
  SENT           // 已发送
  READ           // 已读
  DISMISSED      // 已忽略
}
```

**2.3.2 提醒生成器**（1天）

创建自动提醒生成功能：

- `src/lib/reminder/reminder-generator.ts`（约200行）
- 根据法庭日程自动生成开庭提醒
- 根据案件状态自动生成截止日期提醒
- 根据沟通记录自动生成跟进提醒

**2.3.3 提醒发送器**（1天）

创建多渠道提醒发送功能：

- `src/lib/reminder/reminder-sender.ts`（约200行）
- 站内消息提醒
- 邮件提醒（使用已有邮件服务）
- 短信提醒（预留接口）

**2.3.4 前端组件**（0.5天）

- `src/components/reminder/ReminderList.tsx`（约180行）
- `src/components/reminder/ReminderSettings.tsx`（约160行）

#### 验收标准

- [ ] 自动生成法庭提醒（开庭前1天、1小时）
- [ ] 自动生成截止日期提醒
- [ ] 自动生成跟进提醒
- [ ] 支持多渠道提醒
- [ ] 可以创建自定义提醒
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务2.4：证据管理系统

**任务ID**: CASE-004  
**优先级**: 🔴 高  
**预估工作量**: 5个工作日  
**状态**: 未开始

#### 功能描述

系统化管理证据，构建证据体系

#### 具体任务

**2.4.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model Evidence {
  id                String               @id @default(cuid())
  caseId            String
  type              EvidenceType         @default(DOCUMENT)
  name              String
  description       String?              @db.Text
  fileUrl           String?
  submitter         String?              // 提交人
  source           String?
  status           EvidenceStatus        @default(PENDING)
  relevanceScore   Float?               // 相关性评分（AI生成）
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  case              Case                 @relation(fields: [caseId], references: [id], onDelete: Cascade)
  relations          EvidenceRelation[]

  @@index([caseId])
  @@index([type])
  @@index([status])
  @@index([relevanceScore])
  @@map("evidence")
}

model EvidenceRelation {
  id                String               @id @default(cuid())
  evidenceId        String
  relationType      EvidenceRelationType
  relatedId         String               // 关联的ID（法条、论点等）
  description       String?
  createdAt        DateTime             @default(now())

  evidence          Evidence             @relation(fields: [evidenceId], references: [id], onDelete: Cascade)

  @@index([evidenceId])
  @@index([relationType])
  @@index([relatedId])
  @@map("evidence_relations")
}

enum EvidenceType {
  DOCUMENT        // 书证
  PHYSICAL        // 物证
  WITNESS        // 证人证言
  EXPERT_OPINION  // 鉴定意见
  AUDIO_VIDEO     // 音视频
  OTHER          // 其他
}

enum EvidenceStatus {
  PENDING         // 待审核
  ACCEPTED       // 已采纳
  REJECTED       // 已拒绝
  QUESTIONED     // 存疑
}

enum EvidenceRelationType {
  LEGAL_REFERENCE // 关联法条
  ARGUMENT       // 关联论点
  FACT           // 关联事实
  OTHER          // 其他
}
```

**2.4.2 API开发**（1.5天）

创建以下API路由：

- `POST /api/evidence` - 创建证据
- `GET /api/cases/[id]/evidence` - 获取案件证据列表
- `GET /api/evidence/[id]` - 获取证据详情
- `PUT /api/evidence/[id]` - 更新证据
- `DELETE /api/evidence/[id]` - 删除证据
- `POST /api/evidence/[id]/relations` - 创建证据关联

**2.4.3 证据链分析**（1.5天）

创建证据链分析功能：

- `src/lib/evidence/evidence-chain-analyzer.ts`（约250行，需要拆分）
  - 拆分为：
    - `src/lib/evidence/evidence-graph-builder.ts`（约120行）
    - `src/lib/evidence/evidence-path-finder.ts`（约130行）
- 分析证据之间的逻辑关系
- 生成证据链可视化数据

**2.4.4 前端组件**（1.5天）

创建证据管理组件：

- `src/components/evidence/EvidenceList.tsx`（约180行）
- `src/components/evidence/EvidenceForm.tsx`（约170行）
- `src/components/evidence/EvidenceChainGraph.tsx`（约200行）
- 在案件详情页面展示证据

#### 验收标准

- [ ] 可以创建、编辑、删除证据
- [ ] 支持证据分类
- [ ] 支持证据关联
- [ ] 自动分析证据链
- [ ] 证据链可视化展示
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务2.5：案件协作管理

**任务ID**: CASE-005  
**优先级**: 🟡 中  
**预估工作量**: 5个工作日  
**状态**: 未开始

#### 功能描述

支持团队协作办案，提升团队效率

#### 具体任务

**2.5.1 数据库设计**（0.5天）

创建Prisma模型（需要先完成团队管理任务3.1）：

```prisma
model CaseTeamMember {
  id                String               @id @default(cuid())
  caseId            String
  userId            String
  role              CaseRole            @default(ASSISTANT)
  permissions       Json
  joinedAt         DateTime             @default(now())
  notes             String?
  metadata         Json?

  case              Case                 @relation(fields: [caseId], references: [id], onDelete: Cascade)

  @@unique([caseId, userId])
  @@index([caseId])
  @@index([userId])
  @@map("case_team_members")
}

enum CaseRole {
  LEAD            // 主办律师
  ASSISTANT       // 协办律师
  PARALEGAL       // 律师助理
  OBSERVER        // 观察者
}
```

**2.5.2 API开发**（1天）

创建以下API路由：

- `POST /api/cases/[id]/team-members` - 添加团队成员
- `GET /api/cases/[id]/team-members` - 获取团队成员列表
- `PUT /api/cases/[id]/team-members/[userId]` - 更新团队成员权限
- `DELETE /api/cases/[id]/team-members/[userId]` - 移除团队成员

**2.5.3 权限管理**（1.5天）

实现案件权限控制：

- `src/lib/case/case-permission-manager.ts`（约200行）
- 基于角色的权限控制
- 支持自定义权限

**2.5.4 前端组件**（2天）

创建团队协作组件：

- `src/components/case/CaseTeamList.tsx`（约180行）
- `src/components/case/TeamMemberForm.tsx`（约160行）
- `src/components/case/PermissionSelector.tsx`（约170行）

#### 验收标准

- [ ] 可以添加团队成员
- [ ] 支持设置角色和权限
- [ ] 基于权限控制操作
- [ ] 支持权限继承
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

## 3. 团队协作功能

### 任务3.1：团队管理

**任务ID**: TEAM-001  
**优先级**: 🔴 高  
**预估工作量**: 4个工作日  
**状态**: 未开始

#### 功能描述

创建团队功能，支持律师事务所和企业法务部门

#### 具体任务

**3.1.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model Team {
  id                String               @id @default(cuid())
  name              String
  type              TeamType            @default(LAW_FIRM)
  description       String?
  logo              String?
  status           TeamStatus           @default(ACTIVE)
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  members           TeamMember[]

  @@index([type])
  @@index([status])
  @@map("teams")
}

model TeamMember {
  id                String               @id @default(cuid())
  teamId            String
  userId            String
  role              TeamRole
  status           MemberStatus         @default(ACTIVE)
  joinedAt         DateTime             @default(now())
  notes             String?
  metadata         Json?

  team              Team                 @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([teamId])
  @@index([userId])
  @@index([role])
  @@map("team_members")
}

enum TeamType {
  LAW_FIRM        // 律师事务所
  LEGAL_DEPT      // 企业法务部门
  OTHER           // 其他
}

enum TeamStatus {
  ACTIVE          // 活跃
  INACTIVE        // 非活跃
  SUSPENDED      // 已暂停
}

enum TeamRole {
  ADMIN           // 团队管理员
  LAWYER         // 律师
  PARALEGAL       // 律师助理
  OTHER           // 其他
}

enum MemberStatus {
  ACTIVE          // 活跃
  INACTIVE        // 非活跃
  REMOVED        // 已移除
}
```

**3.1.2 API开发**（1.5天）

创建以下API路由：

团队管理：
- `POST /api/teams` - 创建团队
- `GET /api/teams` - 获取团队列表
- `GET /api/teams/[id]` - 获取团队详情
- `PUT /api/teams/[id]` - 更新团队信息
- `DELETE /api/teams/[id]` - 删除团队

团队成员管理：
- `POST /api/teams/[id]/members` - 添加团队成员
- `GET /api/teams/[id]/members` - 获取团队成员列表
- `PUT /api/teams/[id]/members/[userId]` - 更新成员角色
- `DELETE /api/teams/[id]/members/[userId]` - 移除成员

**3.1.3 权限继承**（1天）

实现团队权限继承：

- `src/lib/team/permission-inheritance.ts`（约180行）
- 团队角色映射到系统权限
- 支持自定义权限覆盖

**3.1.4 前端页面**（1天）

创建团队管理页面：

- `src/app/teams/page.tsx`（约200行）- 团队列表
- `src/app/teams/[id]/page.tsx`（约200行）- 团队详情
- `src/components/team/TeamForm.tsx`（约180行）- 团队表单
- `src/components/team/TeamMemberList.tsx`（约180行）- 成员列表

#### 验收标准

- [ ] 可以创建和管理团队
- [ ] 可以添加和管理团队成员
- [ ] 支持团队角色和权限
- [ ] 权限继承正常工作
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务3.2：案件共享和协作

**任务ID**: TEAM-002  
**优先级**: 🔴 高  
**预估工作量**: 3个工作日  
**状态**: 未开始

#### 功能描述

支持案件共享给团队成员，实现团队协作

#### 具体任务

**3.2.1 数据库扩展**（0.5天）

修改Case表（如果需要）：

```prisma
model Case {
  // ... 现有字段
  ownerType        OwnerType           @default(USER)  // 拥有者类型
  sharedWithTeam    Boolean             @default(false) // 是否共享给团队

  @@index([ownerType])
}

enum OwnerType {
  USER            // 个人
  TEAM            // 团队
}
```

**3.2.2 API开发**（1天）

创建以下API路由：

- `POST /api/cases/[id]/share` - 共享案件
- `GET /api/cases/[id]/shared-with` - 获取共享信息
- `DELETE /api/cases/[id]/unshare` - 取消共享

**3.2.3 权限验证**（0.5天）

- `src/lib/case/share-permission-validator.ts`（约180行）
- 验证用户是否有权限查看/编辑共享案件

**3.2.4 前端组件**（1天）

创建案件共享组件：

- `src/components/case/CaseShareDialog.tsx`（约180行）
- `src/components/case/SharedWithList.tsx`（约160行）

#### 验收标准

- [ ] 可以共享案件给团队
- [ ] 可以设置共享权限
- [ ] 团队成员可以查看共享案件
- [ ] 权限验证正确
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务3.3：内部讨论区

**任务ID**: TEAM-003  
**优先级**: 🔴 高  
**预估工作量**: 3个工作日  
**状态**: 未开始

#### 功能描述

团队内部讨论案件，集中沟通

#### 具体任务

**3.3.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model CaseDiscussion {
  id                String               @id @default(cuid())
  caseId            String
  userId            String
  content           String              @db.Text
  mentions          String[]             @default([])
  isPinned         Boolean             @default(false)
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  case              Case                 @relation(fields: [caseId], references: [id], onDelete: Cascade)

  @@index([caseId])
  @@index([userId])
  @@index([createdAt])
  @@index([isPinned])
  @@map("case_discussions")
}
```

**3.3.2 API开发**（1天）

创建以下API路由：

- `POST /api/cases/[id]/discussions` - 发表讨论
- `GET /api/cases/[id]/discussions` - 获取讨论列表
- `PUT /api/discussions/[id]` - 更新讨论
- `DELETE /api/discussions/[id]` - 删除讨论
- `POST /api/discussions/[id]/pin` - 置顶讨论

**3.3.3 @提及功能**（0.5天）

- `src/lib/discussion/mention-parser.ts`（约150行）
- 解析@提及的用户
- 发送通知给被提及用户

**3.3.4 前端组件**（1天）

创建讨论区组件：

- `src/components/discussion/DiscussionList.tsx`（约190行）
- `src/components/discussion/DiscussionForm.tsx`（约170行）
- `src/components/discussion/DiscussionItem.tsx`（约150行）

#### 验收标准

- [ ] 可以发表、编辑、删除讨论
- [ ] 支持@提及功能
- [ ] 可以置顶重要讨论
- [ ] 讨论历史正常显示
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务3.4：任务管理

**任务ID**: TEAM-004  
**优先级**: 🟡 中  
**预估工作量**: 4个工作日  
**状态**: 未开始

#### 功能描述

团队任务管理，提升协作效率

#### 具体任务

**3.4.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model Task {
  id                String               @id @default(cuid())
  title             String
  description       String?              @db.Text
  status           TaskStatus           @default(TODO)
  priority         TaskPriority         @default(MEDIUM)
  caseId           String?
  assignedTo       String?              // 分配给的用户ID
  createdBy       String
  dueDate          DateTime?
  completedAt      DateTime?
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  @@index([caseId])
  @@index([assignedTo])
  @@index([createdBy])
  @@index([status])
  @@index([dueDate])
  @@map("tasks")
}

enum TaskStatus {
  TODO            // 待办
  IN_PROGRESS     // 进行中
  COMPLETED       // 已完成
  CANCELLED       // 已取消
}

enum TaskPriority {
  LOW             // 低
  MEDIUM          // 中
  HIGH            // 高
  URGENT          // 紧急
}
```

**3.4.2 API开发**（1.5天）

创建以下API路由：

- `POST /api/tasks` - 创建任务
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/[id]` - 获取任务详情
- `PUT /api/tasks/[id]` - 更新任务
- `DELETE /api/tasks/[id]` - 删除任务
- `POST /api/tasks/[id]/assign` - 分配任务

**3.4.3 任务提醒**（1天）

- `src/lib/task/task-reminder.ts`（约180行）
- 任务到期提醒
- 集成到提醒系统（任务2.3）

**3.4.4 前端组件**（1天）

创建任务管理组件：

- `src/app/tasks/page.tsx`（约200行）- 任务列表页面
- `src/components/task/TaskForm.tsx`（约170行）- 任务表单
- `src/components/task/TaskList.tsx`（约190行）- 任务列表组件

#### 验收标准

- [ ] 可以创建、编辑、删除任务
- [ ] 可以分配任务
- [ ] 支持任务状态和优先级
- [ ] 支持任务提醒
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

## 📅 第二阶段：专业工具和数据分析（4-6个月）

### 阶段目标

提升专业性和数据驱动决策能力

**工期**: 29个工作日（约6周）

---

## 4. 专业工具开发

### 任务4.1：法律文书模板库

**任务ID**: TOOL-001  
**优先级**: 🔴 高  
**预估工作量**: 5个工作日  
**状态**: 未开始

#### 功能描述

创建法律文书模板库，提升文书制作效率

#### 具体任务

**4.1.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model DocumentTemplate {
  id                String               @id @default(cuid())
  name              String
  type              DocumentTemplateType @default(INDICTMENT)
  category         String?              // 民事、刑事等
  content          String              @db.Text
  variables        Json                 // 模板变量定义
  version          String              @default("1.0")
  isSystem         Boolean             @default(false)
  isPublic         Boolean             @default(false)
  createdBy       String
  status           TemplateStatus       @default(DRAFT)
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  @@index([type])
  @@index([category])
  @@index([createdBy])
  @@index([status])
  @@index([isPublic])
  @@map("document_templates")
}

enum DocumentTemplateType {
  INDICTMENT      // 起诉状
  DEFENSE         // 答辩状
  APPEARANCE      // 代理词
  APPEAL          // 上诉状
  OTHER           // 其他
}

enum TemplateStatus {
  DRAFT           // 草稿
  PUBLISHED       // 已发布
  ARCHIVED        // 已归档
}
```

**4.1.2 API开发**（1.5天）

创建以下API路由：

- `POST /api/document-templates` - 创建模板
- `GET /api/document-templates` - 获取模板列表
- `GET /api/document-templates/[id]` - 获取模板详情
- `PUT /api/document-templates/[id]` - 更新模板
- `DELETE /api/document-templates/[id]` - 删除模板
- `POST /api/document-templates/[id]/generate` - 生成文书

**4.1.3 模板变量引擎**（1.5天）

创建模板变量替换功能：

- `src/lib/template/variable-engine.ts`（约200行）
- 解析模板变量
- 自动填充客户信息、案件信息
- 支持自定义变量

**4.1.4 前端页面**（1.5天）

创建模板管理页面：

- `src/app/document-templates/page.tsx`（约200行）- 模板列表
- `src/app/document-templates/[id]/page.tsx`（约200行）- 模板详情和编辑
- `src/app/document-templates/new/page.tsx`（约180行）- 新建模板
- `src/components/template/TemplateEditor.tsx`（约220行）- 模板编辑器
- `src/components/template/TemplateVariablePicker.tsx`（约170行）- 变量选择器

#### 验收标准

- [ ] 可以创建、编辑、删除模板
- [ ] 支持模板分类和版本管理
- [ ] 模板变量自动替换
- [ ] 一键生成文书
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务4.2：费用计算器

**任务ID**: TOOL-002  
**优先级**: 🔴 高  
**预估工作量**: 3个工作日  
**状态**: 未开始

#### 功能描述

快速计算案件相关费用，提供报价参考

#### 具体任务

**4.2.1 费用计算引擎**（1.5天）

创建费用计算功能：

- `src/lib/calculation/fee-calculator.ts`（约250行，需要拆分）
  - 拆分为：
    - `src/lib/calculation/lawyer-fee-calculator.ts`（约130行）
    - `src/lib/calculation/litigation-fee-calculator.ts`（约120行）
- 律师费计算（按小时、按固定费用、按胜诉分成）
- 诉讼费计算（根据争议金额）
- 差旅费计算

**4.2.2 API开发**（0.5天）

创建以下API路由：

- `POST /api/calculate/fees` - 计算费用
- `GET /api/calculate/fee-rates` - 获取费率配置

**4.2.3 前端组件**（1天）

创建费用计算器组件：

- `src/components/calculation/FeeCalculator.tsx`（约200行）
- `src/components/calculation/FeeBreakdown.tsx`（约170行）- 费用明细

#### 验收标准

- [ ] 支持律师费计算
- [ ] 支持诉讼费计算
- [ ] 支持差旅费计算
- [ ] 提供费用明细清单
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务4.3：证人管理

**任务ID**: TOOL-003  
**优先级**: 🟡 中  
**预估工作量**: 3个工作日  
**状态**: 未开始

#### 功能描述

系统化管理证人，不遗漏出庭安排

#### 具体任务

**4.3.1 数据库设计**（0.5天）

创建Prisma模型：

```prisma
model Witness {
  id                String               @id @default(cuid())
  caseId            String
  name              String
  phone             String?
  address           String?
  relationship      String?              // 与当事人的关系
  testimony        String?              @db.Text  // 证词
  courtScheduleId String?
  status           WitnessStatus        @default(NEED_CONTACT)
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  case              Case                 @relation(fields: [caseId], references: [id], onDelete: Cascade)

  @@index([caseId])
  @@index([status])
  @@map("witnesses")
}

enum WitnessStatus {
  NEED_CONTACT    // 待联系
  CONTACTED       // 已联系
  CONFIRMED       // 已确认出庭
  DECLINED        // 拒绝出庭
  CANCELLED       // 已取消
}
```

**4.3.2 API开发**（1天）

创建以下API路由：

- `POST /api/witnesses` - 创建证人
- `GET /api/cases/[id]/witnesses` - 获取案件证人列表
- `GET /api/witnesses/[id]` - 获取证人详情
- `PUT /api/witnesses/[id]` - 更新证人信息
- `DELETE /api/witnesses/[id]` - 删除证人

**4.3.3 前端组件**（1.5天）

创建证人管理组件：

- `src/components/witness/WitnessList.tsx`（约180行）
- `src/components/witness/WitnessForm.tsx`（约170行）
- `src/components/witness/TestimonyViewer.tsx`（约160行）- 证词查看器

#### 验收标准

- [ ] 可以创建、编辑、删除证人
- [ ] 可以记录证词
- [ ] 可以关联到法庭日程
- [ ] 支持证人出庭提醒
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务4.4：法律时效计算

**任务ID**: TOOL-004  
**优先级**: 🟡 中  
**预估工作量**: 2个工作日  
**状态**: 未开始

#### 功能描述

自动计算法律时效，避免错过期限

#### 具体任务

**4.4.1 时效计算引擎**（1天）

创建时效计算功能：

- `src/lib/calculation/statute-calculator.ts`（约200行）
- 诉讼时效计算（根据案件类型）
- 上诉时效计算
- 执行时效计算

**4.4.2 时效提醒**（0.5天）

- 集成到提醒系统（任务2.3）
- 自动生成时效提醒

**4.4.3 前端组件**（0.5天）

- `src/components/calculation/StatuteCalculator.tsx`（约180行）

#### 验收标准

- [ ] 自动计算诉讼时效
- [ ] 自动计算上诉时效
- [ ] 自动计算执行时效
- [ ] 提供时效提醒
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

## 5. AI功能增强

### 任务5.1：证据链分析

**任务ID**: AI-001  
**优先级**: 🟡 中  
**预估工作量**: 5个工作日  
**状态**: 未开始

#### 功能描述

分析证据之间的逻辑关系，构建完整的证据链

#### 具体任务

**5.1.1 证据关系识别**（1.5天）

创建证据关系识别功能：

- `src/lib/ai/evidence/relationship-identifier.ts`（约200行）
- 基于AI分析证据之间的支撑、反驳、补充关系
- 使用Agent架构中的AnalysisAgent

**5.1.2 证据链生成**（1.5天）

创建证据链生成功能：

- `src/lib/ai/evidence/evidence-chain-builder.ts`（约200行）
- 构建证据之间的逻辑链
- 生成证据链可视化数据

**5.1.3 效力评估**（1天）

创建证据效力评估功能：

- `src/lib/ai/evidence/effectiveness-evaluator.ts`（约180行）
- 基于法条和判例评估证据效力
- 提供效力评分

**5.1.4 前端组件**（1天）

- `src/components/evidence/EvidenceChainVisualizer.tsx`（约200行）

#### 验收标准

- [ ] 自动识别证据关系
- [ ] 构建证据链
- [ ] 评估证据效力
- [ ] 证据链可视化展示
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务5.2：判例相似度分析

**任务ID**: AI-002  
**优先级**: 🟡 中  
**预估工作量**: 7个工作日  
**状态**: 未开始

#### 功能描述

根据案件要素检索相似判例，分析胜败率

#### 具体任务

**5.2.1 案例库设计**（1天）

创建案例数据库（如果还没有）：

```prisma
model CaseExample {
  id                String               @id @default(cuid())
  title             String
  caseNumber        String
  court            String
  type              CaseType
  cause             String?
  facts            String              @db.Text
  judgment          String              @db.Text
  result           CaseResult           @default(WIN)
  judgmentDate     DateTime
  embedding        Json?                // 向量嵌入
  metadata         Json?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  @@index([type])
  @@index([cause])
  @@index([result])
  @@index([judgmentDate])
  @@map("case_examples")
}

enum CaseResult {
  WIN             // 胜诉
  LOSE            // 败诉
  PARTIAL         // 部分胜诉
  WITHDRAW        // 撤诉
}
```

**5.2.2 向量嵌入**（2天）

创建案例向量嵌入功能：

- `src/lib/ai/case/case-embedder.ts`（约200行）
- 使用嵌入模型生成案例向量
- 存储到数据库

**5.2.3 相似度检索**（2天）

创建相似度检索功能：

- `src/lib/ai/case/similarity-searcher.ts`（约220行）
- 基于向量检索相似案例
- 计算相似度评分

**5.2.4 胜败率分析**（1天）

创建胜败率分析功能：

- `src/lib/ai/case/success-rate-analyzer.ts`（约180行）
- 统计相似案例的胜败率
- 预测胜诉概率

**5.2.5 前端组件**（1天）

- `src/components/case/SimilarCasesViewer.tsx`（约190行）
- `src/components/case/SuccessRateChart.tsx`（约170行）

#### 验收标准

- [ ] 可以检索相似判例
- [ ] 显示相似度评分
- [ ] 显示胜败率分析
- [ ] 提供案例详情查看
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务5.3：法律风险评估

**任务ID**: AI-003  
**优先级**: 🟡 中  
**预估工作量**: 4个工作日  
**状态**: 未开始

#### 功能描述

基于案件事实和法条，分析法律风险点

#### 具体任务

**5.3.1 风险识别**（1.5天）

创建风险识别功能：

- `src/lib/ai/risk/risk-identifier.ts`（约200行）
- 基于案件事实识别潜在法律风险
- 使用Agent架构中的VerificationAgent

**5.3.2 风险评分**（1天）

创建风险评分功能：

- `src/lib/ai/risk/risk-scorer.ts`（约180行）
- 计算风险等级（高、中、低）
- 提供风险评分

**5.3.3 风险建议**（1天）

创建风险建议功能：

- `src/lib/ai/risk/risk-advisor.ts`（约190行）
- 提供风险规避建议
- 生成风险报告

**5.3.4 前端组件**（0.5天）

- `src/components/risk/RiskAssessmentViewer.tsx`（约180行）

#### 验收标准

- [ ] 识别法律风险点
- [ ] 计算风险等级和评分
- [ ] 提供风险规避建议
- [ ] 生成风险评估报告
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

## 6. 数据分析报告

### 任务6.1：客户分析报告

**任务ID**: ANALYTICS-001  
**优先级**: 🟡 中  
**预估工作量**: 2个工作日  
**状态**: 未开始

#### 功能描述

分析客户数据，了解客户情况

#### 具体任务

**6.1.1 分析API**（1天）

- `src/app/api/analytics/clients/route.ts`（约200行）
- 客户增长趋势
- 客户类型分布
- 客户转化漏斗
- 客户价值分析

**6.1.2 前端图表**（1天）

- `src/components/analytics/ClientAnalytics.tsx`（约190行）

#### 验收标准

- [ ] 显示客户增长趋势
- [ ] 显示客户类型分布
- [ ] 显示客户转化漏斗
- [ ] 显示客户价值分析
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务6.2：案件分析报告

**任务ID**: ANALYTICS-002  
**优先级**: 🟡 中  
**预估工作量**: 2个工作日  
**状态**: 未开始

#### 功能描述

分析案件数据，了解案件情况

#### 具体任务

**6.2.1 分析API**（1天）

- `src/app/api/analytics/cases/route.ts`（约200行）
- 案件类型分布
- 案件成功率分析
- 案件处理时长分析
- 案件收益分析

**6.2.2 前端图表**（1天）

- `src/components/analytics/CaseAnalytics.tsx`（约190行）

#### 验收标准

- [ ] 显示案件类型分布
- [ ] 显示案件成功率
- [ ] 显示案件处理时长
- [ ] 显示案件收益分析
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务6.3：律师绩效分析

**任务ID**: ANALYTICS-003  
**优先级**: 🟡 中  
**预估工作量**: 2个工作日  
**状态**: 未开始

#### 功能描述

分析律师绩效，优化团队管理

#### 具体任务

**6.3.1 分析API**（1天）

- `src/app/api/analytics/lawyers/route.ts`（约200行）
- 律师案件量统计
- 律师胜诉率统计
- 律师创收统计
- 律师工作时长统计

**6.3.2 前端图表**（1天）

- `src/components/analytics/LawyerPerformance.tsx`（约190行）

#### 验收标准

- [ ] 显示律师案件量
- [ ] 显示律师胜诉率
- [ ] 显示律师创收
- [ ] 显示律师工作时长
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

## 📅 第三阶段：移动端和高级功能（7-12个月）

### 阶段目标

提升移动体验和竞争力

**工期**: 18个工作日（约3.5周，不含移动应用）

---

## 7. 移动端优化

### 任务7.1：移动端响应式优化

**任务ID**: MOBILE-001  
**优先级**: 🔴 高  
**预估工作量**: 5个工作日  
**状态**: 未开始

#### 功能描述

优化移动端布局和交互

#### 具体任务

**7.1.1 响应式布局优化**（2天）

- 优化关键页面的移动端布局
- 使用Tailwind的响应式类
- 添加移动端专用样式

**7.1.2 触摸交互优化**（1天）

- 优化按钮和交互元素的触摸区域
- 添加手势支持（滑动、缩放）
- 优化表单输入体验

**7.1.3 性能优化**（1天）

- 实现组件懒加载
- 优化图片加载
- 减少首屏渲染时间

**7.1.4 移动端专用功能**（1天）

- 拍照上传证据
- 快速查看今日日程
- 快速联系客户

#### 验收标准

- [ ] 移动端布局美观合理
- [ ] 触摸交互流畅
- [ ] 页面加载速度快
- [ ] 支持拍照上传
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务7.2：移动端专用功能

**任务ID**: MOBILE-002  
**优先级**: 🟡 中  
**预估工作量**: 3个工作日  
**状态**: 未开始

#### 功能描述

开发移动端专用功能

#### 具体任务

**7.2.1 今日日程**（1天）

- `src/components/mobile/TodaySchedule.tsx`（约170行）
- 一键快速查看今日日程

**7.2.2 快速备忘**（1天）

- `src/components/mobile/QuickMemo.tsx`（约160行）
- 快速添加备忘

**7.2.3 快速联系**（1天）

- `src/components/mobile/QuickContact.tsx`（约150行）
- 快速联系客户

#### 验收标准

- [ ] 今日日程快速查看
- [ ] 备忘快速添加
- [ ] 客户快速联系
- [ ] 单元测试覆盖率 > 90%
- [ ] 单元测试通过率 = 100%

---

### 任务7.3：微信小程序

**任务ID**: MOBILE-003  
**优先级**: 🟢 低  
**预估工作量**: 10个工作日  
**状态**: 未开始

#### 功能描述

开发微信小程序，方便客户使用

#### 具体任务

**7.3.1 小程序基础架构**（2天）

- 初始化微信小程序项目
- 配置小程序基础功能

**7.3.2 案件查看**（2天）

- 查看案件信息
- 查看案件进度

**7.3.3 日程查看**（2天）

- 查看日程安排
- 接收日程提醒

**7.3.4 简单沟通**（2天）

- 查看案件讨论
- 发送简单消息

**7.3.5 小程序测试和发布**（2天）

- 测试小程序功能
- 提交微信审核

#### 验收标准

- [ ] 案件信息正常显示
- [ ] 日程安排正常显示
- [ ] 提醒功能正常工作
- [ ] 沟通功能正常工作
- [ ] 小程序审核通过

---

## 📊 任务优先级矩阵

### 🔴 高优先级（必须完成）

| 任务ID | 任务名称 | 预估工时 | 依赖任务 |
| ------- | -------- | --------- | -------- |
| CRM-001 | 客户档案管理 | 3天 | 无 |
| CRM-002 | 客户案件历史视图 | 2天 | CRM-001 |
| CRM-003 | 客户沟通记录管理 | 3天 | CRM-001 |
| CASE-001 | 案件时间线管理 | 4天 | 无 |
| CASE-002 | 法庭日历管理 | 5天 | 无 |
| CASE-003 | 案件提醒功能 | 3天 | CASE-002 |
| CASE-004 | 证据管理系统 | 5天 | 无 |
| TEAM-001 | 团队管理 | 4天 | 无 |
| TEAM-002 | 案件共享和协作 | 3天 | TEAM-001 |
| TEAM-003 | 内部讨论区 | 3天 | 无 |
| TOOL-001 | 法律文书模板库 | 5天 | 无 |
| TOOL-002 | 费用计算器 | 3天 | 无 |
| MOBILE-001 | 移动端响应式优化 | 5天 | 无 |

**总计**: 48个工作日（约10周）

---

### 🟡 中优先级（尽快完成）

| 任务ID | 任务名称 | 预估工时 | 依赖任务 |
| ------- | -------- | --------- | -------- |
| CRM-004 | 客户跟进管理 | 2天 | CRM-003 |
| CRM-005 | 客户统计分析 | 2天 | CRM-001 |
| CASE-005 | 案件协作管理 | 5天 | TEAM-001 |
| TOOL-003 | 证人管理 | 3天 | 无 |
| TOOL-004 | 法律时效计算 | 2天 | 无 |
| AI-001 | 证据链分析 | 5天 | CASE-004 |
| AI-002 | 判例相似度分析 | 7天 | 无 |
| AI-003 | 法律风险评估 | 4天 | 无 |
| ANALYTICS-001 | 客户分析报告 | 2天 | CRM-001 |
| ANALYTICS-002 | 案件分析报告 | 2天 | 无 |
| ANALYTICS-003 | 律师绩效分析 | 2天 | TEAM-001 |
| MOBILE-002 | 移动端专用功能 | 3天 | MOBILE-001 |

**总计**: 39个工作日（约8周）

---

### 🟢 低优先级（后续优化）

| 任务ID | 任务名称 | 预估工时 | 依赖任务 |
| ------- | -------- | --------- | -------- |
| TEAM-004 | 任务管理 | 4天 | TEAM-001 |
| MOBILE-003 | 微信小程序 | 10天 | 无 |

**总计**: 14个工作日（约3周）

---

## 📅 总体实施计划

### 实施时间线

```
Month 1-2: 完成修复路线图（PRODUCTION_FIX_ROADMAP.md）
           ├─ Week 1-5: 25个工作日
           └─ 目标: 生产上线

Month 3-4: 核心业务功能开发
           ├─ CRM模块: 12天 (CRM-001 ~ CRM-005)
           ├─ 案件管理: 16天 (CASE-001 ~ CASE-004)
           └─ 团队协作: 14天 (TEAM-001 ~ TEAM-003)

Month 5: 专业工具开发
           ├─ 法律文书模板库: 5天 (TOOL-001)
           ├─ 费用计算器: 3天 (TOOL-002)
           ├─ 证人管理: 3天 (TOOL-003)
           └─ 法律时效计算: 2天 (TOOL-004)

Month 6: AI功能增强
           ├─ 证据链分析: 5天 (AI-001)
           ├─ 判例相似度分析: 7天 (AI-002)
           └─ 法律风险评估: 4天 (AI-003)

Month 7: 数据分析报告
           ├─ 客户分析报告: 2天 (ANALYTICS-001)
           ├─ 案件分析报告: 2天 (ANALYTICS-002)
           └─ 律师绩效分析: 2天 (ANALYTICS-003)

Month 8-9: 移动端优化
           ├─ 移动端响应式优化: 5天 (MOBILE-001)
           └─ 移动端专用功能: 3天 (MOBILE-002)

Month 10-12: 高级功能
           └─ 微信小程序: 10天 (MOBILE-003)
```

### 总工期统计

| 阶段 | 工作日 | 自然日 | 累计工作日 | 累计自然日 |
| ----- | ------ | ------ | ---------- | ---------- |
| 修复路线图 | 25 | 35 | 25 | 35 |
| 核心业务功能 | 42 | 60 | 67 | 95 |
| 专业工具 | 13 | 19 | 80 | 114 |
| AI功能增强 | 16 | 23 | 96 | 137 |
| 数据分析报告 | 6 | 9 | 102 | 146 |
| 移动端优化 | 8 | 12 | 110 | 158 |
| 高级功能 | 10 | 15 | 120 | 173 |
| **总计** | **120** | **173** | **120** | **173** |
