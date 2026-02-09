/**
 * 管理员角色类型定义
 * 集中定义管理员角色相关的类型
 */

/**
 * 角色详情响应
 */
export interface RoleDetailResponse {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  permissions: Array<{
    id: string;
    name: string;
    description: string | null;
    resource: string;
    action: string;
  }>;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 角色列表查询参数
 */
export interface RoleListQueryParams {
  page?: string;
  pageSize?: string;
  keyword?: string;
  search?: string; // 兼容旧参数名
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 创建角色请求
 */
export interface CreateRoleRequest {
  name: string;
  description?: string;
  isDefault?: boolean;
  permissionIds?: string[];
}

/**
 * 角色列表响应
 */
export interface RoleListResponse {
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    permissions: Array<{
      id: string;
      name: string;
      description: string | null;
    }>;
    userCount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 权限列表响应
 */
export interface PermissionsListResponse {
  permissions: Array<{
    id: string;
    name: string;
    resource: string;
    action: string;
    description: string;
  }>;
  total: number;
}

/**
 * 权限列表响应（包含时间戳）
 */
export interface PermissionListResponse {
  permissions: Array<{
    id: string;
    name: string;
    description: string | null;
    resource: string;
    action: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

/**
 * 分配权限请求
 */
export interface AssignPermissionRequest {
  permissionId: string;
}

/**
 * 批量分配权限请求
 */
export interface BatchAssignPermissionsRequest {
  permissionIds: string[];
}

/**
 * 批量撤销权限请求
 */
export interface BatchRevokePermissionsRequest {
  permissionIds: string[];
}
