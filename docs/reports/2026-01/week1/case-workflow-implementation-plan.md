# 律师办案流程完整覆盖 - 原子化实施计划

> **文档版本**: v1.0
> **创建日期**: 2026-01-28
> **目标**: 覆盖律师办案全流程（除庭审外）

---

## 目录

1. [项目概述](#项目概述)
2. [模块一：接案咨询](#模块一接案咨询)
3. [模块二：签约立案](#模块二签约立案)
4. [模块三：证据收集增强](#模块三证据收集增强)
5. [数据库设计](#数据库设计)
6. [API设计](#api设计)
7. [技术注意事项](#技术注意事项)

---

## 项目概述

### 当前办案流程覆盖状态

```
┌─────────────────────────────────────────────────────────────────┐
│                     律师办案完整流程                              │
├─────────────────────────────────────────────────────────────────┤
│  1.接案咨询  →  2.签约立案  →  3.证据收集  →  4.法律研究         │
│     ❌新增       ❌新增        ✅增强        ✅已有              │
│                                                                  │
│  5.策略制定  →  6.文书撰写  →  7.庭审准备  →  8.庭审(不覆盖)    │
│     ✅核心       ✅已有        ✅核心        ⬜不覆盖            │
│                                                                  │
│  9.结案归档                                                      │
│     ✅已有                                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 实施优先级

| 优先级 | 模块 | 状态 | 预计任务数 |
|--------|------|------|-----------|
| P0 | 模块一：接案咨询 | 待开发 | 25个原子任务 |
| P1 | 模块二：签约立案 | 待开发 | 20个原子任务 |
| P2 | 模块三：证据增强 | 待开发 | 12个原子任务 |

---

## 模块一：接案咨询

### 1.1 数据模型设计

#### 任务 1.1.1：创建咨询记录模型 (Consultation)

**文件**: `prisma/schema.prisma`

```prisma
// 咨询记录模型
model Consultation {
  id              String   @id @default(cuid())

  // 基本信息
  consultNumber   String   @unique  // 咨询编号，如: ZX20260128001
  clientName      String             // 咨询人姓名
  clientPhone     String?            // 联系电话
  clientEmail     String?            // 邮箱
  clientCompany   String?            // 单位名称（企业客户）

  // 咨询信息
  consultType     ConsultationType   // 咨询方式：来电/来访/在线
  consultTime     DateTime           // 咨询时间
  caseType        String?            // 案件类型
  caseSummary     String             // 案情摘要
  clientDemand    String?            // 客户诉求

  // AI评估结果
  aiAssessment    Json?              // AI案件评估结果
  winRate         Float?             // 胜诉率评估 (0-1)
  difficulty      String?            // 难度评估：简单/中等/复杂
  riskLevel       String?            // 风险等级：低/中/高
  suggestedFee    Decimal?           // 建议收费

  // 跟进状态
  status          ConsultStatus      @default(PENDING)
  followUpDate    DateTime?          // 下次跟进日期
  followUpNotes   String?            // 跟进备注

  // 转化信息
  convertedToCaseId String?          // 转化后的案件ID
  convertedAt       DateTime?        // 转化时间

  // 关联
  userId          String             // 接待律师ID
  user            User               @relation(fields: [userId], references: [id])

  // 时间戳
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  deletedAt       DateTime?

  @@index([userId])
  @@index([status])
  @@index([consultTime])
  @@index([clientPhone])
  @@map("consultations")
}

enum ConsultationType {
  PHONE      // 电话咨询
  VISIT      // 来访咨询
  ONLINE     // 在线咨询
  REFERRAL   // 转介绍
}

enum ConsultStatus {
  PENDING     // 待跟进
  FOLLOWING   // 跟进中
  CONVERTED   // 已转化（成为案件）
  CLOSED      // 已关闭（未成案）
  ARCHIVED    // 已归档
}
```

**⚠️ 技术提示**:
- 执行 `npx prisma migrate dev --name add_consultation_model` 创建迁移
- consultNumber 需要在服务层生成，格式: `ZX + 日期 + 序号`

---

#### 任务 1.1.2：创建案件类型配置模型 (CaseTypeConfig)

**文件**: `prisma/schema.prisma`

```prisma
// 案件类型配置（用于费用估算、材料清单等）
model CaseTypeConfig {
  id              String   @id @default(cuid())

  code            String   @unique  // 类型代码，如: LABOR_DISPUTE
  name            String             // 类型名称，如: 劳动争议
  category        String             // 大类：民事/刑事/行政/非诉

  // 收费配置
  baseFee         Decimal            // 基础收费
  riskFeeRate     Float?             // 风险代理比例
  hourlyRate      Decimal?           // 计时收费标准

  // 材料清单模板
  requiredDocs    Json               // 必要材料清单
  optionalDocs    Json?              // 可选材料清单

  // 案件特征
  avgDuration     Int?               // 平均办案周期（天）
  complexityLevel Int     @default(2) // 复杂度 1-5

  // 状态
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([category])
  @@index([isActive])
  @@map("case_type_configs")
}
```

---

### 1.2 咨询管理页面

#### 任务 1.2.1：创建咨询列表页面

**文件**: `src/app/consultations/page.tsx`

**功能要求**:
- [ ] 咨询列表展示（表格形式）
- [ ] 状态筛选（待跟进/跟进中/已转化/已关闭）
- [ ] 日期范围筛选
- [ ] 关键词搜索（姓名/电话/案情）
- [ ] 分页功能
- [ ] 快捷操作按钮（查看/编辑/转化为案件）

**列表字段**:
```
咨询编号 | 咨询人 | 联系方式 | 案件类型 | 咨询时间 | 状态 | 跟进日期 | 操作
```

---

#### 任务 1.2.2：创建新增咨询页面

**文件**: `src/app/consultations/new/page.tsx`

**表单字段**:
```
基本信息区域：
├── 咨询方式（单选）: 来电 / 来访 / 在线 / 转介绍
├── 咨询时间（日期时间选择器，默认当前时间）
├── 咨询人姓名（必填）
├── 联系电话（必填，格式校验）
├── 邮箱（选填，格式校验）
└── 单位名称（选填）

案情信息区域：
├── 案件类型（下拉选择，从CaseTypeConfig获取）
├── 案情摘要（必填，多行文本，500字以内）
├── 客户诉求（选填，多行文本）
└── 初步判断（选填，律师初步意见）

跟进设置：
├── 下次跟进日期（日期选择器）
└── 跟进备注（选填）
```

---

#### 任务 1.2.3：创建咨询详情页面

**文件**: `src/app/consultations/[id]/page.tsx`

**页面布局**:
```
┌─────────────────────────────────────────────────────────────┐
│ 咨询详情 - ZX20260128001                    [编辑] [转为案件] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────┐  ┌─────────────────────────────────┐│
│ │ 基本信息             │  │ AI案件评估                       ││
│ │ ─────────────────── │  │ ─────────────────────────────── ││
│ │ 咨询人：张三         │  │ 胜诉率评估：75%   ████████░░     ││
│ │ 电话：138xxxx1234   │  │ 案件难度：中等                    ││
│ │ 咨询时间：2026-01-28│  │ 风险等级：低                      ││
│ │ 咨询方式：来访       │  │ 建议收费：¥15,000 - ¥25,000     ││
│ │ 案件类型：劳动争议   │  │                                  ││
│ └─────────────────────┘  │ [重新评估]                       ││
│                          └─────────────────────────────────┘│
│ ┌───────────────────────────────────────────────────────────┐│
│ │ 案情摘要                                                   ││
│ │ ─────────────────────────────────────────────────────────  ││
│ │ 当事人于2025年3月入职某科技公司，担任产品经理一职...       ││
│ └───────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌───────────────────────────────────────────────────────────┐│
│ │ 跟进记录                                         [添加记录] ││
│ │ ─────────────────────────────────────────────────────────  ││
│ │ 2026-01-28 14:00  首次咨询，客户表示需考虑...              ││
│ │ 2026-01-29 10:00  电话跟进，客户同意委托...                ││
│ └───────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

#### 任务 1.2.4：创建咨询编辑页面

**文件**: `src/app/consultations/[id]/edit/page.tsx`

**功能要求**:
- [ ] 加载现有咨询数据
- [ ] 表单编辑（字段同新增页面）
- [ ] 状态变更
- [ ] 保存/取消按钮
- [ ] 删除功能（软删除）

---

### 1.3 AI案件评估功能

#### 任务 1.3.1：创建案件评估服务

**文件**: `src/lib/consultation/case-assessment-service.ts`

```typescript
/**
 * 案件评估服务
 * 使用AI分析案情，评估胜诉率、难度、风险和建议收费
 */

export interface CaseAssessmentInput {
  caseType: string;
  caseSummary: string;
  clientDemand?: string;
}

export interface CaseAssessmentResult {
  // 胜诉率评估
  winRate: number;           // 0-1
  winRateReasoning: string;  // 评估理由

  // 案件难度
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  difficultyFactors: string[];  // 影响因素

  // 风险等级
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];     // 风险因素

  // 费用建议
  suggestedFeeMin: number;
  suggestedFeeMax: number;
  feeReasoning: string;

  // 关键法律点
  keyLegalPoints: Array<{
    point: string;
    relevantLaw: string;
  }>;

  // 类似案例参考（如果有案例库）
  similarCases?: Array<{
    caseName: string;
    result: string;
    similarity: number;
  }>;

  // 建议
  suggestions: string[];
}

export class CaseAssessmentService {
  /**
   * 执行案件评估
   */
  async assessCase(input: CaseAssessmentInput): Promise<CaseAssessmentResult>;

  /**
   * 获取评估提示词模板
   */
  private getAssessmentPrompt(input: CaseAssessmentInput): string;

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): CaseAssessmentResult;
}
```

**⚠️ 技术提示**:
- 使用现有的 AI 服务架构（参考 `src/lib/agent/`）
- 评估结果存储为 JSON 格式到 `aiAssessment` 字段
- 提示词需要精心设计，确保输出结构化

---

#### 任务 1.3.2：创建案件评估API

**文件**: `src/app/api/consultations/[id]/assess/route.ts`

```typescript
/**
 * POST /api/consultations/[id]/assess
 * 触发AI案件评估
 */
```

**请求体**: 无（使用咨询记录中的案情信息）

**响应体**:
```json
{
  "success": true,
  "data": {
    "winRate": 0.75,
    "difficulty": "MEDIUM",
    "riskLevel": "LOW",
    "suggestedFeeMin": 15000,
    "suggestedFeeMax": 25000,
    // ... 完整评估结果
  }
}
```

---

#### 任务 1.3.3：创建案件评估UI组件

**文件**: `src/components/consultation/CaseAssessmentCard.tsx`

**功能要求**:
- [ ] 展示评估结果（胜诉率进度条、难度/风险标签）
- [ ] 费用建议区间显示
- [ ] 关键法律点列表
- [ ] 类似案例展示（可展开）
- [ ] "重新评估"按钮
- [ ] 评估中加载状态（使用 AIThinkingIndicator）

---

### 1.4 费用计算器

#### 任务 1.4.1：创建律师费计算服务

**文件**: `src/lib/consultation/fee-calculator-service.ts`

```typescript
/**
 * 律师费计算服务
 * 根据案件类型、标的额、地区等计算律师费
 */

export interface FeeCalculationInput {
  caseType: string;           // 案件类型代码
  claimAmount?: number;       // 标的额（元）
  region?: string;            // 地区代码
  feeType: 'FIXED' | 'RISK' | 'HOURLY';  // 收费方式
  estimatedHours?: number;    // 预估工时（计时收费时）
}

export interface FeeCalculationResult {
  baseFee: number;            // 基础费用
  riskFee?: number;           // 风险代理费用
  totalFeeMin: number;        // 总费用下限
  totalFeeMax: number;        // 总费用上限
  breakdown: Array<{
    item: string;
    amount: number;
    note?: string;
  }>;
  referenceStandard: string;  // 参考收费标准
}
```

**⚠️ 技术提示**:
- 收费标准参考各地律协指导价
- 需要预置常见案件类型的收费配置
- 标的额阶梯收费需要特殊处理

---

#### 任务 1.4.2：创建费用计算器组件

**文件**: `src/components/consultation/FeeCalculator.tsx`

**UI设计**:
```
┌────────────────────────────────────────────────────┐
│ 律师费估算器                                        │
├────────────────────────────────────────────────────┤
│ 案件类型：[劳动争议 ▼]                              │
│ 标的金额：[         ] 元                           │
│ 收费方式：○ 固定收费  ○ 风险代理  ○ 计时收费       │
│                                                    │
│ ─────────────────────────────────────────────────  │
│ 费用明细：                                          │
│   基础代理费    ¥10,000                            │
│   差旅费预估    ¥2,000                             │
│   ─────────────────────                            │
│   预估总费用    ¥10,000 - ¥15,000                  │
│                                                    │
│ 参考标准：北京市律师服务收费指导价                   │
└────────────────────────────────────────────────────┘
```

---

### 1.5 咨询跟进功能

#### 任务 1.5.1：创建跟进记录模型

**文件**: `prisma/schema.prisma`

```prisma
// 咨询跟进记录
model ConsultationFollowUp {
  id              String   @id @default(cuid())
  consultationId  String
  consultation    Consultation @relation(fields: [consultationId], references: [id], onDelete: Cascade)

  followUpTime    DateTime           // 跟进时间
  followUpType    String             // 跟进方式：电话/微信/邮件/面谈
  content         String             // 跟进内容
  result          String?            // 跟进结果
  nextFollowUp    DateTime?          // 下次跟进时间

  createdBy       String             // 记录人
  createdAt       DateTime @default(now())

  @@index([consultationId])
  @@map("consultation_follow_ups")
}
```

---

#### 任务 1.5.2：创建跟进记录列表组件

**文件**: `src/components/consultation/FollowUpList.tsx`

**功能要求**:
- [ ] 时间线展示跟进记录
- [ ] 添加跟进记录弹窗
- [ ] 跟进提醒标识（如果到期未跟进）

---

### 1.6 咨询转案件功能

#### 任务 1.6.1：创建咨询转案件服务

**文件**: `src/lib/consultation/convert-to-case-service.ts`

```typescript
/**
 * 咨询转案件服务
 * 将咨询记录转化为正式案件
 */

export interface ConvertToCaseInput {
  consultationId: string;
  caseTitle?: string;        // 案件名称，可自动生成
  additionalInfo?: {
    opposingParty?: string;  // 对方当事人
    courtLevel?: string;     // 管辖法院级别
  };
}

export interface ConvertToCaseResult {
  caseId: string;
  caseNumber: string;
}
```

**⚠️ 技术提示**:
- 转化时自动复制咨询中的案情信息
- 更新咨询状态为 CONVERTED
- 记录关联关系

---

#### 任务 1.6.2：创建转案件弹窗组件

**文件**: `src/components/consultation/ConvertToCaseModal.tsx`

**弹窗内容**:
```
┌────────────────────────────────────────────────────┐
│ 将咨询转为案件                                [×]  │
├────────────────────────────────────────────────────┤
│ 咨询信息：ZX20260128001 - 张三劳动争议咨询          │
│                                                    │
│ 案件名称：[张三与XX公司劳动合同纠纷案        ]     │
│ 对方当事人：[                              ]       │
│ 管辖法院：[北京市朝阳区人民法院 ▼]                 │
│                                                    │
│ ☑ 同时创建委托合同草稿                            │
│                                                    │
│                          [取消]  [确认转为案件]    │
└────────────────────────────────────────────────────┘
```

---

### 1.7 API接口列表

#### 任务 1.7.1 - 1.7.8：创建咨询相关API

| 任务 | API路径 | 方法 | 描述 |
|------|---------|------|------|
| 1.7.1 | `/api/consultations` | GET | 获取咨询列表 |
| 1.7.2 | `/api/consultations` | POST | 创建咨询 |
| 1.7.3 | `/api/consultations/[id]` | GET | 获取咨询详情 |
| 1.7.4 | `/api/consultations/[id]` | PUT | 更新咨询 |
| 1.7.5 | `/api/consultations/[id]` | DELETE | 删除咨询 |
| 1.7.6 | `/api/consultations/[id]/assess` | POST | AI评估 |
| 1.7.7 | `/api/consultations/[id]/follow-ups` | GET/POST | 跟进记录 |
| 1.7.8 | `/api/consultations/[id]/convert` | POST | 转为案件 |

---

## 模块二：签约立案

### 2.1 数据模型设计

#### 任务 2.1.1：创建委托合同模型 (Contract)

**文件**: `prisma/schema.prisma`

```prisma
// 委托合同
model Contract {
  id              String   @id @default(cuid())

  contractNumber  String   @unique  // 合同编号

  // 关联
  caseId          String?            // 关联案件
  case            Case?    @relation(fields: [caseId], references: [id])
  consultationId  String?            // 来源咨询

  // 委托方信息
  clientType      String             // 委托人类型：个人/企业
  clientName      String             // 委托人姓名/名称
  clientIdNumber  String?            // 身份证号/统一社会信用代码
  clientAddress   String?            // 地址
  clientContact   String?            // 联系方式

  // 受托方信息（律所/律师）
  lawFirmName     String             // 律所名称
  lawyerName      String             // 承办律师
  lawyerId        String             // 律师ID

  // 委托事项
  caseType        String             // 案件类型
  caseSummary     String             // 案情简述
  scope           String             // 委托范围

  // 收费信息
  feeType         FeeType            // 收费方式
  totalFee        Decimal            // 总费用
  paidAmount      Decimal  @default(0) // 已付金额
  feeDetails      Json?              // 费用明细

  // 合同条款
  terms           Json?              // 合同条款（JSON格式存储）
  specialTerms    String?            // 特别约定

  // 签署信息
  status          ContractStatus     @default(DRAFT)
  signedAt        DateTime?          // 签署时间
  signatureData   Json?              // 签名数据

  // 文件
  filePath        String?            // 合同文件路径

  // 时间戳
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // 关联
  payments        ContractPayment[]

  @@index([caseId])
  @@index([clientName])
  @@index([status])
  @@map("contracts")
}

enum FeeType {
  FIXED     // 固定收费
  RISK      // 风险代理
  HOURLY    // 计时收费
  MIXED     // 混合收费
}

enum ContractStatus {
  DRAFT       // 草稿
  PENDING     // 待签署
  SIGNED      // 已签署
  EXECUTING   // 履行中
  COMPLETED   // 已完成
  TERMINATED  // 已终止
}
```

---

#### 任务 2.1.2：创建合同付款记录模型

**文件**: `prisma/schema.prisma`

```prisma
// 合同付款记录
model ContractPayment {
  id              String   @id @default(cuid())
  contractId      String
  contract        Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)

  paymentNumber   String   @unique  // 付款编号
  amount          Decimal            // 付款金额
  paymentType     String             // 付款类型：首付款/中期款/尾款
  paymentMethod   String?            // 付款方式：转账/现金/微信/支付宝

  status          PaymentStatus      @default(PENDING)
  paidAt          DateTime?          // 实际付款时间

  receiptNumber   String?            // 收据编号
  invoiceId       String?            // 关联发票ID

  note            String?            // 备注

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([contractId])
  @@map("contract_payments")
}

enum PaymentStatus {
  PENDING   // 待付款
  PAID      // 已付款
  OVERDUE   // 已逾期
  CANCELLED // 已取消
}
```

---

### 2.2 合同管理页面

#### 任务 2.2.1：创建合同列表页面

**文件**: `src/app/contracts/page.tsx`

**功能要求**:
- [ ] 合同列表展示
- [ ] 状态筛选（草稿/待签署/已签署/履行中）
- [ ] 按客户名称/合同编号搜索
- [ ] 付款状态标识（全额/部分/未付）
- [ ] 快捷操作（查看/编辑/下载/发送）

---

#### 任务 2.2.2：创建合同创建/编辑页面

**文件**: `src/app/contracts/new/page.tsx`
**文件**: `src/app/contracts/[id]/edit/page.tsx`

**表单分区**:
```
┌─ 委托方信息 ─────────────────────────────────────────┐
│ 委托人类型：○ 个人  ○ 企业                           │
│ 姓名/名称：[                    ]                    │
│ 证件号码：[                    ]                     │
│ 联系电话：[                    ]                     │
│ 地址：[                                        ]     │
└─────────────────────────────────────────────────────┘

┌─ 委托事项 ─────────────────────────────────────────┐
│ 案件类型：[劳动争议 ▼]                              │
│ 案情简述：[                                   ]     │
│ 委托范围：☑ 代理一审  ☐ 代理二审  ☐ 代理执行       │
└─────────────────────────────────────────────────────┘

┌─ 收费约定 ─────────────────────────────────────────┐
│ 收费方式：○ 固定收费  ○ 风险代理  ○ 计时收费        │
│ 律师费总额：[           ] 元                        │
│ 付款方式：                                          │
│   第一期 [50]% = ¥[     ] 于 [签约时] 支付          │
│   第二期 [50]% = ¥[     ] 于 [结案时] 支付          │
│   [+ 添加付款期]                                    │
└─────────────────────────────────────────────────────┘

┌─ 特别约定 ─────────────────────────────────────────┐
│ [                                                 ] │
│ [                                                 ] │
└─────────────────────────────────────────────────────┘
```

---

#### 任务 2.2.3：创建合同详情页面

**文件**: `src/app/contracts/[id]/page.tsx`

**页面功能**:
- [ ] 合同基本信息展示
- [ ] 付款记录列表
- [ ] 付款进度条
- [ ] 添加付款记录
- [ ] 生成/下载合同PDF
- [ ] 发送合同给客户（邮件）

---

### 2.3 合同模板功能

#### 任务 2.3.1：创建合同模板模型

**文件**: `prisma/schema.prisma`

```prisma
// 合同模板
model ContractTemplate {
  id              String   @id @default(cuid())

  name            String             // 模板名称
  code            String   @unique   // 模板代码
  category        String             // 分类：委托代理/法律顾问/专项服务

  content         String             // 模板内容（支持变量占位符）
  variables       Json               // 变量列表定义

  isDefault       Boolean  @default(false)
  isActive        Boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("contract_templates")
}
```

**⚠️ 技术提示**:
- 模板使用 `{{变量名}}` 格式的占位符
- 变量定义示例：`[{name: "clientName", label: "委托人姓名", type: "text"}]`
- 生成合同时替换变量

---

#### 任务 2.3.2：创建合同模板编辑器组件

**文件**: `src/components/contract/ContractTemplateEditor.tsx`

**功能要求**:
- [ ] 富文本编辑器
- [ ] 变量插入功能
- [ ] 模板预览
- [ ] 保存模板

---

### 2.4 合同PDF生成

#### 任务 2.4.1：创建合同PDF生成服务

**文件**: `src/lib/contract/contract-pdf-generator.ts`

**⚠️ 技术提示**:
- 参考现有的 `src/lib/invoice/generate-pdf.ts` 实现
- 使用 pdfkit 库
- 需要加载中文字体

---

### 2.5 立案材料清单

#### 任务 2.5.1：创建立案材料服务

**文件**: `src/lib/case/filing-materials-service.ts`

```typescript
/**
 * 立案材料服务
 * 根据案件类型生成所需材料清单
 */

export interface FilingMaterial {
  id: string;
  name: string;                // 材料名称
  description: string;         // 材料说明
  required: boolean;           // 是否必须
  copies: number;              // 需要份数
  templateUrl?: string;        // 模板下载链接
  status?: 'pending' | 'ready' | 'submitted';  // 准备状态
}

export interface FilingMaterialsResult {
  caseType: string;
  courtLevel: string;
  materials: FilingMaterial[];
  notes: string[];             // 注意事项
}
```

---

#### 任务 2.5.2：创建立案材料清单组件

**文件**: `src/components/case/FilingMaterialsList.tsx`

**UI设计**:
```
┌────────────────────────────────────────────────────┐
│ 立案材料清单 - 劳动争议案件                          │
├────────────────────────────────────────────────────┤
│ 必备材料：                                          │
│ ☑ 起诉状（正本1份，副本2份）           [下载模板]   │
│ ☐ 身份证复印件（1份）                              │
│ ☐ 劳动合同复印件（1份）                            │
│ ☐ 工资流水/工资条（近12个月）                      │
│ ☐ 社保缴纳证明                                     │
│                                                    │
│ 可选材料（增强证明力）：                            │
│ ☐ 考勤记录                                         │
│ ☐ 加班审批单                                       │
│                                                    │
│ 准备进度：3/5 ████████░░░░░░ 60%                   │
└────────────────────────────────────────────────────┘
```

---

### 2.6 API接口列表

#### 任务 2.6.1 - 2.6.8：创建合同相关API

| 任务 | API路径 | 方法 | 描述 |
|------|---------|------|------|
| 2.6.1 | `/api/contracts` | GET | 获取合同列表 |
| 2.6.2 | `/api/contracts` | POST | 创建合同 |
| 2.6.3 | `/api/contracts/[id]` | GET | 获取合同详情 |
| 2.6.4 | `/api/contracts/[id]` | PUT | 更新合同 |
| 2.6.5 | `/api/contracts/[id]/pdf` | GET | 生成/下载PDF |
| 2.6.6 | `/api/contracts/[id]/payments` | GET/POST | 付款记录 |
| 2.6.7 | `/api/contract-templates` | GET/POST | 合同模板 |
| 2.6.8 | `/api/filing-materials` | GET | 立案材料清单 |

---

## 模块三：证据收集增强

### 3.1 证据链分析

#### 任务 3.1.1：创建证据链分析服务

**文件**: `src/lib/evidence/evidence-chain-service.ts`

```typescript
/**
 * 证据链分析服务
 * 使用AI分析证据之间的关联性，构建完整证据链
 */

export interface EvidenceChainAnalysisInput {
  caseId: string;
  evidenceIds: string[];      // 待分析的证据ID列表
  targetFact: string;         // 待证明的事实
}

export interface EvidenceChainResult {
  // 证据链结构
  chain: Array<{
    evidenceId: string;
    evidenceName: string;
    role: string;             // 在证据链中的作用
    proves: string;           // 证明什么
    strength: 'strong' | 'medium' | 'weak';
  }>;

  // 关联分析
  connections: Array<{
    from: string;             // 证据A ID
    to: string;               // 证据B ID
    relationship: string;     // 关联关系描述
  }>;

  // 证据链完整性
  completeness: number;       // 0-100
  gaps: string[];             // 证据链缺口

  // 建议
  suggestions: string[];
}
```

---

#### 任务 3.1.2：创建证据链可视化组件

**文件**: `src/components/evidence/EvidenceChainViewer.tsx`

**⚠️ 技术提示**:
- 可使用 react-flow 或 vis-network 库实现图形化展示
- 支持拖拽调整布局
- 点击节点显示证据详情

---

### 3.2 证据质证预判

#### 任务 3.2.1：创建质证预判服务

**文件**: `src/lib/evidence/cross-examination-service.ts`

```typescript
/**
 * 证据质证预判服务
 * AI预判对方可能的质证意见，帮助准备应对
 */

export interface CrossExaminationInput {
  evidenceId: string;
  evidenceType: string;
  evidenceContent: string;
  ourPosition: 'plaintiff' | 'defendant';
}

export interface CrossExaminationResult {
  // 对方可能的质证意见
  possibleChallenges: Array<{
    type: string;           // 质证类型：真实性/合法性/关联性
    content: string;        // 质证内容
    likelihood: number;     // 可能性 0-100
  }>;

  // 应对建议
  responses: Array<{
    challenge: string;      // 针对的质证意见
    response: string;       // 应对方案
    supportingEvidence?: string;  // 补充证据建议
  }>;

  // 总体风险评估
  overallRisk: 'low' | 'medium' | 'high';
  riskNote: string;
}
```

---

#### 任务 3.2.2：创建质证预判卡片组件

**文件**: `src/components/evidence/CrossExaminationCard.tsx`

**UI设计**:
```
┌────────────────────────────────────────────────────┐
│ 质证风险预判 - 劳动合同复印件                        │
├────────────────────────────────────────────────────┤
│ 风险等级：🟡 中等风险                               │
│                                                    │
│ 对方可能的质证意见：                                │
│ ┌────────────────────────────────────────────────┐ │
│ │ 1. 真实性质疑（可能性：70%）                    │ │
│ │    "复印件无法核实原件真实性"                   │ │
│ │    ─────────────────────────────────────────── │ │
│ │    应对：提供原件或申请法院调取人社局备案合同   │ │
│ └────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────┐ │
│ │ 2. 关联性质疑（可能性：30%）                    │ │
│ │    "合同签订时间与争议事项无关联"               │ │
│ │    ─────────────────────────────────────────── │ │
│ │    应对：结合工资条说明持续劳动关系             │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

### 3.3 证据分类模板

#### 任务 3.3.1：创建证据分类配置

**文件**: `src/lib/evidence/evidence-category-config.ts`

```typescript
/**
 * 证据分类配置
 * 按案件类型提供标准证据分类模板
 */

export interface EvidenceCategory {
  code: string;
  name: string;
  description: string;
  subCategories?: EvidenceCategory[];
  examples?: string[];
}

export const EVIDENCE_CATEGORIES: Record<string, EvidenceCategory[]> = {
  // 劳动争议案件
  LABOR_DISPUTE: [
    {
      code: 'IDENTITY',
      name: '主体资格证据',
      description: '证明劳动关系主体身份',
      subCategories: [
        { code: 'ID_CARD', name: '身份证明', description: '劳动者身份证复印件' },
        { code: 'COMPANY_LICENSE', name: '企业证照', description: '营业执照等' },
      ]
    },
    {
      code: 'LABOR_RELATION',
      name: '劳动关系证据',
      description: '证明存在劳动关系',
      subCategories: [
        { code: 'CONTRACT', name: '劳动合同', description: '书面劳动合同' },
        { code: 'SOCIAL_SECURITY', name: '社保记录', description: '社保缴纳证明' },
        { code: 'SALARY_PROOF', name: '工资凭证', description: '工资条、银行流水' },
      ]
    },
    // ... 更多分类
  ],

  // 合同纠纷案件
  CONTRACT_DISPUTE: [
    // ...
  ],

  // 更多案件类型...
};
```

---

#### 任务 3.3.2：创建证据分类面板组件

**文件**: `src/components/evidence/EvidenceCategoryPanel.tsx`

**功能要求**:
- [ ] 按案件类型展示证据分类树
- [ ] 拖拽证据到分类
- [ ] 批量分类操作
- [ ] 分类完成度统计

---

### 3.4 API接口列表

| 任务 | API路径 | 方法 | 描述 |
|------|---------|------|------|
| 3.4.1 | `/api/evidence/chain-analysis` | POST | 证据链分析 |
| 3.4.2 | `/api/evidence/[id]/cross-examination` | POST | 质证预判 |
| 3.4.3 | `/api/evidence/categories` | GET | 获取证据分类配置 |

---

## 数据库设计

### 完整数据模型关系图

```
┌─────────────────┐     ┌─────────────────┐
│  Consultation   │────▶│     Case        │
│  (咨询记录)      │     │   (案件)        │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│FollowUp         │     │   Contract      │
│(跟进记录)        │     │  (委托合同)     │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ContractPayment  │
                        │  (付款记录)      │
                        └─────────────────┘
```

### 迁移执行顺序

1. `npx prisma migrate dev --name add_consultation_models`
2. `npx prisma migrate dev --name add_contract_models`
3. `npx prisma migrate dev --name add_evidence_enhancements`
4. `npx prisma generate`

---

## API设计

### API命名规范

```
GET    /api/{resource}           - 列表
POST   /api/{resource}           - 创建
GET    /api/{resource}/[id]      - 详情
PUT    /api/{resource}/[id]      - 更新
DELETE /api/{resource}/[id]      - 删除
POST   /api/{resource}/[id]/{action} - 特定操作
```

### 通用响应格式

```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}

// 列表响应
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 技术注意事项

### 1. 数据库设计注意事项

| 注意点 | 说明 |
|--------|------|
| 软删除 | 所有业务表使用 `deletedAt` 字段实现软删除 |
| 索引 | 为常用查询字段添加索引，特别是外键和状态字段 |
| JSON字段 | 复杂数据（如AI评估结果、合同条款）使用JSON存储 |
| Decimal | 金额字段使用 `Decimal` 类型，避免浮点精度问题 |

### 2. AI服务调用注意事项

| 注意点 | 说明 |
|--------|------|
| 限流 | 使用现有的配额系统控制AI调用 |
| 缓存 | 相同输入的评估结果可缓存24小时 |
| 降级 | AI服务不可用时提供基本功能降级方案 |
| 提示词 | 评估类提示词需要输出结构化JSON |

### 3. 页面开发注意事项

| 注意点 | 说明 |
|--------|------|
| 路由 | 使用 Next.js App Router 约定 |
| 表单 | 使用 react-hook-form + zod 验证 |
| 状态 | 列表页使用 SWR 或 React Query |
| 加载 | 使用已有的 loading.tsx 骨架屏 |
| 错误 | 使用新增的 UserFriendlyError 组件 |

### 4. 关键依赖库

```json
{
  "需要新增的依赖": {
    "react-flow": "用于证据链可视化（如使用）",
    "@tanstack/react-query": "数据获取（如未安装）"
  },
  "已有可复用的依赖": {
    "pdfkit": "PDF生成",
    "zod": "数据验证",
    "prisma": "ORM",
    "@prisma/client": "数据库客户端"
  }
}
```

### 5. 导航菜单更新

需要更新侧边栏导航，添加新模块入口：

**文件**: `src/components/layout/Sidebar.tsx` 或相应导航组件

```typescript
// 新增菜单项
{
  label: '接案咨询',
  href: '/consultations',
  icon: PhoneIcon,
},
{
  label: '委托合同',
  href: '/contracts',
  icon: DocumentTextIcon,
},
```

---

## 实施检查清单

### 模块一：接案咨询 (25项)

- [ ] 1.1.1 创建 Consultation 模型
- [ ] 1.1.2 创建 CaseTypeConfig 模型
- [ ] 1.2.1 咨询列表页面
- [ ] 1.2.2 新增咨询页面
- [ ] 1.2.3 咨询详情页面
- [ ] 1.2.4 咨询编辑页面
- [ ] 1.3.1 案件评估服务
- [ ] 1.3.2 案件评估API
- [ ] 1.3.3 案件评估UI组件
- [ ] 1.4.1 费用计算服务
- [ ] 1.4.2 费用计算器组件
- [ ] 1.5.1 跟进记录模型
- [ ] 1.5.2 跟进记录组件
- [ ] 1.6.1 转案件服务
- [ ] 1.6.2 转案件弹窗
- [ ] 1.7.1 GET /api/consultations
- [ ] 1.7.2 POST /api/consultations
- [ ] 1.7.3 GET /api/consultations/[id]
- [ ] 1.7.4 PUT /api/consultations/[id]
- [ ] 1.7.5 DELETE /api/consultations/[id]
- [ ] 1.7.6 POST /api/consultations/[id]/assess
- [ ] 1.7.7 跟进记录API
- [ ] 1.7.8 POST /api/consultations/[id]/convert
- [ ] 导航菜单更新
- [ ] 种子数据（案件类型配置）

### 模块二：签约立案 (20项)

- [ ] 2.1.1 创建 Contract 模型
- [ ] 2.1.2 创建 ContractPayment 模型
- [ ] 2.2.1 合同列表页面
- [ ] 2.2.2 合同创建/编辑页面
- [ ] 2.2.3 合同详情页面
- [ ] 2.3.1 合同模板模型
- [ ] 2.3.2 合同模板编辑器
- [ ] 2.4.1 合同PDF生成服务
- [ ] 2.5.1 立案材料服务
- [ ] 2.5.2 立案材料清单组件
- [ ] 2.6.1 GET /api/contracts
- [ ] 2.6.2 POST /api/contracts
- [ ] 2.6.3 GET /api/contracts/[id]
- [ ] 2.6.4 PUT /api/contracts/[id]
- [ ] 2.6.5 GET /api/contracts/[id]/pdf
- [ ] 2.6.6 付款记录API
- [ ] 2.6.7 合同模板API
- [ ] 2.6.8 GET /api/filing-materials
- [ ] 导航菜单更新
- [ ] 种子数据（合同模板、立案材料配置）

### 模块三：证据增强 (12项)

- [ ] 3.1.1 证据链分析服务
- [ ] 3.1.2 证据链可视化组件
- [ ] 3.2.1 质证预判服务
- [ ] 3.2.2 质证预判卡片组件
- [ ] 3.3.1 证据分类配置
- [ ] 3.3.2 证据分类面板组件
- [ ] 3.4.1 POST /api/evidence/chain-analysis
- [ ] 3.4.2 POST /api/evidence/[id]/cross-examination
- [ ] 3.4.3 GET /api/evidence/categories
- [ ] 与现有证据页面集成
- [ ] 种子数据（证据分类配置）
- [ ] 功能测试

---

## 附录

### A. 案件类型预置数据

```typescript
const CASE_TYPES = [
  // 民事
  { code: 'LABOR_DISPUTE', name: '劳动争议', category: '民事' },
  { code: 'CONTRACT_DISPUTE', name: '合同纠纷', category: '民事' },
  { code: 'TORT_LIABILITY', name: '侵权责任', category: '民事' },
  { code: 'MARRIAGE_FAMILY', name: '婚姻家庭', category: '民事' },
  { code: 'INHERITANCE', name: '继承纠纷', category: '民事' },
  { code: 'PROPERTY_DISPUTE', name: '物权纠纷', category: '民事' },

  // 商事
  { code: 'COMPANY_DISPUTE', name: '公司纠纷', category: '商事' },
  { code: 'SECURITIES', name: '证券纠纷', category: '商事' },
  { code: 'INSURANCE', name: '保险纠纷', category: '商事' },

  // 刑事
  { code: 'CRIMINAL_DEFENSE', name: '刑事辩护', category: '刑事' },
  { code: 'CRIMINAL_AGENT', name: '刑事代理', category: '刑事' },

  // 行政
  { code: 'ADMINISTRATIVE_RECONSIDERATION', name: '行政复议', category: '行政' },
  { code: 'ADMINISTRATIVE_LITIGATION', name: '行政诉讼', category: '行政' },

  // 非诉
  { code: 'LEGAL_COUNSEL', name: '常年法律顾问', category: '非诉' },
  { code: 'DUE_DILIGENCE', name: '尽职调查', category: '非诉' },
  { code: 'CONTRACT_REVIEW', name: '合同审查', category: '非诉' },
];
```

### B. 合同模板变量定义

```typescript
const CONTRACT_VARIABLES = [
  { name: 'clientName', label: '委托人姓名', type: 'text', required: true },
  { name: 'clientIdNumber', label: '身份证号', type: 'text', required: true },
  { name: 'clientAddress', label: '联系地址', type: 'text', required: false },
  { name: 'clientPhone', label: '联系电话', type: 'text', required: true },
  { name: 'caseType', label: '案件类型', type: 'select', required: true },
  { name: 'caseSummary', label: '案情简述', type: 'textarea', required: true },
  { name: 'scope', label: '委托范围', type: 'checkbox', required: true },
  { name: 'totalFee', label: '律师费总额', type: 'number', required: true },
  { name: 'feePaymentTerms', label: '付款方式', type: 'textarea', required: true },
  { name: 'lawFirmName', label: '律所名称', type: 'text', required: true },
  { name: 'lawyerName', label: '承办律师', type: 'text', required: true },
  { name: 'signDate', label: '签约日期', type: 'date', required: true },
];
```

---

**文档结束**

> 本文档为实施蓝图，开发时请按任务编号逐项完成，并在检查清单中标记进度。
