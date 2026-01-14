/**
 * 管理后台E2E测试辅助函数
 */

import type { APIRequestContext } from '@playwright/test';

// =============================================================================
// 测试基础URL
// =============================================================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 测试数据类型定义
// =============================================================================

/**
 * 测试管理员用户
 */
export interface AdminTestUser {
  id: string;
  email: string;
  password: string;
  username?: string;
  name?: string;
  role: string;
  token?: string;
  refreshToken?: string;
}

/**
 * 响应数据基类
 */
interface BaseResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * 用户列表响应数据
 */
interface UsersListResponse {
  users: Array<{
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    role: string;
    status: string;
    createdAt: Date | string;
    lastLoginAt: Date | string | null;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 角色列表响应数据
 */
interface RolesListResponse {
  roles: Array<{
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    createdAt: Date | string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 案件列表响应数据
 */
interface CasesListResponse {
  cases: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    caseNumber: string | null;
    createdAt: Date | string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 法条列表响应数据
 */
interface LawArticlesListResponse {
  articles: Array<{
    id: string;
    name: string;
    articleNumber: string;
    lawType: string;
    category: string | null;
    status: string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 错误日志响应数据
 */
interface ErrorLogsResponse {
  logs: Array<{
    id: string;
    userId: string | null;
    errorType: string;
    errorMessage: string;
    severity: string;
    createdAt: Date | string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 操作日志响应数据
 */
interface ActionLogsResponse {
  logs: Array<{
    id: string;
    userId: string;
    actionType: string;
    description: string;
    resourceType: string | null;
    createdAt: Date | string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 配置列表响应数据
 */
interface ConfigsListResponse {
  configs: Array<{
    id: string;
    key: string;
    value: string;
    type: string;
    category: string;
    isPublic: boolean;
    description: string | null;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 资格列表响应数据
 */
interface QualificationsListResponse {
  qualifications: Array<{
    id: string;
    licenseNumber: string;
    fullName: string;
    lawFirm: string;
    status: string;
    submittedAt: Date | string;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// =============================================================================
// 认证辅助函数
// =============================================================================

/**
 * 注册测试用户
 */
export async function registerTestUser(
  apiContext: APIRequestContext,
  role: string = 'USER'
): Promise<AdminTestUser> {
  const timestamp = Date.now();
  const shortId = String(timestamp).slice(-6);
  const email = `test-${timestamp}@example.com`;
  const password = 'TestPass123';

  const response = await apiContext.post(`${BASE_URL}/api/auth/register`, {
    data: {
      email,
      password,
      username: `test${shortId}`,
      name: `TestUser${shortId}`,
    },
  });

  // 检查响应内容类型
  const contentType = response.headers()['content-type'];
  if (!contentType?.includes('application/json')) {
    const text = await response.text();
    console.error('[registerTestUser] 非JSON响应:', text);
    throw new Error(
      `注册API返回非JSON响应 (Content-Type: ${contentType}): ${text.slice(0, 200)}`
    );
  }

  const data: BaseResponse<{
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
      role: string;
      createdAt: Date | string;
    };
    token: string;
    refreshToken: string;
  }> = await response.json();

  return {
    id: data.data?.user.id || '',
    email,
    password,
    username: `test${shortId}`,
    name: `TestUser${shortId}`,
    role: data.data?.user.role || role,
    token: data.data?.token,
    refreshToken: data.data?.refreshToken,
  };
}

/**
 * 登录用户
 */
export async function loginAdminUser(
  apiContext: APIRequestContext,
  email: string,
  password: string
): Promise<{ token: string; refreshToken: string }> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });

  const data: BaseResponse<{
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
      role: string;
      createdAt: Date | string;
    };
    token: string;
    refreshToken: string;
  }> = await response.json();

  return {
    token: data.data?.token || '',
    refreshToken: data.data?.refreshToken || '',
  };
}

/**
 * 获取当前用户信息
 */
export async function getCurrentAdminUser(
  apiContext: APIRequestContext,
  token: string
): Promise<AdminTestUser> {
  const response = await apiContext.get(`${BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data: BaseResponse<{
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
      role: string;
      status: string;
      createdAt: Date | string;
      updatedAt: Date | string;
    };
  }> = await response.json();

  return {
    id: data.data?.user.id || '',
    email: data.data?.user.email || '',
    password: '',
    username: data.data?.user.username || '',
    name: data.data?.user.name || '',
    role: data.data?.user.role || '',
    token,
  };
}

// =============================================================================
// 用户管理API辅助函数
// =============================================================================

/**
 * 获取用户列表
 */
export async function getUsersList(
  apiContext: APIRequestContext,
  token: string,
  params?: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    search?: string;
  }
): Promise<BaseResponse<UsersListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.role) searchParams.set('role', params.role);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/users?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 获取用户详情
 */
export async function getUserDetail(
  apiContext: APIRequestContext,
  token: string,
  userId: string
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.get(
    `${BASE_URL}/api/admin/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 更新用户角色
 */
export async function updateUserRole(
  apiContext: APIRequestContext,
  token: string,
  userId: string,
  role: string
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.put(
    `${BASE_URL}/api/admin/users/${userId}/role`,
    {
      data: { role },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

// =============================================================================
// 案件管理API辅助函数
// =============================================================================

/**
 * 获取案件列表
 */
export async function getCasesList(
  apiContext: APIRequestContext,
  token: string,
  params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    search?: string;
  }
): Promise<BaseResponse<CasesListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/cases?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 删除案件
 */
export async function deleteCase(
  apiContext: APIRequestContext,
  token: string,
  caseId: string
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.delete(
    `${BASE_URL}/api/admin/cases/${caseId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

// =============================================================================
// 法条管理API辅助函数
// =============================================================================

/**
 * 获取法条列表
 */
export async function getLawArticlesList(
  apiContext: APIRequestContext,
  token: string,
  params?: {
    page?: number;
    limit?: number;
    lawType?: string;
    category?: string;
    status?: string;
    search?: string;
  }
): Promise<BaseResponse<LawArticlesListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.lawType) searchParams.set('lawType', params.lawType);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/law-articles?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 导入法条
 */
export async function importLawArticles(
  apiContext: APIRequestContext,
  token: string,
  articles: Array<{
    name: string;
    articleNumber: string;
    content: string;
    lawType: string;
    category: string;
  }>
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.post(
    `${BASE_URL}/api/admin/law-articles/import`,
    {
      data: { articles },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 审核法条
 */
export async function reviewLawArticle(
  apiContext: APIRequestContext,
  token: string,
  articleId: string,
  approved: boolean
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.post(
    `${BASE_URL}/api/admin/law-articles/${articleId}/review`,
    {
      data: { approved },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

// =============================================================================
// 日志管理API辅助函数
// =============================================================================

/**
 * 获取错误日志列表
 */
export async function getErrorLogsList(
  apiContext: APIRequestContext,
  token: string,
  params?: {
    page?: number;
    limit?: number;
    errorType?: string;
    severity?: string;
    userId?: string;
    startTime?: string;
    endTime?: string;
    search?: string;
  }
): Promise<BaseResponse<ErrorLogsResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.errorType) searchParams.set('errorType', params.errorType);
  if (params?.severity) searchParams.set('severity', params.severity);
  if (params?.userId) searchParams.set('userId', params.userId);
  if (params?.startTime) searchParams.set('startTime', params.startTime);
  if (params?.endTime) searchParams.set('endTime', params.endTime);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/error-logs?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 获取操作日志列表
 */
export async function getActionLogsList(
  apiContext: APIRequestContext,
  token: string,
  params?: {
    page?: number;
    limit?: number;
    actionType?: string;
    actionCategory?: string;
    userId?: string;
    resourceType?: string;
    startTime?: string;
    endTime?: string;
    search?: string;
  }
): Promise<BaseResponse<ActionLogsResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.actionType) searchParams.set('actionType', params.actionType);
  if (params?.actionCategory)
    searchParams.set('actionCategory', params.actionCategory);
  if (params?.userId) searchParams.set('userId', params.userId);
  if (params?.resourceType)
    searchParams.set('resourceType', params.resourceType);
  if (params?.startTime) searchParams.set('startTime', params.startTime);
  if (params?.endTime) searchParams.set('endTime', params.endTime);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/action-logs?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

// =============================================================================
// 角色管理API辅助函数
// =============================================================================

/**
 * 获取角色列表
 */
export async function getRolesList(
  apiContext: APIRequestContext,
  token: string,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
  }
): Promise<BaseResponse<RolesListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/roles?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 获取权限列表
 */
export async function getPermissionsList(
  apiContext: APIRequestContext,
  token: string
): Promise<
  BaseResponse<Array<{ id: string; name: string; description: string }>>
> {
  const response = await apiContext.get(`${BASE_URL}/api/admin/permissions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

// =============================================================================
// 系统配置API辅助函数
// =============================================================================

/**
 * 获取配置列表
 */
export async function getConfigsList(
  apiContext: APIRequestContext,
  token: string,
  params?: {
    page?: number;
    limit?: number;
    category?: string;
    type?: string;
    isPublic?: boolean;
    search?: string;
  }
): Promise<BaseResponse<ConfigsListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.category) searchParams.set('category', params.category);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.isPublic !== undefined)
    searchParams.set('isPublic', String(params.isPublic));
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/configs?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 创建配置
 */
export async function createConfig(
  apiContext: APIRequestContext,
  token: string,
  config: {
    key: string;
    value: string;
    type: string;
    category: string;
    description?: string;
  }
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.post(`${BASE_URL}/api/admin/configs`, {
    data: config,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 更新配置
 */
export async function updateConfig(
  apiContext: APIRequestContext,
  token: string,
  key: string,
  value: string
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.put(
    `${BASE_URL}/api/admin/configs/${key}`,
    {
      data: { value },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

// =============================================================================
// 律师资格审核API辅助函数
// =============================================================================

/**
 * 获取资格列表
 */
export async function getQualificationsList(
  apiContext: APIRequestContext,
  token: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }
): Promise<BaseResponse<QualificationsListResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/qualifications?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

/**
 * 审核资格
 */
export async function reviewQualification(
  apiContext: APIRequestContext,
  token: string,
  qualificationId: string,
  approved: boolean,
  reviewNotes?: string
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.post(
    `${BASE_URL}/api/admin/qualifications/${qualificationId}/review`,
    {
      data: { approved, reviewNotes },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error || '未知错误',
    };
  }

  return data;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 生成测试邮箱
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}@example.com`;
}

/**
 * 生成测试密码
 */
export function generateTestPassword(): string {
  return `TestPass${Date.now() % 10000}`;
}

/**
 * 等待指定时间
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
