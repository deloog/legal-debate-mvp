# 管理员账户设置指南

## 概述

本文档说明了管理员账户的设置方法，用于支持企业审核等管理功能的E2E测试。

## 提前实现说明

**注意**：管理员账户功能是提前实现的，原本计划在Sprint 9.1.4任务中实现。

提前实现的原因：
- Sprint 8.3.2（企业认证集成测试）需要管理员账户进行完整测试
- 企业审核API（`/api/admin/enterprise/[id]/review`）已存在但无法测试（无管理员账户）

## 管理员账户配置

### 默认管理员账户

| 配置项 | 值 |
|---------|-----|
| 邮箱 | admin@example.com |
| 密码 | Admin@123 |
| 角色 | ADMIN |
| 状态 | ACTIVE |

### 测试企业账户

| 配置项 | 值 |
|---------|-----|
| 邮箱 | enterprise@example.com |
| 密码 | Enterprise@123 |
| 角色 | ENTERPRISE |
| 状态 | ACTIVE |
| 企业状态 | PENDING（待审核） |

## 使用方法

### 方法1：运行Seed脚本（推荐）

```bash
# 运行管理员seed脚本
npx tsx prisma/seed-admin.ts

# 或使用npm脚本（如果已配置）
npm run seed-admin
```

### 方法2：手动配置

1. 通过注册API创建用户账户
2. 直接修改数据库将用户角色设置为ADMIN

```sql
UPDATE users 
SET role = 'ADMIN', status = 'ACTIVE' 
WHERE email = 'admin@example.com';
```

## Seed脚本文件

- **文件位置**：`prisma/seed-admin.ts`
- **功能**：
  - 创建/更新管理员账户
  - 创建测试企业账户（用于审核测试）
  - 输出执行摘要

### Seed脚本特性

- 使用upsert操作，不会删除现有数据
- 密码使用bcrypt加密
- 自动创建测试企业账户
- 输出清晰的执行日志

## E2E测试辅助函数

### 管理员登录函数

```typescript
import { adminLogin } from '@/__tests__/e2e/enterprise-helpers';

// 在测试中使用
const { token, userId, email } = await adminLogin(apiContext);
```

### 企业审核函数

```typescript
import { reviewEnterprise } from '@/__tests__/e2e/enterprise-helpers';

// 通过企业审核
await reviewEnterprise(apiContext, adminToken, enterpriseId, {
  reviewAction: 'APPROVE',
  reviewNotes: '审核通过',
});

// 拒绝企业审核
await reviewEnterprise(apiContext, adminToken, enterpriseId, {
  reviewAction: 'REJECT',
  reviewNotes: '企业信息不完整',
});
```

## 企业审核测试

### 测试覆盖场景

1. **管理员成功通过企业审核**
2. **管理员成功拒绝企业审核**
3. **非管理员用户无法执行审核操作**（权限检查）

### 测试文件位置

- `src/__tests__/e2e/enterprise.spec.ts`
- `src/__tests__/e2e/enterprise-helpers.ts`

## 与Sprint 9.1.4的关系

### 当前实现（提前）

- ✅ 管理员账户创建（seed脚本）
- ✅ 管理员登录功能
- ✅ 企业审核API调用（已存在）

### Sprint 9.1.4完整实现包含

Sprint 9.1.4"用户角色管理"将实现完整的管理后台功能：

- 角色列表页面
- 角色详情页面
- 角色管理API（创建、编辑、删除角色）
- 角色权限配置API
- 用户角色分配UI

**注意**：当前提前实现的是最小化方案，仅支持E2E测试。Sprint 9.1.4仍需完整实现。

## 安全建议

### 生产环境

1. **立即修改默认密码**
   ```typescript
   // 在prisma/seed-admin.ts中修改
   const ADMIN_CONFIG = {
     password: 'YourStrongPassword123!', // 使用强密码
   };
   ```

2. **使用环境变量**
   ```typescript
   const ADMIN_CONFIG = {
     email: process.env.ADMIN_EMAIL || 'admin@example.com',
     password: process.env.ADMIN_PASSWORD || 'Admin@123',
   };
   ```

3. **删除或禁用测试账户**
   - `enterprise@example.com`测试账户应在生产环境中删除或禁用

## 故障排除

### 问题：Seed脚本执行失败

**可能原因**：
1. DATABASE_URL未配置
2. bcrypt依赖未安装
3. 数据库连接失败

**解决方案**：
```bash
# 检查.env文件
cat .env | grep DATABASE_URL

# 安装bcrypt
npm install bcrypt

# 测试数据库连接
npx prisma db push
```

### 问题：E2E测试失败

**可能原因**：
1. 管理员账户未创建
2. 企业审核API未实现或权限配置错误
3. Token无效或过期

**解决方案**：
1. 先运行seed脚本创建管理员账户
2. 检查`/api/admin/enterprise/[id]/review`是否存在
3. 检查权限中间件配置

## 相关文档

- [Sprint 8任务追踪](../task-tracking/SPRINT8_TASK_TRACKING.md)
- [Sprint 9规划](../task-tracking/SPRINT9_14_PLANNING.md)
- [企业认证测试报告](../reports/PHASE3_ENTERPRISE_TEST_REPORT.md)

## 版本历史

| 版本 | 日期 | 说明 |
|-----|------|------|
| 1.0 | 2026-01-12 | 初始版本，提前实现管理员账户功能 |
