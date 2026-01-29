# 模块2增强功能实施计划

> **文档版本**: v1.0
> **创建日期**: 2026-01-29
> **预计总工时**: 40-50小时
> **优先级**: P3（增强功能）

---

## 目录

1. [功能增强计划](#功能增强计划)
2. [测试增强计划](#测试增强计划)
3. [性能优化计划](#性能优化计划)
4. [实施时间表](#实施时间表)

---

## 功能增强计划

### 1. 合同电子签名功能 ⭐⭐⭐

**优先级**: P3-高
**预计工时**: 12-15小时
**技术难度**: ⭐⭐⭐⭐

#### 功能描述
实现合同的电子签名功能，支持双方在线签署合同，记录签名时间和签名数据。

#### 技术方案

**方案A：Canvas手写签名（推荐）**
- 使用HTML5 Canvas实现手写签名板
- 将签名保存为Base64图片
- 存储到数据库的signatureData字段

**方案B：第三方电子签名服务**
- 集成e签宝、法大大等第三方服务
- 更专业，具有法律效力
- 需要额外费用

#### 实施步骤

##### 1.1 数据模型扩展（1小时）
```prisma
// prisma/schema.prisma
model Contract {
  // ... 现有字段

  // 签名相关字段（已有，需要完善使用）
  signatureData   Json?              // 签名数据
  signedAt        DateTime?          // 签署时间
  signedBy        String?            // 签署人

  // 新增字段
  clientSignature String?            // 委托人签名（Base64）
  clientSignedAt  DateTime?          // 委托人签署时间
  lawyerSignature String?            // 律师签名（Base64）
  lawyerSignedAt  DateTime?          // 律师签署时间
  signatureIp     String?            // 签署IP地址
  signatureDevice String?            // 签署设备信息
}
```

##### 1.2 签名组件开发（4小时）
**文件**: `src/components/contract/SignaturePad.tsx`

功能要求：
- Canvas手写签名板
- 清除重签功能
- 签名预览
- 保存为Base64格式
- 响应式设计（支持触摸屏）

##### 1.3 签名页面开发（3小时）
**文件**: `src/app/contracts/[id]/sign/page.tsx`

功能要求：
- 显示合同内容预览
- 委托人签名区域
- 律师签名区域
- 签名确认和提交
- 签名历史记录

##### 1.4 签名API开发（2小时）
**文件**: `src/app/api/contracts/[id]/sign/route.ts`

```typescript
// POST /api/contracts/[id]/sign
// 提交签名
{
  role: 'client' | 'lawyer',
  signature: 'base64_string',
  ip: 'xxx.xxx.xxx.xxx',
  device: 'user_agent_string'
}
```

##### 1.5 PDF签名集成（2-3小时）
- 在生成的PDF中嵌入签名图片
- 显示签名时间和签署人信息
- 添加签名验证二维码（可选）

##### 1.6 测试（1-2小时）
- 签名组件测试
- 签名API测试
- PDF签名显示测试

#### 验收标准
- [ ] 支持Canvas手写签名
- [ ] 签名数据正确保存
- [ ] PDF中正确显示签名
- [ ] 记录签名时间和IP
- [ ] 支持移动端触摸签名

---

### 2. 合同邮件发送功能 ⭐⭐

**优先级**: P3-高
**预计工时**: 6-8小时
**技术难度**: ⭐⭐⭐

#### 功能描述
支持将合同PDF通过邮件发送给客户，包含合同链接和附件。

#### 技术方案
- 使用nodemailer发送邮件（项目已安装）
- 支持HTML邮件模板
- 附带合同PDF附件
- 包含在线查看链接

#### 实施步骤

##### 2.1 邮件服务开发（2小时）
**文件**: `src/lib/email/contract-email-service.ts`

```typescript
export interface SendContractEmailInput {
  contractId: string;
  recipientEmail: string;
  recipientName: string;
  subject?: string;
  message?: string;
}

export class ContractEmailService {
  async sendContract(input: SendContractEmailInput): Promise<void>;
  async sendSignatureReminder(contractId: string): Promise<void>;
  async sendSignatureConfirmation(contractId: string): Promise<void>;
}
```

##### 2.2 邮件模板开发（2小时）
**文件**: `src/lib/email/templates/contract-email.html`

模板内容：
- 律所Logo和信息
- 合同基本信息
- 在线查看链接
- 签署提醒（如未签署）
- 联系方式

##### 2.3 发送API开发（1小时）
**文件**: `src/app/api/contracts/[id]/send-email/route.ts`

```typescript
// POST /api/contracts/[id]/send-email
{
  recipientEmail: string;
  recipientName: string;
  message?: string;
}
```

##### 2.4 UI集成（1-2小时）
在合同详情页添加"发送邮件"按钮和对话框。

##### 2.5 测试（1小时）
- 邮件发送测试
- 模板渲染测试
- 附件测试

#### 验收标准
- [ ] 邮件成功发送
- [ ] PDF附件正确
- [ ] 邮件模板美观
- [ ] 包含在线查看链接
- [ ] 发送记录可追踪

---

### 3. 合同版本管理 ⭐⭐⭐

**优先级**: P3-中
**预计工时**: 8-10小时
**技术难度**: ⭐⭐⭐⭐

#### 功能描述
记录合同的修改历史，支持版本对比和回滚。

#### 技术方案
- 每次修改创建新版本记录
- 使用JSON存储版本快照
- 支持版本对比（diff）
- 支持版本回滚

#### 实施步骤

##### 3.1 数据模型设计（1小时）
**文件**: `prisma/schema.prisma`

```prisma
model ContractVersion {
  id              String   @id @default(cuid())
  contractId      String
  contract        Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)

  version         Int                // 版本号
  snapshot        Json               // 合同数据快照
  changes         Json?              // 变更内容
  changeType      String             // 变更类型：CREATE/UPDATE/SIGN

  createdBy       String             // 创建人
  createdAt       DateTime @default(now())
  comment         String?            // 版本说明

  @@index([contractId])
  @@map("contract_versions")
}
```

##### 3.2 版本服务开发（3小时）
**文件**: `src/lib/contract/contract-version-service.ts`

```typescript
export class ContractVersionService {
  // 创建新版本
  async createVersion(contractId: string, changeType: string): Promise<void>;

  // 获取版本列表
  async getVersions(contractId: string): Promise<ContractVersion[]>;

  // 版本对比
  async compareVersions(versionId1: string, versionId2: string): Promise<VersionDiff>;

  // 版本回滚
  async rollbackToVersion(contractId: string, versionId: string): Promise<void>;
}
```

##### 3.3 版本对比组件（2小时）
**文件**: `src/components/contract/VersionComparison.tsx`

功能：
- 并排显示两个版本
- 高亮显示差异
- 支持字段级对比

##### 3.4 版本历史页面（2小时）
**文件**: `src/app/contracts/[id]/versions/page.tsx`

功能：
- 版本时间线展示
- 版本详情查看
- 版本对比
- 版本回滚

##### 3.5 API开发（1小时）
```typescript
GET    /api/contracts/[id]/versions        // 获取版本列表
GET    /api/contracts/[id]/versions/[vid]  // 获取版本详情
POST   /api/contracts/[id]/versions/compare // 版本对比
POST   /api/contracts/[id]/versions/rollback // 版本回滚
```

##### 3.6 测试（1小时）
- 版本创建测试
- 版本对比测试
- 回滚测试

#### 验收标准
- [ ] 自动记录版本
- [ ] 版本对比功能正常
- [ ] 支持版本回滚
- [ ] 版本历史清晰展示
- [ ] 不影响现有功能

---

### 4. 合同审批流程 ⭐⭐⭐⭐

**优先级**: P3-中
**预计工时**: 10-12小时
**技术难度**: ⭐⭐⭐⭐⭐

#### 功能描述
实现合同审批工作流，支持多级审批、审批意见、审批历史。

#### 技术方案
- 定义审批流程模板
- 支持串行/并行审批
- 审批通知和提醒
- 审批历史记录

#### 实施步骤

##### 4.1 数据模型设计（2小时）
**文件**: `prisma/schema.prisma`

```prisma
// 审批流程模板
model ApprovalTemplate {
  id              String   @id @default(cuid())
  name            String             // 模板名称
  description     String?            // 描述
  steps           Json               // 审批步骤配置
  isActive        Boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("approval_templates")
}

// 合同审批记录
model ContractApproval {
  id              String   @id @default(cuid())
  contractId      String
  contract        Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)

  templateId      String?            // 使用的模板
  currentStep     Int      @default(1) // 当前步骤
  status          ApprovalStatus     // 审批状态

  createdBy       String             // 发起人
  createdAt       DateTime @default(now())
  completedAt     DateTime?          // 完成时间

  steps           ApprovalStep[]

  @@index([contractId])
  @@map("contract_approvals")
}

// 审批步骤
model ApprovalStep {
  id              String   @id @default(cuid())
  approvalId      String
  approval        ContractApproval @relation(fields: [approvalId], references: [id], onDelete: Cascade)

  stepNumber      Int                // 步骤序号
  approverRole    String             // 审批角色
  approverId      String?            // 审批人ID
  approverName    String?            // 审批人姓名

  status          StepStatus         // 步骤状态
  decision        String?            // 审批决定：APPROVE/REJECT/RETURN
  comment         String?            // 审批意见

  createdAt       DateTime @default(now())
  completedAt     DateTime?          // 完成时间

  @@index([approvalId])
  @@map("approval_steps")
}

enum ApprovalStatus {
  PENDING     // 待审批
  IN_PROGRESS // 审批中
  APPROVED    // 已通过
  REJECTED    // 已拒绝
  CANCELLED   // 已取消
}

enum StepStatus {
  PENDING     // 待审批
  APPROVED    // 已通过
  REJECTED    // 已拒绝
  SKIPPED     // 已跳过
}
```

##### 4.2 审批服务开发（4小时）
**文件**: `src/lib/contract/contract-approval-service.ts`

```typescript
export class ContractApprovalService {
  // 发起审批
  async startApproval(contractId: string, templateId: string): Promise<void>;

  // 提交审批意见
  async submitApproval(stepId: string, decision: string, comment: string): Promise<void>;

  // 获取待审批列表
  async getPendingApprovals(userId: string): Promise<ContractApproval[]>;

  // 撤回审批
  async cancelApproval(approvalId: string): Promise<void>;
}
```

##### 4.3 审批流程组件（2小时）
**文件**: `src/components/contract/ApprovalFlow.tsx`

功能：
- 流程图展示
- 当前步骤高亮
- 审批历史展示
- 审批操作按钮

##### 4.4 审批页面开发（2小时）
**文件**: `src/app/contracts/[id]/approval/page.tsx`

功能：
- 合同信息展示
- 审批流程展示
- 审批意见提交
- 审批历史查看

##### 4.5 API开发（1-2小时）
```typescript
POST   /api/contracts/[id]/approval/start    // 发起审批
POST   /api/contracts/[id]/approval/submit   // 提交审批
GET    /api/contracts/[id]/approval          // 获取审批信息
POST   /api/contracts/[id]/approval/cancel   // 撤回审批
GET    /api/approvals/pending                // 获取待审批列表
```

##### 4.6 测试（1小时）
- 审批流程测试
- 多级审批测试
- 审批通知测试

#### 验收标准
- [ ] 支持多级审批
- [ ] 审批流程可配置
- [ ] 审批历史完整
- [ ] 审批通知及时
- [ ] 支持审批撤回

---

## 测试增强计划

### 5. 组件测试补充 ⭐⭐

**优先级**: P3-中
**预计工时**: 6-8小时
**技术难度**: ⭐⭐⭐

#### 测试范围

##### 5.1 合同表单组件测试（2小时）
**文件**: `src/__tests__/components/contracts/contract-form.test.tsx`

测试内容：
- 表单渲染
- 字段验证
- 数据提交
- 错误处理

##### 5.2 立案材料组件测试（2小时）
**文件**: `src/__tests__/components/case/filing-materials-list.test.tsx`

测试内容：
- 材料列表渲染
- 勾选功能
- 进度计算
- 分类展示

##### 5.3 模板编辑器组件测试（2-3小时）
**文件**: `src/__tests__/components/contract/template-editor.test.tsx`

测试内容：
- 编辑器渲染
- 变量插入
- 预览功能
- 保存功能

##### 5.4 签名组件测试（1小时）
**文件**: `src/__tests__/components/contract/signature-pad.test.tsx`

测试内容：
- Canvas渲染
- 签名绘制
- 清除功能
- Base64转换

#### 目标
- 组件测试覆盖率达到80%+
- 所有交互功能都有测试

---

### 6. E2E测试添加 ⭐⭐⭐

**优先级**: P3-低
**预计工时**: 8-10小时
**技术难度**: ⭐⭐⭐⭐

#### 测试工具
使用Playwright（项目已安装）

#### 测试场景

##### 6.1 合同完整流程测试（3小时）
**文件**: `src/__tests__/e2e/contract-workflow.spec.ts`

测试流程：
1. 登录系统
2. 创建新合同
3. 填写合同信息
4. 保存合同
5. 编辑合同
6. 生成PDF
7. 发送邮件
8. 签署合同

##### 6.2 模板管理测试（2小时）
**文件**: `src/__tests__/e2e/template-management.spec.ts`

测试流程：
1. 访问模板管理页
2. 创建新模板
3. 编辑模板内容
4. 插入变量
5. 预览模板
6. 保存模板
7. 使用模板创建合同

##### 6.3 审批流程测试（2-3小时）
**文件**: `src/__tests__/e2e/approval-workflow.spec.ts`

测试流程：
1. 发起审批
2. 审批人审批
3. 多级审批
4. 审批通过
5. 审批拒绝
6. 审批撤回

##### 6.4 付款管理测试（1小时）
**文件**: `src/__tests__/e2e/payment-management.spec.ts`

测试流程：
1. 查看付款记录
2. 添加付款记录
3. 更新付款状态
4. 查看付款进度

#### 目标
- 覆盖所有关键业务流程
- 确保端到端功能正常

---

## 性能优化计划

### 7. PDF生成缓存 ⭐⭐

**优先级**: P3-高
**预计工时**: 3-4小时
**技术难度**: ⭐⭐

#### 优化方案

##### 7.1 缓存策略（1小时）
- 首次生成后缓存PDF文件
- 合同修改后清除缓存
- 使用文件哈希验证缓存有效性

##### 7.2 实现缓存逻辑（2小时）
**文件**: `src/lib/contract/contract-pdf-generator.ts`

```typescript
// 修改现有函数
export async function generateContractPDF(contractId: string): Promise<string> {
  // 1. 检查缓存是否存在且有效
  const cachedPath = await getCachedPDF(contractId);
  if (cachedPath && await isValidCache(contractId, cachedPath)) {
    return cachedPath;
  }

  // 2. 生成新PDF
  const filePath = await generateNewPDF(contractId);

  // 3. 更新缓存记录
  await updateCacheRecord(contractId, filePath);

  return filePath;
}
```

##### 7.3 缓存清理（1小时）
- 合同更新时清除缓存
- 定时清理过期缓存
- 缓存大小限制

#### 预期效果
- PDF生成速度提升80%+
- 减少服务器负载
- 改善用户体验

---

### 8. 数据库查询优化 ⭐⭐⭐

**优先级**: P3-中
**预计工时**: 4-5小时
**技术难度**: ⭐⭐⭐

#### 优化内容

##### 8.1 索引优化（1小时）
检查并添加必要的数据库索引：
```prisma
model Contract {
  // 添加复合索引
  @@index([status, createdAt])
  @@index([clientName, status])
  @@index([lawyerId, status])
}
```

##### 8.2 查询优化（2小时）
- 使用select减少查询字段
- 优化关联查询（include）
- 添加分页查询
- 使用游标分页替代offset

##### 8.3 N+1查询问题（1小时）
- 识别N+1查询
- 使用include预加载关联数据
- 批量查询优化

##### 8.4 缓存层添加（1小时）
- 使用Redis缓存热点数据
- 缓存合同列表
- 缓存模板数据

#### 预期效果
- 列表查询速度提升50%+
- 减少数据库负载
- 支持更大数据量

---

## 实施时间表

### 阶段一：核心功能增强（2-3周）

**第1周：电子签名 + 邮件发送**
- Day 1-3: 电子签名功能开发
- Day 4-5: 邮件发送功能开发
- 预计产出：可用的签名和邮件功能

**第2周：版本管理**
- Day 1-3: 版本管理功能开发
- Day 4-5: 测试和优化
- 预计产出：完整的版本管理系统

**第3周：审批流程**
- Day 1-4: 审批流程开发
- Day 5: 测试和优化
- 预计产出：可配置的审批系统

### 阶段二：测试增强（1-2周）

**第4周：组件测试 + E2E测试**
- Day 1-2: 组件测试补充
- Day 3-5: E2E测试开发
- 预计产出：测试覆盖率达到70%+

### 阶段三：性能优化（1周）

**第5周：性能优化**
- Day 1-2: PDF缓存实现
- Day 3-4: 数据库优化
- Day 5: 性能测试和调优
- 预计产出：性能提升50%+

---

## 优先级建议

### 立即开始（推荐）
1. ⭐⭐⭐ **PDF生成缓存** - 快速见效，提升用户体验
2. ⭐⭐⭐ **合同邮件发送** - 实用功能，开发成本低
3. ⭐⭐⭐ **电子签名功能** - 核心功能，提升专业度

### 第二批次
4. ⭐⭐ **组件测试补充** - 提高代码质量
5. ⭐⭐ **数据库查询优化** - 为大数据量做准备

### 第三批次
6. ⭐ **合同版本管理** - 高级功能，适合有需求时再做
7. ⭐ **审批流程** - 复杂功能，需要明确业务需求
8. ⭐ **E2E测试** - 可选，时间充裕时补充

---

## 资源需求

### 开发资源
- 前端开发：1人
- 后端开发：1人
- 测试：0.5人

### 技术栈
- 已有：Next.js, React, Prisma, pdfkit, nodemailer
- 需要：Canvas API, Redis（可选）

### 第三方服务（可选）
- 电子签名：e签宝/法大大（如需法律效力）
- 邮件服务：已有nodemailer
- 缓存服务：Redis（可选）

---

## 风险评估

### 技术风险
- **电子签名法律效力** - 建议咨询法律顾问
- **审批流程复杂度** - 需要充分的需求调研
- **性能优化效果** - 需要实际测试验证

### 业务风险
- **功能过度设计** - 建议按需开发，避免浪费
- **用户接受度** - 新功能需要用户培训

### 缓解措施
- 分阶段实施，每个阶段都有可用产出
- 充分测试，确保稳定性
- 收集用户反馈，持续优化

---

## 成功标准

### 功能完整性
- [ ] 所有计划功能都已实现
- [ ] 功能测试通过
- [ ] 用户验收通过

### 性能指标
- [ ] PDF生成速度提升80%+
- [ ] 列表查询速度提升50%+
- [ ] 页面加载时间<2秒

### 质量指标
- [ ] 测试覆盖率达到70%+
- [ ] 无严重Bug
- [ ] 代码审查通过

### 用户满意度
- [ ] 用户反馈积极
- [ ] 功能使用率高
- [ ] 减少支持工单

---

## 总结

这份增强计划涵盖了：
- ✅ 4个核心功能增强
- ✅ 2个测试增强项目
- ✅ 2个性能优化项目

**总预计工时**: 40-50小时
**建议实施周期**: 5-6周
**投资回报**: 高（显著提升产品竞争力）

建议按照优先级分阶段实施，每完成一个阶段就可以交付使用，获得用户反馈后再继续下一阶段。

---

**文档结束**

> 如需开始实施，请告知优先选择哪些功能，我将立即开始开发！
