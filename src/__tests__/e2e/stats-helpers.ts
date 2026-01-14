/**
 * 统计系统E2E测试辅助函数
 */

import type { APIRequestContext } from '@playwright/test';
import jwt from 'jsonwebtoken';

// =============================================================================
// 测试基础URL
// =============================================================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 测试数据类型定义
// =============================================================================

/**
 * 响应数据基类
 */
interface BaseResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// =============================================================================
// 认证辅助函数
// =============================================================================

/**
 * 注册测试用户
 */
export async function registerTestUser(
  apiContext: APIRequestContext
): Promise<{ id: string; email: string; password: string; token: string }> {
  const timestamp = Date.now();
  const email = `test-${timestamp}@example.com`;
  const password = 'TestPass123';

  const response = await apiContext.post(`${BASE_URL}/api/auth/register`, {
    data: {
      email,
      password,
      username: `test${timestamp}`,
      name: `TestUser${timestamp}`,
    },
  });

  const data: BaseResponse<{
    user: { id: string; email: string; role: string };
    token: string;
  }> = await response.json();

  return {
    id: data.data?.user.id || '',
    email,
    password,
    token: data.data?.token || '',
  };
}

/**
 * 登录管理员用户
 */
export async function loginAdminUser(
  apiContext: APIRequestContext
): Promise<{ token: string }> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/login`, {
    data: {
      email: 'admin@example.com',
      password: 'Admin@123',
    },
  });

  // 先检查响应状态码
  if (response.status() !== 200) {
    // 如果状态码不是200，尝试获取错误信息
    const text = await response.text();
    throw new Error(
      `登录失败: HTTP ${response.status()} - ${text.substring(0, 100)}`
    );
  }

  const data: BaseResponse<{ token: string }> = await response.json();
  return { token: data.data?.token || '' };
}

/**
 * 获取管理员token（优先尝试login API，失败则使用备用方案）
 */
export async function getAdminToken(
  apiContext: APIRequestContext
): Promise<{ token: string }> {
  try {
    // 尝试通过login API获取token
    const { token } = await loginAdminUser(apiContext);
    return { token };
  } catch {
    // login API失败，使用备用方案直接生成token
    console.warn('⚠️ login API失败，使用备用token生成方案');

    const JWT_SECRET =
      process.env.JWT_SECRET || 'legal-debate-jwt-secret-key-development-only';

    const payload = {
      userId: 'cmkcffmfr00004yc4h9ijh3lj',
      email: 'admin@example.com',
      role: 'ADMIN',
    };

    // 生成15分钟的token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    return { token };
  }
}

// =============================================================================
// 用户统计API辅助函数
// =============================================================================

/**
 * 获取用户注册趋势
 */
export async function getUserRegistrationTrend(
  apiContext: APIRequestContext,
  token: string,
  params?: { timeRange?: string; granularity?: string }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.timeRange) searchParams.set('timeRange', params.timeRange);
  if (params?.granularity) searchParams.set('granularity', params.granularity);

  const response = await apiContext.get(
    `${BASE_URL}/api/stats/users/registration-trend?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

/**
 * 获取用户活跃度
 */
export async function getUserActivity(
  apiContext: APIRequestContext,
  token: string,
  params?: { timeRange?: string }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.timeRange) searchParams.set('timeRange', params.timeRange);

  const response = await apiContext.get(
    `${BASE_URL}/api/stats/users/activity?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

// =============================================================================
// 案件统计API辅助函数
// =============================================================================

/**
 * 获取案件类型分布
 */
export async function getCaseTypeDistribution(
  apiContext: APIRequestContext,
  token: string,
  params?: { timeRange?: string; status?: string }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.timeRange) searchParams.set('timeRange', params.timeRange);
  if (params?.status) searchParams.set('status', params.status);

  const response = await apiContext.get(
    `${BASE_URL}/api/stats/cases/type-distribution?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

/**
 * 获取案件效率统计
 */
export async function getCaseEfficiency(
  apiContext: APIRequestContext,
  token: string,
  params?: { timeRange?: string; caseType?: string }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.timeRange) searchParams.set('timeRange', params.timeRange);
  if (params?.caseType) searchParams.set('caseType', params.caseType);

  const response = await apiContext.get(
    `${BASE_URL}/api/stats/cases/efficiency?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

// =============================================================================
// 辩论统计API辅助函数
// =============================================================================

/**
 * 获取辩论生成次数
 */
export async function getDebateGenerationCount(
  apiContext: APIRequestContext,
  token: string,
  params?: { timeRange?: string; granularity?: string; status?: string }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.timeRange) searchParams.set('timeRange', params.timeRange);
  if (params?.granularity) searchParams.set('granularity', params.granularity);
  if (params?.status) searchParams.set('status', params.status);

  const response = await apiContext.get(
    `${BASE_URL}/api/stats/debates/generation-count?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

/**
 * 获取辩论质量评分
 */
export async function getDebateQualityScore(
  apiContext: APIRequestContext,
  token: string,
  params?:
    | { timeRange?: string; minConfidence?: number; maxConfidence?: number }
    | undefined
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.timeRange) searchParams.set('timeRange', params.timeRange);
  if (params?.minConfidence !== undefined)
    searchParams.set('minConfidence', String(params.minConfidence));
  if (params?.maxConfidence !== undefined)
    searchParams.set('maxConfidence', String(params.maxConfidence));

  const response = await apiContext.get(
    `${BASE_URL}/api/stats/debates/quality-score?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

// =============================================================================
// 性能统计API辅助函数
// =============================================================================

/**
 * 获取响应时间统计
 */
export async function getPerformanceResponseTime(
  apiContext: APIRequestContext,
  token: string,
  params?: { timeRange?: string; granularity?: string; provider?: string }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.timeRange) searchParams.set('timeRange', params.timeRange);
  if (params?.granularity) searchParams.set('granularity', params.granularity);
  if (params?.provider) searchParams.set('provider', params.provider);

  const response = await apiContext.get(
    `${BASE_URL}/api/stats/performance/response-time?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

/**
 * 获取错误率统计
 */
export async function getPerformanceErrorRate(
  apiContext: APIRequestContext,
  token: string,
  params?: { timeRange?: string; provider?: string; includeRecovered?: boolean }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.timeRange) searchParams.set('timeRange', params.timeRange);
  if (params?.provider) searchParams.set('provider', params.provider);
  if (params?.includeRecovered !== undefined)
    searchParams.set('includeRecovered', String(params.includeRecovered));

  const response = await apiContext.get(
    `${BASE_URL}/api/stats/performance/error-rate?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

// =============================================================================
// 数据导出API辅助函数
// =============================================================================

/**
 * 导出案件数据
 */
export async function exportCaseData(
  apiContext: APIRequestContext,
  token: string,
  params: { format: string; timeRange?: string }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  searchParams.set('format', params.format);
  if (params.timeRange) searchParams.set('timeRange', params.timeRange);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/export/cases?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  // 导出API返回文件，不是JSON，所以只检查状态码
  if (response.status() !== 200) {
    return {
      success: false,
      message: '请求失败',
      error: 'HTTP_ERROR',
    };
  }

  // 检查Content-Type是否正确
  const contentType = response.headers()['content-type'] || '';
  const validContentTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/octet-stream',
  ];

  if (!validContentTypes.some(type => contentType.includes(type))) {
    return {
      success: false,
      message: '返回的文件类型不正确',
      error: 'INVALID_CONTENT_TYPE',
    };
  }

  return {
    success: true,
    message: '导出成功',
    data: { contentType, contentLength: response.headers()['content-length'] },
  };
}

/**
 * 导出统计数据
 */
export async function exportStatsData(
  apiContext: APIRequestContext,
  token: string,
  params: { exportType: string; format: string; timeRange?: string }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  searchParams.set('exportType', params.exportType);
  searchParams.set('format', params.format);
  if (params.timeRange) searchParams.set('timeRange', params.timeRange);

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/export/stats?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  // 导出API返回文件，不是JSON，所以只检查状态码
  if (response.status() !== 200) {
    return {
      success: false,
      message: '请求失败',
      error: 'HTTP_ERROR',
    };
  }

  // 检查Content-Type是否正确
  const contentType = response.headers()['content-type'] || '';
  const validContentTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/json',
    'application/octet-stream',
  ];

  if (!validContentTypes.some(type => contentType.includes(type))) {
    return {
      success: false,
      message: '返回的文件类型不正确',
      error: 'INVALID_CONTENT_TYPE',
    };
  }

  return {
    success: true,
    message: '导出成功',
    data: { contentType, contentLength: response.headers()['content-length'] },
  };
}

// =============================================================================
// 报告系统API辅助函数
// =============================================================================

/**
 * 获取报告列表
 */
export async function getReportsList(
  apiContext: APIRequestContext,
  token: string,
  params?: { type?: string; status?: string; page?: number; limit?: number }
): Promise<BaseResponse<unknown>> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const response = await apiContext.get(
    `${BASE_URL}/api/admin/reports?${searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

/**
 * 创建报告
 */
export async function createReport(
  apiContext: APIRequestContext,
  token: string,
  params: {
    type: string;
    periodStart: string;
    periodEnd: string;
    format?: string;
  }
): Promise<BaseResponse<unknown>> {
  // 根据type设置triggerType
  const triggerType =
    params.type === 'WEEKLY'
      ? 'WEEKLY'
      : params.type === 'MONTHLY'
        ? 'MONTHLY'
        : undefined;

  const response = await apiContext.post(`${BASE_URL}/api/admin/reports`, {
    data: { ...params, triggerType },
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

/**
 * 获取报告详情
 */
export async function getReportDetail(
  apiContext: APIRequestContext,
  token: string,
  reportId: string
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.get(
    `${BASE_URL}/api/admin/reports/${reportId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}

/**
 * 删除报告
 */
export async function deleteReport(
  apiContext: APIRequestContext,
  token: string,
  reportId: string
): Promise<BaseResponse<unknown>> {
  const response = await apiContext.delete(
    `${BASE_URL}/api/admin/reports/${reportId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await response.json();
  if (response.status() !== 200) {
    return {
      success: false,
      message: data.message || '请求失败',
      error: data.error,
    };
  }
  return data;
}
