# 律伴 Chat 界面改造设计文档

> 版本：v1.0 | 日期：2026-04-03 | 状态：进行中

---

## 一、背景与核心判断

### 问题

当前仪表盘有约 20 个功能模块。律师打开产品的第一秒不知道该做什么，导致流失。

### 核心判断

律师的工作从**文件**开始，不从表单开始。

- 诉讼律师：接案 → 上传卷宗 → 读懂案情 → 构建论点 → 起草文书
- 法务人员：收到合同 → 上传合同 → 识别风险 → 出具意见

AI 工具的入口应该是"上传文件"，而不是"请填写案情摘要"。

### 产品定位转变

|          | 改造前          | 改造后                   |
| -------- | --------------- | ------------------------ |
| 入口     | 20 个模块仪表盘 | 一个对话框 + 文件上传    |
| 用户角色 | 系统使用者      | AI 协作者                |
| 核心动作 | 填写信息        | 上传文件，和 AI 对话     |
| 其他功能 | 平铺展示        | 折叠进"工作台"侧边栏入口 |

---

## 二、新路由设计

### 路由

```
/chat                    # 新对话（默认页）
/chat/[conversationId]   # 具体对话
```

原仪表盘 `/dashboard` 保留，通过左侧"工作台"入口访问，不再是默认落地页。

---

## 三、界面布局

### 三栏结构

```
┌─────────────────┬──────────────────────────┬──────────────────┐
│ 左侧边栏 (240px) │ 对话区（弹性宽）          │ 预览区 (380px)   │
│                 │                          │ （可折叠，默认收起）│
│ + 新对话         │                          │                  │
│ ─────────────── │  [AI 消息气泡]            │  文书标题         │
│ 今天            │  ┌──────────────────────┐│                  │
│ › 李某合同纠纷   │  │ 选中文字时出现工具条  ││  正文内容...      │
│   └─ 分叉1      │  │ ✓ ? ✗ ★ 📋 | 分叉   ││                  │
│ › 劳动仲裁案     │  └──────────────────────┘│  ─────────────── │
│                 │                          │                  │
│ 昨天            │  [用户消息气泡]            │  [导出 Word]      │
│ › XX合同审查    │                          │  [导出 PDF]       │
│                 │  ─────────────────────── │                  │
│ ─────────────── │                          │                  │
│ 工作台 ↓        │  📎 上传  [输入框]   发送  │                  │
│  案件管理        │                          │                  │
│  合同管理        │                          │                  │
│  客户管理        │                          │                  │
│  ...            │                          │                  │
└─────────────────┴──────────────────────────┴──────────────────┘
```

### 响应式处理

- 宽屏（≥1280px）：三栏全展示
- 中屏（768-1279px）：预览区默认收起，右上角按钮唤出
- 窄屏（<768px）：单栏，侧边栏改为顶部抽屉

---

## 四、四个核心特色功能

### 4.1 分叉（Branch）

**交互**：鼠标悬停任意消息 → 出现"分叉"按钮 → 点击后从该消息的上下文创建新对话

**实现方式（复制分支法）**：

- 将原对话从头到该消息的所有内容复制到新对话
- 新对话在侧边栏挂在原对话下方，缩进显示
- 侧边栏展示：`原对话名 › 分叉1（来自第3条消息）`

**数据字段**：

- `Conversation.parentConversationId` → 指向原对话
- `Conversation.branchFromMessageId` → 指向哪条消息触发了分叉

### 4.2 删除（Delete）

**删除用户消息**：

- 悬停 → 删除按钮
- 弹出选项：「仅删除」/ 「删除并让 AI 重新生成」
- 选"重新生成"时，删除该消息及其后所有消息，然后自动发送原内容

**删除 AI 消息**：

- 悬停 → 删除按钮
- 仅删除该条，或删除该条及之后所有消息
- 可选"重新生成"：保留用户消息，重新请求 AI

**实现**：软删除（`isDeleted: true`），保留数据用于分支溯源。

### 4.3 标注（Annotate）

**触发**：在 AI 消息中选中任意文字 → 浮动工具条出现

**标注类型**：

| 图标 | 类型       | 含义             |
| ---- | ---------- | ---------------- |
| ✓    | CONFIRM    | 这个论点我认可   |
| ?    | QUESTION   | 这个引用需要核实 |
| ✗    | REJECT     | 这个分析有问题   |
| ★    | IMPORTANT  | 重点标记         |
| 📋   | USE_IN_DOC | 纳入文书草稿     |

**标注的联动效果**：

- `USE_IN_DOC` 标注自动将选中段落推入右侧预览区
- `QUESTION` 标注可以一键"从这里分叉"，专门深入探讨这个疑点
- `REJECT` 标注可以携带备注，下一轮对话时 AI 自动感知

**存储**：每条标注记录选中文字的起止字符偏移量，渲染时还原高亮。

### 4.4 预览（Preview）

**触发时机**：

- AI 输出包含结构化文书（起诉状、合同条款、法律意见书）时自动弹出
- 用户手动点击右上角"预览"按钮
- `USE_IN_DOC` 标注触发段落推入

**渲染能力**：

- Markdown → 富文本（使用 `react-markdown` + `remark-gfm`）
- 后期目标：近 Word 格式渲染（使用 `docx` 库生成）

**导出**：

- 导出 Markdown（立即可用）
- 导出 Word（`.docx`，使用 `docx` npm 包）
- 导出 PDF（浏览器 print API 或服务端 puppeteer）

---

## 五、数据模型

### 新增模型

```prisma
model Conversation {
  id                   String    @id @default(cuid())
  title                String    @default("新对话")
  userId               String
  parentConversationId String?   // 分叉：父对话 ID
  branchFromMessageId  String?   // 分叉：来自哪条消息
  isArchived           Boolean   @default(false)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user     User          @relation(fields: [userId], references: [id])
  parent   Conversation? @relation("ConversationBranches", fields: [parentConversationId], references: [id])
  branches Conversation[] @relation("ConversationBranches")
  messages Message[]

  @@index([userId])
  @@index([parentConversationId])
  @@map("conversations")
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // "user" | "assistant"
  content        String   @db.Text
  isDeleted      Boolean  @default(false)
  createdAt      DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  attachments  MessageAttachment[]
  annotations  Annotation[]

  @@index([conversationId])
  @@map("messages")
}

model MessageAttachment {
  id            String   @id @default(cuid())
  messageId     String
  fileName      String
  fileUrl       String
  fileType      String
  fileSize      Int
  extractedText String?  @db.Text
  createdAt     DateTime @default(now())

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@map("message_attachments")
}

model Annotation {
  id           String   @id @default(cuid())
  messageId    String
  userId       String
  selectedText String   @db.Text
  startOffset  Int
  endOffset    Int
  type         String   // CONFIRM | QUESTION | REJECT | IMPORTANT | USE_IN_DOC
  note         String?
  createdAt    DateTime @default(now())

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id])

  @@index([messageId])
  @@index([userId])
  @@map("annotations")
}
```

---

## 六、API 设计

```
# 对话
GET    /api/v1/chat/conversations              # 列表（含分支层级）
POST   /api/v1/chat/conversations              # 新建
PATCH  /api/v1/chat/conversations/[id]         # 重命名/归档
DELETE /api/v1/chat/conversations/[id]         # 删除

# 分叉
POST   /api/v1/chat/conversations/[id]/branch  # 从 messageId 分叉

# 消息
GET    /api/v1/chat/conversations/[id]/messages
POST   /api/v1/chat/conversations/[id]/messages        # 发送（触发 AI）
DELETE /api/v1/chat/messages/[id]                      # 删除消息
POST   /api/v1/chat/messages/[id]/regenerate           # 重新生成

# 标注
POST   /api/v1/chat/messages/[id]/annotations
DELETE /api/v1/chat/annotations/[id]

# 文件上传
POST   /api/v1/chat/upload                    # 上传文件，返回 extractedText
```

---

## 七、四维审计标准

每次新增或修改文件后，必须执行以下四个维度的审计：

### 维度一：类型安全

- 无 `any` 类型，无 `as any`
- 所有 props、返回值、API 响应均有明确类型定义
- Prisma 查询结果类型正确推导

### 维度二：安全合规

- 所有 API 路由必须有 `getAuthUser` 认证检查
- 用户只能访问自己的对话（`userId` 条件过滤）
- 文件上传有类型和大小限制
- 无 XSS 风险（用户内容不直接 innerHTML）

### 维度三：产品逻辑

- 功能是否真实服务律师工作流
- 交互是否与设计文档一致
- 边界情况是否考虑（空对话、分叉后删除父对话等）

### 维度四：代码规范

- 使用 `logger` 而非 `console.*`
- API 返回格式 `{ success, data?, error? }`
- 无多余注释、无废弃代码
- 遵守 CLAUDE.md 所有规范

---

## 八、实现顺序

1. Prisma schema 新增四个模型 + 迁移
2. `/chat` 页面基础三栏布局（静态骨架）
3. 对话列表 API + 侧边栏渲染
4. 消息发送 API + 对话区渲染（接入现有 AI）
5. 文件上传 + 文本提取
6. 删除 + 重新生成
7. 标注系统（选中文字 → 工具条 → 存储 → 高亮还原）
8. 预览区（Markdown 渲染 + USE_IN_DOC 联动）
9. 分叉功能
10. 原仪表盘折叠进"工作台"入口
