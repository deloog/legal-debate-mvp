/**
 * 企业认证E2E测试辅助函数
 */

import type { APIRequestContext } from '@playwright/test';

// =============================================================================
// 测试基础URL
// =============================================================================
const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // 浏览器环境
    return window.location.origin;
  }
  // Node.js环境
  return process.env.BASE_URL || 'http://localhost:3000';
};

// =============================================================================
// 测试数据类型定义
// =============================================================================

/**
 * 企业注册请求数据
 */
interface EnterpriseRegisterData {
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
}

/**
 * 企业上传资质请求数据
 */
interface EnterpriseQualificationUploadData {
  businessLicense: string;
}

/**
 * 企业审核请求数据
 */
interface EnterpriseReviewData {
  reviewAction: 'APPROVE' | 'REJECT' | 'SUSPEND' | 'REACTIVATE';
  reviewNotes?: string;
}

/**
 * 企业账号信息
 */
interface EnterpriseAccount {
  id: string;
  userId: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  status: string;
  submittedAt: Date | string;
  expiresAt: Date | null;
}

/**
 * API响应数据
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 生成测试企业数据
 */
export function generateTestEnterpriseData(): EnterpriseRegisterData {
  const timestamp = Date.now();
  return {
    enterpriseName: `测试企业${timestamp}`,
    creditCode: `91110000${timestamp.toString().slice(-10)}`,
    legalPerson: '张三',
    industryType: '信息技术',
  };
}

/**
 * 生成测试营业执照Base64数据
 */
export function generateTestBusinessLicense(): string {
  // 生成一个简单的测试图片（1x1像素的透明PNG）
  const pngBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  return pngBase64;
}

/**
 * 生成测试用户token（需要在测试中实际注册用户）
 */
export async function createTestUserAndLogin(
  apiContext: APIRequestContext
): Promise<{ userId: string; token: string; email: string }> {
  const timestamp = Date.now();
  const email = `enterprise-test-${timestamp}@example.com`;
  const password = 'TestPass123';

  // 注册用户
  const registerResponse = await apiContext.post(
    `${getBaseUrl()}/api/auth/register`,
    {
      data: {
        email,
        password,
        username: `enterprise${timestamp.toString().slice(-6)}`,
        name: `EnterpriseTest${timestamp.toString().slice(-6)}`,
      },
    }
  );

  const registerData = await registerResponse.json();
  const token = registerData.data?.token || '';
  const userId = registerData.data?.user?.id || '';

  return { userId, token, email };
}

/**
 * 注册企业账号
 */
export async function registerEnterprise(
  apiContext: APIRequestContext,
  token: string,
  data: EnterpriseRegisterData
): Promise<ApiResponse<{ enterprise: EnterpriseAccount }>> {
  const response = await apiContext.post(
    `${getBaseUrl()}/api/enterprise/register`,
    {
      data,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return await response.json();
}

/**
 * 获取企业账号信息
 */
export async function getEnterpriseInfo(
  apiContext: APIRequestContext,
  token: string
): Promise<ApiResponse<{ enterprise: EnterpriseAccount }>> {
  const response = await apiContext.get(`${getBaseUrl()}/api/enterprise/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return await response.json();
}

/**
 * 上传企业营业执照
 */
export async function uploadBusinessLicense(
  apiContext: APIRequestContext,
  token: string,
  data: EnterpriseQualificationUploadData
): Promise<ApiResponse<{ enterprise: EnterpriseAccount }>> {
  const response = await apiContext.post(
    `${getBaseUrl()}/api/enterprise/qualification/upload`,
    {
      data,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return await response.json();
}

/**
 * 审核企业账号（管理员）
 */
export async function reviewEnterprise(
  apiContext: APIRequestContext,
  adminToken: string,
  enterpriseId: string,
  data: EnterpriseReviewData
): Promise<ApiResponse<EnterpriseAccount>> {
  const response = await apiContext.post(
    `${getBaseUrl()}/api/admin/enterprise/${enterpriseId}/review`,
    {
      data,
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    }
  );

  return await response.json();
}

/**
 * 创建管理员用户
 */
export async function createAdminUser(
  apiContext: APIRequestContext
): Promise<{ userId: string; token: string }> {
  const timestamp = Date.now();
  const email = `admin-test-${timestamp}@example.com`;
  const password = 'AdminPass123';

  const response = await apiContext.post(`${getBaseUrl()}/api/auth/register`, {
    data: {
      email,
      password,
      username: `admin${timestamp.toString().slice(-6)}`,
      name: `AdminTest${timestamp.toString().slice(-6)}`,
    },
  });

  const data = await response.json();

  // 注意：这里假设注册后需要手动将用户设置为管理员角色
  // 实际使用时需要通过数据库或其他方式创建管理员用户
  return {
    userId: data.data?.user?.id || '',
    token: data.data?.token || '',
  };
}

/**
 * 等待企业状态变更（用于异步审核）
 */
export async function waitForEnterpriseStatus(
  apiContext: APIRequestContext,
  token: string,
  expectedStatus: string,
  maxAttempts = 10
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await getEnterpriseInfo(apiContext, token);
    if (data.success && data.data?.enterprise.status === expectedStatus) {
      return true;
    }
    // 等待500ms
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}
