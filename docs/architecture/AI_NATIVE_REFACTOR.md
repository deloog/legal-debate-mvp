# AI 原生架构重构设计文档

> **状态**：设计阶段（未实施）- 经三方四轮审查，**可进入 Phase 0 实施**  
> **创建日期**：2026-05-17  
> **最后修订**：2026-05-17（第四轮：EXECUTING 恢复机制、业务资源级幂等、userId 权限锁、reminder 复用、ChatMessage 类型）  
> **参与讨论**：产品负责人 + Claude + GPT（三方评审，四轮）  
> **关联文档**：[CHAT_AI_CONTEXT_ARCHITECTURE.md](../CHAT_AI_CONTEXT_ARCHITECTURE.md)、[CHAT_INTERFACE_REDESIGN.md](../CHAT_INTERFACE_REDESIGN.md)

---

## 一、问题定义：为什么需要重构

### 当前架构的本质问题

当前产品是一个**模块优先的传统 SaaS 平台**，Chat 只是其中一个功能入口：

```
律师 → 导航菜单 → 案件/合同/客户页面 → 填表操作 → 数据变更
                                              ↑
                                         AI 是边缘附加功能
```

律师仍然需要主动"去"各个模块页面完成操作，AI 只在被问到时才回答，不能主动驱动业务流转。

### 第一性原理下的正确模式

律师的核心价值在于**思考和判断**。案件建档、文书整理、客户跟进、日程管理——这些"信息搬运"工作理应由 AI 代劳。

**对话是操作系统，不是一个功能。** 律师描述工作，系统在后台完成数据沉淀。

---

## 二、目标架构：五层模型

```
┌─────────────────────────────────────────────────────────┐
│                    律师对话 / 文件上传                    │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│              法律工作流理解层 (Legal Understanding)        │
│  · 实体识别（当事人、案件类型、时间、诉求）                │
│  · 消歧义（"张伟"是客户、对方、还是证人？）               │
│  · 工作流分类（新案 / 续案 / 补充材料 / 日程 / 文书…）    │
│  · 关联现有数据（匹配库中已有客户/案件）                  │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│           提案卡片层 (Proposal Card Layer)                │
│  · 生成可确认的结构化"工作提案"（AgentProposal）         │
│  · 律师可：全部确认 / 部分勾选 / 内联修改字段 / 拒绝     │
│  · 不可逆操作必须经过此层，不允许直接写入业务数据         │
└────────────────────────┬────────────────────────────────┘
                         ↓（律师点击"确认执行"后）
┌─────────────────────────────────────────────────────────┐
│           系统工具调用层 (Action Dispatcher)              │
│  · 按 sequence 顺序执行各 ProposalAction                 │
│  · 直接调用 src/lib/*/service.ts（不走 HTTP route）      │
│  · 前序动作的 result.resourceId 自动注入后序 params      │
│  · 幂等执行，支持失败重试，写入 ProposalAction 审计       │
└────────────────────────┬────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│                    数据沉淀层                             │
│     案件 | 客户 | 文书 | 日程 | 时间线 | 审计             │
│                         ↓                               │
│           各模块页面（复核 + 编辑 + 归档面板）            │
│           不再是主操作入口，而是 AI 工作成果的查阅界面     │
└─────────────────────────────────────────────────────────┘
```

### 模块页面的角色转变

| 现在                              | 转变后                            |
| --------------------------------- | --------------------------------- |
| 案件/客户/合同页面 = 主要操作入口 | 复核面板：查看、补充细节、归档    |
| 律师主动填表触发数据变更          | AI 提案 → 律师确认 → 系统自动写入 |
| AI 是辅助问答                     | AI 是工作流驱动者                 |

> **重要边界**：页面不废弃。对话负责"生成和推动"，页面负责"复核、编辑、沉淀、归档"。两者分工，不是替代。

---

## 三、核心数据模型

### 设计原则

`AgentProposal` 是一个**可确认、可审计、可执行的业务对象**，不是消息的附属字段。

它的生命周期独立于 `Message`：消息是展示入口，Proposal 管理全部业务状态（确认 → 执行 → 审计 → 撤销）。

### Schema 完整变更（prisma/schema.prisma）

#### 1. 新增枚举

```prisma
enum ProposalStatus {
  PENDING              // 等待律师确认
  EXECUTING            // 系统执行中
  COMPLETED            // 全部动作完成
  PARTIALLY_COMPLETED  // 部分动作完成（其余失败或跳过）
  FAILED               // 执行失败
  REJECTED             // 律师拒绝
  REVERTED             // 已执行补偿式撤销
}

enum ProposalActionStatus {
  PENDING    // 待执行（律师已勾选）
  SKIPPED    // 律师取消勾选
  EXECUTING  // 执行中
  COMPLETED  // 成功
  FAILED     // 失败
}

enum RevertStatus {
  NOT_APPLICABLE  // 该动作不支持撤销（如审计日志）
  PENDING         // 待撤销
  COMPLETED       // 撤销成功
  FAILED          // 撤销失败
}
```

#### 2. Message 模型（仅新增两个字段）

```prisma
model Message {
  id             String    @id @default(cuid())
  conversationId String
  role           String
  content        String    @db.Text    // 始终填充，用于搜索/导出/打印/上下文注入
  isDeleted      Boolean   @default(false)
  proposalId     String?   @unique     // 指向该 AI 消息对应的提案（仅 role=assistant 时有值）
  createdAt      DateTime  @default(now())

  conversation       Conversation        @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  attachments        MessageAttachment[]
  annotations        Annotation[]
  proposal           AgentProposal?      @relation("ProposalDisplayMessage", fields: [proposalId], references: [id])
  triggeredProposals AgentProposal[]     @relation("ProposalTriggerMessage") // 一条消息可触发多个提案

  @@index([conversationId])
  @@map("messages")
}
```

> **分叉对话行为**：分叉时复制 `Message` 记录但不复制关联的 `AgentProposal`，新分支的 `proposalId` 设为 `null`，从该点独立演进。

#### 3. AgentProposal 模型

```prisma
model AgentProposal {
  id             String         @id @default(cuid())
  conversationId String
  triggerMsgId   String?        // 触发该提案的用户消息（FK → Message）
  userId         String
  caseId         String?        // 关联已有案件（续案场景）
  confirmedById  String?        // 执行确认人（FK → User，支持团队场景）

  extractedData  Json           // AI 原始识别结果（不可变，用于回溯和模型优化）
  confirmedData  Json?          // 律师修改后的最终数据（null 表示采用 extractedData）

  status         ProposalStatus @default(PENDING)
  confirmedAt    DateTime?
  completedAt    DateTime?
  revertedAt     DateTime?
  revertReason   String?        // 撤销原因，审计用

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  // Relations
  conversation  Conversation    @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user          User            @relation("UserProposals", fields: [userId], references: [id])
  confirmedBy   User?           @relation("ConfirmedProposals", fields: [confirmedById], references: [id])
  triggerMsg    Message?        @relation("ProposalTriggerMessage", fields: [triggerMsgId], references: [id])
  case          Case?           @relation(fields: [caseId], references: [id], onDelete: SetNull)
  actions       ProposalAction[]
  displayMsg    Message?        @relation("ProposalDisplayMessage") // AI 消息反向关联

  @@index([conversationId])
  @@index([userId])
  @@index([caseId])
  @@index([status])
  @@index([createdAt])
  @@map("agent_proposals")
}
```

#### 4. ProposalAction 模型

```prisma
model ProposalAction {
  id               String               @id @default(cuid())
  proposalId       String
  sequence         Int                  // 执行顺序（0 最先）
  dependsOnId      String?              // 显式依赖（指向同 proposal 内前序 action id）
  actionType       String               // CREATE_CASE | CREATE_CLIENT | ADD_TIMELINE_EVENT | CREATE_REMINDER
  label            String               // 界面展示文本，如"创建客户档案（张伟）"
  params           Json                 // 动作参数（律师确认前可修改）
  selected         Boolean              @default(true)   // 律师是否勾选

  idempotencyKey   String               @unique          // 防止重复执行，格式：proposalId-actionType-sequence
  resourceType     String?              // 执行成功后创建的资源类型，如"Case"
  resourceId       String?              // 执行成功后创建的资源 id，供后续 action 注入

  status           ProposalActionStatus @default(PENDING)
  result           Json?                // 执行成功的完整结果
  error            String?              // 失败的错误信息
  retryCount       Int                  @default(0)

  // revertStatus 由 extractor.ts 按 actionType 在创建时显式设置，不依赖 schema default
  // CREATE_CASE / CREATE_CLIENT / ADD_TIMELINE / CREATE_REMINDER → PENDING
  // 审计日志 / 已发通知 / AI 消耗 → NOT_APPLICABLE
  revertStatus     RevertStatus         @default(NOT_APPLICABLE)
  revertedAt       DateTime?
  revertError      String?

  executedAt       DateTime?

  dependsOn  ProposalAction?  @relation("ActionDependency", fields: [dependsOnId], references: [id])
  dependents ProposalAction[] @relation("ActionDependency")
  proposal   AgentProposal    @relation(fields: [proposalId], references: [id], onDelete: Cascade)

  @@unique([proposalId, sequence])     // 同一提案内不允许重复 sequence
  @@index([proposalId])
  @@index([idempotencyKey])
  @@index([resourceType, resourceId])
  @@map("proposal_actions")
}
```

#### 5. 现有模型需补充的反向关联字段

以下字段加到现有模型中（不改已有字段，只追加）：

```prisma
// model User（在现有 relation 列表末尾追加）
proposals          AgentProposal[]  @relation("UserProposals")
confirmedProposals AgentProposal[]  @relation("ConfirmedProposals")

// model Case（在现有 relation 列表末尾追加）
proposals          AgentProposal[]

// model Conversation（在现有 relation 列表末尾追加）
proposals          AgentProposal[]
```

---

## 四、Dispatcher 设计：直接调用 Service 层

> **重要约束**：Dispatcher 不调用 HTTP `/api/v1/*` 接口。  
> 原因：走 HTTP 会引入 cookie/auth/request 上下文问题、重复权限校验、以及无法参与数据库事务。

### 前提：Service 层文件现状

经核查，以下 service 文件**目前不存在**，需在 Phase 0 中创建：

| 需新建文件                                 | 职责                                                              |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `src/lib/case/service.ts`                  | `createCase()`、`addTimelineEvent()`                              |
| `src/lib/client/service.ts`                | `createClient()`                                                  |
| `src/lib/notification/reminder-service.ts` | 已存在，扩展 `createReminder()` 加 `tx?` 和 `idempotencyKey` 参数 |

现有相关逻辑分散在 `src/lib/case/case-extraction-service.ts`、`src/lib/case/case-workflow-status.ts` 等专用文件中，Phase 0 的工作是将"写入 DB"的原子操作提取到统一 service 文件，供 API route 和 Dispatcher 共用。

### Dispatcher 调用路径（Phase 0 完成后）

```
dispatcher.ts
  ├── CREATE_CLIENT    → src/lib/client/service.ts  → createClient()
  ├── CREATE_CASE      → src/lib/case/service.ts    → createCase()
  ├── ADD_TIMELINE     → src/lib/case/service.ts    → addTimelineEvent()
  └── CREATE_REMINDER  → src/lib/notification/reminder-service.ts → ReminderService.createReminder()
```

### 依赖注入规则

```typescript
// 前序 action 的 result.resourceId 注入后序 action 的 params
// 示例：CREATE_CLIENT 完成 → clientId 注入 CREATE_CASE.params
const resolvedParams = injectDependencyResults(action.params, completedActions);
```

### 幂等保障

每个 `ProposalAction` 创建时生成 `idempotencyKey = ${proposalId}-${actionType}-${sequence}`。执行前先查是否已有 `COMPLETED` 状态的同 key 记录，有则跳过，不重复写入。

### 并发确认保护

`confirm` API 必须用事务原子更新，防止双击或并发请求重复执行。`userId` 必须加入更新条件以保证权限隔离：

```typescript
// confirm/route.ts 核心逻辑
const { count } = await prisma.agentProposal.updateMany({
  where: { id, userId, status: 'PENDING' }, // 同时校验归属和状态
  data: { status: 'EXECUTING', confirmedAt: new Date(), confirmedById: userId },
});
if (count === 0) {
  // 归属不匹配 或 已被其他请求处理，返回 409
  return NextResponse.json(
    { success: false, error: { code: 'CONFLICT' } },
    { status: 409 }
  );
}
// 事务外异步执行 dispatcher.run(proposalId)
```

### EXECUTING 卡死恢复机制

`EXECUTING` 更新与 dispatcher 异步执行之间存在进程崩溃窗口。恢复方案见 Phase 1 工作项（`proposal-recovery.ts` 依赖 `AgentProposal` schema，须在 Phase 1 migration 完成后实施）。

设计规格已在此处记录，Phase 1 实现时参照：

- 每 10 分钟扫描 `status = EXECUTING` 且 `updatedAt < now - 15min` 的记录，标记为 `FAILED`
- 律师可在 ProposalCard 点"重试"，confirm API 检测 `FAILED` 状态后重置为 `PENDING` 重新执行

### 业务资源级幂等（服务层）

仅检查 `ProposalAction.status === COMPLETED` 无法覆盖"资源已创建但状态未写回就崩溃"的场景。Service 层需同时写入 `idempotencyKey`：

```typescript
// src/lib/case/service.ts
async function createCase(
  params: CreateCaseParams,
  idempotencyKey: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  // 先查：是否已有同 idempotencyKey 的资源
  const existing = await db.case.findFirst({
    where: { metadata: { path: ['idempotencyKey'], equals: idempotencyKey } },
  });
  if (existing) return existing; // 幂等返回

  return db.case.create({
    data: { ...params, metadata: { idempotencyKey } },
  });
}
```

所有 Phase 0 service 函数均需支持：

- 可选 `tx: Prisma.TransactionClient` 参数（供 Dispatcher 同事务写入）
- `idempotencyKey: string` 参数（写入业务资源 metadata，供重试时查重）

---

## 五、extractedData 结构规范

`extractedData` 是 AI 提取的标准化 JSON，**不可变**（律师修改写入 `confirmedData`，用于回溯对比）。

每个字段携带溯源信息，律师可点击查看"AI 从哪句话判断出来的"：

```typescript
// 通用字段元信息
interface FieldMeta {
  confidence: number; // 0-1，< 0.7 时界面显示 ⚠ 请确认
  needsConfirmation: boolean; // true = 卡片渲染时高亮要求律师主动确认
  sourceMessageId?: string; // 来自哪条对话消息
  sourceAttachmentId?: string; // 来自哪个附件
  sourceQuote?: string; // 原文片段（不超过 200 字）
}

// 建案场景完整结构
interface CaseProposalExtractedData {
  parties: Array<{
    name: string;
    role: 'CLIENT' | 'OPPONENT' | 'WITNESS' | 'OTHER';
    meta: FieldMeta;
    candidates?: Array<{
      // 库中存在同名实体时列出候选
      id: string;
      label: string;
      entityType: 'Client' | 'User' | 'Contact';
    }>;
  }>;

  caseType: string;
  caseTypeMeta: FieldMeta;

  claims: Array<{
    text: string;
    meta: FieldMeta;
  }>;

  keyDates: Array<{
    date: string; // ISO 8601
    description: string;
    type: 'CONSULT' | 'INCIDENT' | 'DEADLINE' | 'HEARING' | 'OTHER';
    meta: FieldMeta;
  }>;

  disputeFocuses?: Array<{
    text: string;
    meta: FieldMeta;
  }>;

  suggestedActions: Array<{
    actionType: string;
    label: string;
    params: Record<string, unknown>;
    sequence: number;
    dependsOnSequence?: number; // 显式声明依赖
    required: boolean; // false 时卡片默认不勾选
    revertStatus: 'PENDING' | 'NOT_APPLICABLE'; // extractor 按 actionType 显式设置
  }>;
}

// confirmedData 结构：支持字段级"已确认原值"状态
// 用于区分"律师未修改"与"律师已阅读并确认原值"
interface ConfirmedField<T> {
  value: T;
  confirmedAsIs: boolean; // true = 律师看了 ⚠ 后主动确认，无需修改
}

interface CaseProposalConfirmedData {
  parties?: Array<{
    name: ConfirmedField<string>;
    role: ConfirmedField<string>;
    resolvedEntityId?: string; // 律师从候选项中选择的已有实体 id
  }>;
  caseType?: ConfirmedField<string>;
  claims?: Array<ConfirmedField<string>>;
  keyDates?: Array<
    ConfirmedField<{ date: string; description: string; type: string }>
  >;
  // 其余字段按需添加
}
```

---

## 六、提案卡片 UI 规范

### 渲染规则

1. `Message.content` **始终填充**纯文本摘要，用于搜索、导出、打印、对话分叉时的上下文注入
2. 当且仅当 `role === 'assistant'` 且 `proposalId !== null` 时，在消息内容下方渲染 `ProposalCard`
3. 分叉对话时：复制消息记录，`proposalId` 设为 `null`（提案属于原对话上下文，不随分叉复制）

### ProposalCard 数据加载方式

`ProposalCard` 需要 `AgentProposal` 及其关联的 `ProposalAction[]`，有两种方案：

**方案 A（推荐）**：`messages` GET 接口 include `proposal.actions`

```typescript
// messages/route.ts GET 查询中增加
include: {
  attachments: true,
  annotations: true,
  proposal: {
    include: { actions: { orderBy: { sequence: 'asc' } } }
  }
}
```

优点：单次请求，无瀑布加载。缺点：无 proposal 时仍有 include 开销（proposal 为 null 时忽略）。

**方案 B**：`ProposalCard` 首次渲染时懒加载 `GET /api/v1/proposals/[id]`  
优点：messages 接口不变。缺点：额外一次网络请求，有闪烁。

**决策**：选方案 A，仅在 `proposalId !== null` 时才有实质开销，且避免渲染闪烁。

**同步更新 `src/types/chat.ts`**：`ChatMessage` 需补充 proposal 字段，否则前端类型不一致：

```typescript
// 在 src/types/chat.ts 中新增，供 ProposalCard 使用
export interface ProposalActionItem {
  id: string;
  sequence: number;
  actionType: string;
  label: string;
  params: Record<string, unknown>;
  selected: boolean;
  status: 'PENDING' | 'SKIPPED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  resourceType: string | null;
  resourceId: string | null;
  error: string | null;
}

export interface ProposalItem {
  id: string;
  status:
    | 'PENDING'
    | 'EXECUTING'
    | 'COMPLETED'
    | 'PARTIALLY_COMPLETED'
    | 'FAILED'
    | 'REJECTED'
    | 'REVERTED';
  extractedData: Record<string, unknown>;
  confirmedData: Record<string, unknown> | null;
  actions: ProposalActionItem[];
}

// ChatMessage 增加字段
export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  isDeleted: boolean;
  proposalId: string | null; // ← 新增
  proposal: ProposalItem | null; // ← 新增（方案 A 时由 GET 直接返回）
  createdAt: string;
  attachments: AttachmentItem[];
  annotations: AnnotationItem[];
}
```

### 卡片交互原型

```
┌──────────────────────────────────────────────────────────────┐
│ 我从你的描述中识别到以下信息，请确认后执行：                   │
│                                                              │
│ 案件类型    离婚纠纷                            [修改]        │
│ 当事人      张伟（你的客户）⚠ 请确认            [修改] [溯源] │
│             ┌ 客户张伟（id: clt_xxx）                        │
│             └ 新建张伟                                       │
│             李某某（对方当事人）                [修改]        │
│ 核心诉求    争取抚养权 / 分割房产               [修改]        │
│ 首次咨询    2026-05-17                         [修改]        │
│                                                              │
│ 建议执行以下操作：                                            │
│ ☑  创建客户档案（张伟）                                      │
│ ☑  创建案件                                                 │
│ ☑  建立案件时间线（2条事件）                                  │
│ ☐  生成初步证据清单（可选，默认不勾选）                        │
│                                                              │
│        [确认执行]      [修改后执行]      [暂不处理]           │
└──────────────────────────────────────────────────────────────┘
```

### 交互规则

| 场景               | 行为                                                            |
| ------------------ | --------------------------------------------------------------- |
| `confidence < 0.7` | 字段标 ⚠，`[确认执行]` 按钮禁用直至律师主动确认该字段           |
| 存在候选实体       | 字段展开下拉选择，律师必须选择或选"新建"                        |
| 点击 `[修改]`      | 字段变输入框，修改写入 `confirmedData`                          |
| 点击 `[溯源]`      | 展示 `sourceQuote` 原文片段                                     |
| 取消勾选动作       | `ProposalAction.selected = false`，提交时 status 设为 `SKIPPED` |
| `[暂不处理]`       | `ProposalStatus = REJECTED`，卡片折叠，可从历史中复查           |

---

## 七、补偿式撤销规范

> **红线修正**：不是所有已执行动作都能撤销。法律场景里"硬删除"风险极高。

### 撤销分类

| 动作类型                    | 撤销方式               | revertStatus 初始值 |
| --------------------------- | ---------------------- | ------------------- |
| CREATE_CASE（草稿状态）     | 软删除（设 deletedAt） | PENDING             |
| CREATE_CLIENT（无关联案件） | 软删除                 | PENDING             |
| ADD_TIMELINE_EVENT          | 物理删除               | PENDING             |
| CREATE_REMINDER             | 物理删除               | PENDING             |
| 已发送通知                  | 不可撤销，仅记录       | NOT_APPLICABLE      |
| 审计日志写入                | 不可撤销               | NOT_APPLICABLE      |
| AI 调用消耗                 | 不可撤销               | NOT_APPLICABLE      |
| 已归档文书                  | 不可撤销，需人工处理   | NOT_APPLICABLE      |

### 撤销流程

1. 律师发起撤销 → `PATCH /api/v1/proposals/[id]/revert`（需填写撤销原因）
2. Dispatcher 按 **反向 sequence** 执行补偿操作
3. 每个 action 记录 `revertStatus`、`revertedAt`、`revertError`
4. `NOT_APPLICABLE` 的 action 跳过，但在 UI 中提示"以下操作无法自动撤销"
5. Proposal 状态更新为 `REVERTED`，写入 `revertedAt` + `revertReason`

---

## 八、新增文件清单

```
src/lib/agent/proposal/
  ├── extractor.ts          # 调用 AI，从对话文本/附件提取 extractedData（结构化输出）
  ├── dispatcher.ts         # 按 sequence + 依赖链执行 ProposalActions，注入依赖结果
  └── revert.ts             # 补偿式撤销，按反向 sequence 执行，跳过 NOT_APPLICABLE

src/app/api/v1/proposals/
  ├── [id]/route.ts         # GET：获取提案详情（含 actions 和执行状态）
  ├── [id]/confirm/route.ts # PATCH：律师确认（含 confirmedData 和 selected 列表）
  ├── [id]/reject/route.ts  # PATCH：拒绝提案
  └── [id]/revert/route.ts  # PATCH：发起撤销（需 revertReason）

src/components/chat/
  └── ProposalCard.tsx      # 卡片 UI（内联编辑、多选、溯源、确认）

src/types/
  └── proposal.ts           # CaseProposalExtractedData、FieldMeta 等 TypeScript 类型
```

**修改现有文件：**

```
prisma/schema.prisma
  ├── 新增枚举：ProposalStatus / ProposalActionStatus / RevertStatus
  ├── 新增模型：AgentProposal / ProposalAction
  ├── Message：新增 proposalId（FK）和 triggeredProposal 反向关联
  ├── User：新增 proposals / confirmedProposals 反向关联
  ├── Case：新增 proposals 反向关联
  └── Conversation：新增 proposals 反向关联

src/app/api/v1/chat/conversations/[conversationId]/messages/route.ts
  └── AI 回复后检测建案场景 → 调用 extractor.ts → 创建 AgentProposal + ProposalActions → 关联 Message
```

**不需要修改：**

- 现有 `/api/v1/cases`、`/api/v1/clients`、`/api/v1/reminders` 等 HTTP 路由（Dispatcher 调用 service 层）
- 各模块页面，自然演变为复核面板

---

## 九、实施阶段

### Phase 0：Service 层抽取（Phase 1 的前提）

**目标**：将各模块的"写入 DB"原子操作提取到统一 service 文件，供 API route 和 Dispatcher 共用。

**工作项**：

1. `src/lib/case/service.ts`：`createCase()`、`addTimelineEvent()`（从现有 route.ts 提取，加 `tx?` 和 `idempotencyKey` 参数）
2. `src/lib/client/service.ts`：`createClient()`（从现有 route.ts 提取，同上）
3. `src/lib/notification/reminder-service.ts`：已存在，扩展 `createReminder()` 加 `tx?` 和 `idempotencyKey` 参数即可，不新建 task/service.ts
4. 现有 API route 改为调用 service（行为不变，只是消除重复代码）

**所有 service 函数签名约定**：

```typescript
function createCase(
  params: CreateCaseParams,
  idempotencyKey: string,
  tx?: Prisma.TransactionClient
): Promise<Case>;
```

**验收**：现有接口行为和测试全部通过，无功能变更。

---

### Phase 1：建案提案引擎（最小闭环，优先实施）

**场景**：律师描述案情（文字或上传委托书）→ AI 生成建案卡片 → 律师确认 → 自动创建客户 + 案件 + 时间线

**工作项**：

1. Schema migration（新增枚举 + 模型 + 反向关联字段）
2. `proposal.ts`：TypeScript 类型定义
3. `extractor.ts`：建案场景的 AI 提取 prompt + 结构化输出解析
4. `dispatcher.ts`：支持 CREATE_CLIENT → CREATE_CASE → ADD_TIMELINE_EVENT 依赖链 + 幂等
5. `revert.ts`：建案场景的补偿撤销逻辑
6. `/api/v1/proposals/[id]/confirm` + `reject` + `revert` API
7. `ProposalCard.tsx` 前端卡片组件
8. `messages/route.ts` 修改：AI 回复后触发提案创建
9. `src/lib/cron/proposal-recovery.ts`：EXECUTING 超时恢复（依赖 AgentProposal schema，Phase 1 migration 完成后实施）

**工程验收标准（Phase 1 完成条件）**：

| 条件           | 说明                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| 不重复建案     | 同一 `idempotencyKey` 重复执行时幂等跳过                                    |
| 部分失败可恢复 | 某个 action 失败后，Proposal 状态为 `PARTIALLY_COMPLETED`，可单独重试       |
| 审计日志完整   | 每个 action 有 `executedAt`、`result`/`error`、`retryCount`                 |
| 权限隔离       | 律师只能确认/撤销自己的 Proposal（`userId` 校验）                           |
| ⚠ 字段强制确认 | `confidence < 0.7` 的字段未手动确认时，`[确认执行]` 按钮禁用                |
| 单元测试       | `extractor.ts` 和 `dispatcher.ts` 有 Jest 测试，覆盖正常路径 + 部分失败场景 |

---

### Phase 2：主动推送层

**前提**：Phase 1 数据可靠性在真实用户中验证完成（至少 2 周）。

**场景**（按低争议到高争议排序）：

1. 开庭日期 T-3 天提醒（数据来源确定，无歧义）
2. 客户超过 N 天未跟进提醒
3. 合同到期前 30 天预警

**原则**：宁可漏报，不可误报。数据不确定时不推送。

---

### Phase 3：全场景覆盖

- 文书起草：对话触发 → 模板生成 → ProposalCard 预览 → 存入文书库
- 证据整理：上传附件 → AI 分类标注 → 关联案件
- 各模块页面转型为只读复核面板（保留编辑功能，移除"创建"入口）

---

## 十、设计约束与红线

| 约束                           | 说明                                                 |
| ------------------------------ | ---------------------------------------------------- |
| 写入业务数据前必须经过律师确认 | 早期阶段不允许 AI 自动写入核心业务数据               |
| Dispatcher 不走 HTTP           | 只调用 service 层，避免认证/事务/重复校验问题        |
| 实体消歧义不能静默处理         | 有候选项或置信度低时，必须追问律师，不允许猜测写入   |
| 撤销必须可审计                 | revertStatus + revertReason + revertedAt 全部记录    |
| 错误提醒成本极高               | 主动推送宁可漏报，不可误报；数据不确定时不推送       |
| 所有 AI 识别结果保留原始版本   | `extractedData` 不可变，律师修改写入 `confirmedData` |

---

## 十一、与现有架构的关系

本次重构是**渐进式演进**，不是推倒重来：

- 现有 `src/lib/agent/`（planning-agent、memory-agent、action-tracker）直接复用
- 现有 `AgentAction`、`ActionLog` 模型保留，作为底层审计补充
- 现有所有 API routes 保留，不变
- 现有 Prisma schema 新增 3 个枚举 + 2 个模型 + 各模型少量反向关联字段
- 现有 Chat 对话逻辑保留，`messages/route.ts` 仅在 AI 回复后追加提案创建逻辑
