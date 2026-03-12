/**
 * 管理员用户类型定义
 * 集中定义管理员用户相关的类型
 */

import { UserRole, UserStatus } from './auth';

/**
 * 用户更新请求体
 */
export interface UpdateUserRequest {
  username?: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  phone?: string;
  address?: string;
  bio?: string;
}

/**
 * 用户详情响应数据
 */
export interface UserDetailResponse {
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    role: string;
    status: string;
    phone: string | null;
    address: string | null;
    bio: string | null;
    avatar: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
    loginCount: number;
    emailVerified: Date | null;
  };
  lawyerQualification: {
    id: string;
    licenseNumber: string;
    fullName: string;
    lawFirm: string;
    status: string;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewNotes: string | null;
  } | null;
  enterpriseAccount: {
    id: string;
    enterpriseName: string;
    creditCode: string;
    legalPerson: string;
    industryType: string;
    status: string;
    submittedAt: Date;
    reviewedAt: Date | null;
    expiresAt: Date | null;
  } | null;
  statistics: {
    casesCount: number;
    debatesCount: number;
    documentsCount: number;
  };
}

/**
 * 用户统计信息
 */
export interface UserStatistics {
  casesCount: number;
  debatesCount: number;
  documentsCount: number;
}

/**
 * 用户列表查询参数
 */
export interface UserListQueryParams {
  page?: string;
  pageSize?: string;
  status?: string;
  role?: string;
  keyword?: string;
  search?: string; // 兼容旧参数名
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 用户列表响应
 */
export interface UserListResponse {
  users: Array<{
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    role: string;
    status: string;
    phone: string | null;
    createdAt: Date;
    lastLoginAt: Date | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 分配角色请求
 */
export interface AssignRoleRequest {
  role: string;
}

/**
 * 用户角色响应
 */
export interface UserRoleResponse {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 批量分配角色请求
 */
export interface BatchAssignRoleRequest {
  userIds: string[];
  role: string;
}

/**
 * 批量分配结果
 */
export interface BatchAssignResult {
  success: boolean;
  message: string;
  assignedCount: number;
}

/**
 * 单个用户分配角色结果
 */
export interface UserAssignResult {
  success: boolean;
  userId: string;
  email: string;
  message?: string;
}

/**
 * 批量分配角色详细结果
 */
export interface BatchAssignDetailResult {
  total: number;
  success: number;
  failed: number;
  results: UserAssignResult[];
}

/**
 * 用户搜索结果
 */
export interface UserSearchResult {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: string;
  status: string;
}

/**
 * 搜索响应
 */
export interface SearchResponse {
  users: UserSearchResult[];
  total: number;
}
