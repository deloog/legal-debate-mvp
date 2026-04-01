# 合同管理业务场景 API 测试方案

基于 REST API 的合同管理完整流程自动化测试，覆盖从合同创建到签署执行的全生命周期。

## 📋 测试覆盖范围

### 1. 认证与授权模块

- ✅ 用户登录（JWT Token 获取）
- ✅ 当前用户信息获取
- ✅ 角色权限验证（必须为 LAWYER 或 SUPER_ADMIN）

### 2. 前置数据准备

- ✅ 创建关联案件（合同必须关联案件）

### 3. 合同生命周期模块

- ✅ 创建合同（自动分配合同编号）
- ✅ 获取合同列表（分页、筛选）
- ✅ 获取合同详情（含关联案件和付款计划）
- ✅ 更新合同信息

### 4. 合同审批流程模块

- ✅ 启动合同审批
- ✅ 获取审批信息
- ✅ 验证合同状态流转（DRAFT → PENDING）

### 5. 电子签署模块

- ✅ 律师签署
- ✅ 客户签署
- ✅ 双方签署完成后状态变更（PENDING → SIGNED）
- ✅ 重复签署阻止

### 6. 付款记录管理模块

- ✅ 获取付款记录列表
- ✅ 创建付款记录
- ✅ 验证已付金额自动更新

### 7. 法条关联模块

- ✅ 获取合同关联法条
- ✅ 获取法条推荐

### 8. 版本管理模块

- ✅ 获取合同版本历史

### 9. 导出功能模块

- ✅ PDF 导出

### 10. 合同执行模块

- ✅ 开始执行合同（可选）

## 🚀 快速开始

### 前置条件

1. **服务器运行**：

```bash
npm run dev
```

2. **测试用户要求**：
   - 角色必须为 `LAWYER` 或 `SUPER_ADMIN`
   - `LAWYER` 角色需要通过资质审核（status = 'APPROVED'）

3. **创建测试用户（如需要）**：

```bash
# 通过数据库直接创建律师用户，或
# 通过注册后修改用户角色为 LAWYER
# 然后通过资质上传接口提交资质审核
```

### 运行测试

#### 方式 1: 使用 PowerShell 脚本 (推荐)

```powershell
cd scripts/api-test
.\run-contract-test.ps1

# 或指定参数
.\run-contract-test.ps1 -Url http://localhost:3001 -Email lawyer@example.com -Password lawyer123
```

#### 方式 2: 直接运行 TypeScript

```powershell
# 设置环境变量
$env:API_BASE_URL="http://localhost:3000"
$env:TEST_USER_EMAIL="lawyer@example.com"
$env:TEST_USER_PASSWORD="lawyer123"

# 运行测试
npx ts-node scripts/api-test/contract-workflow-test.ts
```

## 📊 测试结果示例

```
╔══════════════════════════════════════════════════════════════╗
║          📋 合同管理业务场景 API 测试                        ║
╚══════════════════════════════════════════════════════════════╝

✅ PASS: 1.1 用户登录 - 获取访问令牌 (234ms)
   👤 登录用户: lawyer@example.com (LAWYER)
✅ PASS: 1.2 获取当前用户信息 (45ms)
✅ PASS: 1.3 验证用户角色（应为 LAWYER 或 SUPER_ADMIN） (12ms)
   ✓ 用户角色验证通过: LAWYER
✅ PASS: 2.1 创建关联案件 (156ms)
   📁 案件ID: cly1234567890abcdef
✅ PASS: 3.1 创建合同（草稿状态） (245ms)
   📄 合同ID: clm9876543210fedcba
   📄 合同编号: HT20260401001
...
✅ PASS: 11.1 删除关联案件（软删除） (89ms)
   🗑️  案件已删除

==================================================
📊 测试结果: 26 通过, 0 失败, 总计 26 个测试
⏱️  总耗时: 4567ms
==================================================
```

## 🔧 配置说明

### 环境变量

| 变量名               | 说明         | 默认值                  |
| -------------------- | ------------ | ----------------------- |
| `API_BASE_URL`       | API 基础 URL | `http://localhost:3000` |
| `TEST_USER_EMAIL`    | 测试用户邮箱 | `lawyer@example.com`    |
| `TEST_USER_PASSWORD` | 测试用户密码 | `lawyer123`             |

### 权限要求

| 角色        | 创建合同    | 签署合同      | 审批流程 |
| ----------- | ----------- | ------------- | -------- |
| USER        | ❌          | ⚠️ 仅限委托方 | ❌       |
| LAWYER      | ✅ (需资质) | ✅ 律师签署   | ✅       |
| ADMIN       | ❌          | ❌            | ✅       |
| SUPER_ADMIN | ✅          | ✅            | ✅       |

## 🐛 故障排查

### 403 Forbidden - "只有已认证律师才能创建合同"

**原因**: 用户角色不是 LAWYER 或 SUPER_ADMIN

**解决方案**:

```sql
-- 在数据库中修改用户角色
UPDATE users SET role = 'LAWYER' WHERE email = 'your-email@example.com';
```

### 403 QUALIFICATION_REQUIRED - "您的律师资质尚未通过审核"

**原因**: LAWYER 角色需要通过资质审核

**解决方案**:

1. 通过资质上传接口提交资质
2. 在数据库中直接设置资质状态为 APPROVED：

```sql
-- 检查资质记录
SELECT * FROM lawyer_qualifications WHERE user_id = 'your-user-id';

-- 更新资质状态
UPDATE lawyer_qualifications SET status = 'APPROVED' WHERE user_id = 'your-user-id';
```

### 400 INVALID_STATUS - "合同当前状态不允许签署"

**原因**: 合同签署需要完成审批流程（status = PENDING）

**解决方案**: 测试脚本会自动启动审批流程，确保审批流程正确配置

### 401 Unauthorized - "邮箱或密码错误"

**原因**: 测试用户凭据错误

**解决方案**: 确认测试用户在数据库中存在且密码正确

## 🏗️ 合同业务流程

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  创建   │───→│  审批   │───→│  签署   │───→│  执行   │───→│  完成   │
│ (DRAFT) │    │(PENDING)│    │(SIGNED) │    │(EXECUTING)│   │(COMPLETED)│
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │                              ↑
     │         ┌─────────┐          │
     └────┬───→│  驳回   │──────────┘
          │    │(REJECTED)│
          │    └─────────┘
          │    ┌─────────┐
          └───→│  终止   │
               │(TERMINATED)│
               └─────────┘
```

## 📝 合同数据结构

```typescript
interface Contract {
  id: string; // 合同ID
  contractNumber: string; // 合同编号 (HTYYYYMMDDNNN)
  caseId?: string; // 关联案件ID

  // 委托方信息
  clientType: 'INDIVIDUAL' | 'ENTERPRISE';
  clientName: string;
  clientIdNumber?: string;
  clientAddress?: string;
  clientContact?: string;

  // 受托方信息
  lawFirmName: string;
  lawyerName: string;
  lawyerId: string;

  // 委托事项
  caseType: string;
  caseSummary: string;
  scope: string;

  // 收费信息
  feeType: 'FIXED' | 'HOURLY' | 'RISK' | 'MIXED';
  totalFee: number;
  paidAmount: number;

  // 状态
  status:
    | 'DRAFT'
    | 'PENDING'
    | 'SIGNED'
    | 'EXECUTING'
    | 'COMPLETED'
    | 'TERMINATED';
  signedAt?: string;

  // 签名信息
  clientSignature?: string;
  clientSignedAt?: string;
  lawyerSignature?: string;
  lawyerSignedAt?: string;
}
```

## 🔗 相关 API 端点

| 方法 | 端点                                 | 说明         |
| ---- | ------------------------------------ | ------------ |
| POST | `/api/contracts`                     | 创建合同     |
| GET  | `/api/contracts`                     | 获取合同列表 |
| GET  | `/api/contracts/:id`                 | 获取合同详情 |
| PUT  | `/api/contracts/:id`                 | 更新合同     |
| POST | `/api/contracts/:id/sign`            | 电子签署     |
| POST | `/api/contracts/:id/approval/start`  | 启动审批     |
| GET  | `/api/contracts/:id/payments`        | 获取付款记录 |
| POST | `/api/contracts/:id/payments`        | 创建付款记录 |
| GET  | `/api/v1/contracts/:id/law-articles` | 获取关联法条 |
| GET  | `/api/contracts/:id/versions`        | 获取版本历史 |

## 📁 文件结构

```
scripts/api-test/
├── README-contract.md           # 本文档
├── contract-workflow-test.ts   # 合同测试主文件
└── run-contract-test.ps1       # Windows 运行脚本
```

## 💡 扩展建议

### 添加审批步骤测试

```typescript
// 在提交审批步骤后添加详细验证
runner.test('4.3 提交审批步骤', async () => {
  const response = await client.submitApprovalStep(testData.testContract!.id, {
    stepNumber: 1,
    action: 'APPROVE',
    comment: '审批通过',
  });

  assert(response.success === true, '提交审批应该成功');
  assertEquals(response.data?.status, 'APPROVED', '审批应该通过');
});
```

### 添加法条关联测试

```typescript
runner.test('7.3 添加法条关联', async () => {
  const lawArticleId = 'law-article-123';
  const response = await client.addContractLawArticle(
    testData.testContract!.id,
    lawArticleId,
    '与合同纠纷相关'
  );

  assert(response.success === true, '添加法条应该成功');
});
```

## 🔗 相关文档

- [辩论业务测试](./README.md)
- [项目 API 文档](../../docs/API.md)
- [合同系统架构](../../docs/architecture/CONTRACT_SYSTEM.md)
