import { NextRequest } from 'next/server';

/**
 * 创建符合Next.js Request接口的mock请求对象
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    correlationId?: string;
    userId?: string;
    userRole?: string;
    userEmail?: string;
  } = {}
) {
  const {
    method = 'GET',
    body,
    headers = {},
    correlationId,
    userId = 'test-user-id-123',
    userRole = 'USER',
    userEmail = 'test@example.com',
  } = options;

  // 创建headers对象
  const requestHeaders = new Headers({
    'content-type': 'application/json',
    'x-correlation-id': correlationId || 'test-correlation-id',
    // 添加mock认证信息
    'x-user-id': userId,
    'x-user-role': userRole,
    'x-user-email': userEmail,
    ...headers,
  });

  // 创建完全的mock请求对象
  const mockRequest = {
    url,
    method: method.toUpperCase(),
    headers: requestHeaders,
    nextUrl: new URL(url),
    cookies: {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
      delete: jest.fn(),
    },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    body: body ? JSON.stringify(body) : undefined,
    // 添加其他Request接口的必需属性
    clone: jest.fn(),
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
  };

  return mockRequest as unknown as NextRequest;
}

/**
 * 创建流式请求的mock对象
 */
export function createMockStreamRequest(
  url: string,
  options: {
    correlationId?: string;
    headers?: Record<string, string>;
  } = {}
) {
  const { correlationId, headers = {} } = options;

  return {
    url,
    headers: new Headers({
      'content-type': 'text/event-stream',
      'x-correlation-id': correlationId || 'test-correlation-id',
      ...headers,
    }),
    signal: {
      addEventListener: jest.fn(),
    },
  } as any;
}
