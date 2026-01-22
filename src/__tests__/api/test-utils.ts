import { NextRequest } from 'next/server';

/**
 * 创建模拟的NextRequest对象
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options;

  const requestInit: RequestInit = {
    method,
    headers: {
      ...headers,
    },
  };

  // 只有当有body时才设置Content-Type头部
  if (body && method !== 'GET') {
    requestInit.body = JSON.stringify(body);
    // 如果没有明确设置Content-Type，则设置为application/json
    if (!requestInit.headers!['Content-Type']) {
      requestInit.headers!['Content-Type'] = 'application/json';
    }
  }

  const request = new NextRequest(url, requestInit);

  // 手动添加 nextUrl 属性，确保 API 代码可以访问 searchParams
  Object.defineProperty(request, 'nextUrl', {
    value: new URL(url),
    writable: false,
    enumerable: true,
  });

  return request;
}

/**
 * 创建带认证的模拟请求
 */
export function createAuthenticatedRequest(
  url: string,
  token: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  return createMockRequest(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

/**
 * 解析响应数据
 */
export async function parseResponse(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * 测试响应结构
 */
export interface TestResponse {
  status: number;
  headers: Headers;
  data: any;
  success: boolean;
  error?: any;
  meta?: any;
}

/**
 * 创建测试响应对象
 * 支持多种API响应格式：
 * 1. 标准格式: { success, data, meta }
 * 2. 嵌套格式: { success, data: { cases, total }, meta }
 */
export async function createTestResponse(
  response: Response
): Promise<TestResponse> {
  const parsedData = await parseResponse(response);

  // 检查data是否是包含特殊结构的对象
  const data = parsedData?.data;

  // 如果data包含cases和total字段，返回原始data对象（用于分页列表API）
  if (
    data &&
    typeof data === 'object' &&
    'cases' in data &&
    Array.isArray(data.cases)
  ) {
    return {
      status: response.status,
      headers: response.headers,
      data: data, // 返回完整的data对象，包含cases和total
      success: parsedData?.success || false,
      error: parsedData?.error,
      meta: parsedData?.meta,
    };
  }

  // 标准格式：data是实际数据
  return {
    status: response.status,
    headers: response.headers,
    data: data,
    success: parsedData?.success || false,
    error: parsedData?.error,
    meta: parsedData?.meta,
  };
}

/**
 * 常用测试断言
 */
export const assertions = {
  /**
   * 断言成功响应
   */
  assertSuccess: (response: TestResponse) => {
    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(response.error).toBeUndefined();
  },

  /**
   * 断言创建成功响应
   */
  assertCreated: (response: TestResponse) => {
    expect(response.status).toBe(201);
    expect(response.success).toBe(true);
    expect(response.error).toBeUndefined();
  },

  /**
   * 断言无内容响应
   * 注意：204响应没有body，所以这里直接检查Response对象
   */
  assertNoContent: (response: Response) => {
    expect(response.status).toBe(204);
  },

  /**
   * 断言错误响应
   */
  assertError: (response: TestResponse, expectedStatus?: number) => {
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    if (expectedStatus) {
      expect(response.status).toBe(expectedStatus);
    }
  },

  /**
   * 断言验证错误
   */
  assertValidationError: (response: TestResponse) => {
    assertions.assertError(response, 400);
    expect(response.error?.code).toBe('VALIDATION_ERROR');
  },

  /**
   * 断言未找到错误
   */
  assertNotFound: (response: TestResponse) => {
    assertions.assertError(response, 404);
    expect(response.error?.code).toBe('NOT_FOUND');
  },

  /**
   * 断言未授权错误
   */
  assertUnauthorized: (response: TestResponse) => {
    assertions.assertError(response, 401);
    expect(response.error?.code).toBe('UNAUTHORIZED');
  },

  /**
   * 断言禁止访问错误
   */
  assertForbidden: (response: TestResponse) => {
    assertions.assertError(response, 403);
    expect(response.error?.code).toBe('FORBIDDEN');
  },

  /**
   * 断言分页响应
   */
  assertPaginated: (response: TestResponse) => {
    assertions.assertSuccess(response);
    expect(response.meta?.pagination).toBeDefined();
    // data可能是数组也可能是对象
    if (Array.isArray(response.data)) {
      expect(true).toBe(true);
    } else if (Array.isArray(response.data?.data)) {
      expect(true).toBe(true);
    } else if (response.data?.cases && Array.isArray(response.data.cases)) {
      expect(true).toBe(true);
    } else {
      expect(response.data?.data).toBeDefined();
    }
  },
};

/**
 * 模拟数据生成器
 */
export const mockData = {
  /**
   * 生成UUID
   */
  uuid: () => '123e4567-e89b-12d3-a456-426614174000',

  /**
   * 生成案件数据
   */
  case: (overrides: Partial<any> = {}) => ({
    id: mockData.uuid(),
    title: '测试案件',
    description: '这是一个测试案件',
    type: 'civil',
    status: 'draft',
    ownerType: 'user',
    sharedWithTeam: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  /**
   * 生成用户数据
   */
  user: (overrides: Partial<any> = {}) => ({
    id: mockData.uuid(),
    email: 'test@example.com',
    username: 'testuser',
    role: 'lawyer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),

  /**
   * 生成辩论数据
   */
  debate: (overrides: Partial<any> = {}) => ({
    id: mockData.uuid(),
    title: '测试辩论',
    caseId: mockData.uuid(),
    status: 'active',
    config: {
      maxRounds: 3,
      timePerRound: 30,
      allowNewEvidence: true,
      debateMode: 'standard',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }),
};

/**
 * 环境变量模拟
 */
export function mockEnv(vars: Record<string, string>) {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ...vars };
  });

  afterEach(() => {
    process.env = originalEnv;
  });
}
