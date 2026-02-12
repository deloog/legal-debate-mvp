# 类型一致性扩展修复技术设计文档

## 1. 概述

本文档是 `TYPE_CONSISTENCY_FIX_DESIGN.md` 的扩展，涵盖剩余模块的类型一致性修复。

## 2. 问题分析

### 2.1 剩余问题模块清单

| 模块                  | 文件数 | 主要问题                                                                  |
| --------------------- | ------ | ------------------------------------------------------------------------- |
| consultations         | 6      | ConsultationDetailResponse、SuccessResponse、ErrorResponse 重复定义       |
| admin/users           | 5      | UserDetailResponse、UpdateUserRequest、UserStatistics 重复定义            |
| admin/roles           | 4      | RoleDetailResponse、RoleListResponse、CreateRoleRequest 重复定义          |
| admin/memberships     | 5      | MembershipDetailResponse、UpdateMembershipRequest 重复定义                |
| admin/orders          | 4      | OrderDetailResponse、OrderListResponse、UpdateOrderStatusRequest 重复定义 |
| admin/enterprise      | 2      | EnterpriseDetail、EnterpriseListItem 重复定义                             |
| contracts             | 3      | SuccessResponse、ErrorResponse 重复定义                                   |
| teams                 | 1      | TeamListResponse 重复定义                                                 |
| tasks                 | 1      | TaskListResponse 重复定义                                                 |
| users/search          | 1      | UserSearchResult、SearchResponse 重复定义                                 |
| memberships (非admin) | 3      | UpgradeRequestBody、DowngradeRequestBody、CancelRequestBody 重复定义      |
| notifications         | 1      | RouteParams 重复定义                                                      |
| evidence              | 2      | CrossExaminationRequest、ChainAnalysisRequest 重复定义                    |
| debate                | 1      | StreamGeneratorConfig 重复定义                                            |
| case-type-configs     | 1      | CaseTypeConfigResponse、QueryParams 重复定义                              |
| v1 modules            | 10+    | 各种请求/响应类型重复定义                                                 |

### 2.2 问题严重程度分类

**高优先级**（核心业务模块）：

- consultations
- admin/users
- admin/roles
- admin/memberships
- admin/orders

**中优先级**（辅助业务模块）：

- contracts
- teams
- tasks
- users/search

**低优先级**（基础设施模块）：

- notifications
- evidence
- debate
- v1 modules

## 3. 修复策略

### 3.1 通用响应类型集中化

创建 `src/types/api-response.ts` 集中定义通用响应类型：

```typescript
// 通用成功响应
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

// 通用错误响应
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

### 3.2 各模块类型文件扩展

#### consultations 模块

- 文件：`src/types/consultation.ts`
- 新增类型：`ConsultationDetailResponse`、`ConsultationListResponse`、`CreateConsultationRequest` 等

#### admin/users 模块

- 文件：`src/types/admin-user.ts`（新建）
- 新增类型：`UserDetailResponse`、`UserListResponse`、`UpdateUserRequest` 等

#### admin/roles 模块

- 文件：`src/types/admin-role.ts`（新建）
- 新增类型：`RoleDetailResponse`、`RoleListResponse`、`CreateRoleRequest` 等

#### admin/memberships 模块

- 文件：`src/types/admin-membership.ts`（新建）
- 新增类型：`MembershipDetailResponse`、`MembershipListResponse` 等

#### admin/orders 模块

- 文件：`src/types/admin-order.ts`（新建）
- 新增类型：`OrderDetailResponse`、`OrderListResponse` 等

#### admin/enterprise 模块

- 文件：`src/types/admin-enterprise.ts`（新建）
- 新增类型：`EnterpriseDetail`、`EnterpriseListResponse` 等

## 4. 实施计划

### 阶段1：创建集中式类型文件

1. 创建 `src/types/api-response.ts`
2. 扩展 `src/types/consultation.ts`
3. 创建 `src/types/admin-user.ts`
4. 创建 `src/types/admin-role.ts`
5. 创建 `src/types/admin-membership.ts`
6. 创建 `src/types/admin-order.ts`
7. 创建 `src/types/admin-enterprise.ts`

### 阶段2：修改API路由文件

按模块顺序修改API路由文件，移除本地类型定义，导入集中式类型

### 阶段3：验证

1. 运行 TypeScript 编译检查
2. 运行 ESLint 检查
3. 运行相关测试

## 5. 风险评估

### 5.1 技术风险

- **类型变更影响范围广**：修改可能影响多个文件
- **向后兼容性**：需要确保修改不影响现有功能

### 5.2 缓解措施

- 分批次修改，每批修改后进行验证
- 保留备份，确保可以回滚
- 编写详细的变更日志

## 6. 验收标准

1. 所有高优先级模块的类型定义集中到 `src/types/` 目录
2. API路由文件中无重复的类型定义（通用响应类型除外）
3. TypeScript 编译无错误
4. ESLint 检查通过
5. 现有功能不受影响

## 7. 参考文档

- `docs/TYPE_CONSISTENCY_FIX_DESIGN.md` - 原始设计文档
- `docs/API_DEVELOPMENT_GUIDE.md` - API开发指南
- `src/types/` - 现有类型定义目录
