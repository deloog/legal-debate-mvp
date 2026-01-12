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
  } = {}
) {
  const { method = 'GET', body, headers = {}, correlationId } = options;

  // 创建符合Next.js Request接口的mock
  const request = new Request(url, {
    method,
    headers: new Headers({
      'content-type': 'application/json',
      'x-correlation-id': correlationId || 'test-correlation-id',
      ...headers,
    }),
    // 对于POST/PUT，需要序列化body
    body: body ? JSON.stringify(body) : undefined,
  });

  // 确保json()方法正确工作
  if (!request.json) {
    Object.defineProperty(request, 'json', {
      value: async () => body,
      writable: false,
    });
  }

  return request as NextRequest;
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
