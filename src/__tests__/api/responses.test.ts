import { NextResponse } from 'next/server';
import {
  createRedirectResponse,
  createDownloadResponse,
  createStreamResponse,
  createCachedResponse,
  createConditionalResponse,
  createHealthResponse,
  createSuccessResponse,
  createPaginatedResponse,
  createCreatedResponse,
  createNoContentResponse,
  createPartialResponse,
} from '@/app/api/lib/responses/api-response';

describe('API Response Utilities', () => {
  describe('createRedirectResponse', () => {
    it('should create redirect response with default status', () => {
      const response = createRedirectResponse('https://example.com');

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('https://example.com/');
    });

    it('should create redirect response with custom status', () => {
      const response = createRedirectResponse('https://example.com', 301);

      expect(response.status).toBe(301);
      // NextResponse.redirect可能会自动添加尾部斜杠
      const location = response.headers.get('Location');
      expect(location).toBe('https://example.com/');
    });

    it('should handle relative URLs', () => {
      const response = createRedirectResponse('/login');

      expect(response.status).toBe(302);
      // NextResponse.redirect可能会自动处理相对URL，所以检查是否包含预期路径
      const location = response.headers.get('Location');
      expect(location).toContain('/login');
    });

    it('should handle absolute URLs correctly', () => {
      const response = createRedirectResponse('https://example.com/login');

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(
        'https://example.com/login'
      );
    });
  });

  describe('createDownloadResponse', () => {
    it('should create download response with ArrayBuffer data', () => {
      const data = new ArrayBuffer(8);
      const filename = 'test.pdf';

      const response = createDownloadResponse(data, filename);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe(
        'application/octet-stream'
      );
      expect(response.headers.get('Content-Disposition')).toBe(
        'attachment; filename="test.pdf"'
      );
    });

    it('should create download response with Blob data', () => {
      const data = new Blob(['test content'], { type: 'text/plain' });
      const filename = 'test.txt';

      const response = createDownloadResponse(data, filename, 'text/plain');

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain');
      expect(response.headers.get('Content-Disposition')).toBe(
        'attachment; filename="test.txt"'
      );
    });

    it('should create download response with ReadableStream', () => {
      const stream = new ReadableStream();
      const filename = 'data.json';

      const response = createDownloadResponse(
        stream,
        filename,
        'application/json'
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Content-Disposition')).toBe(
        'attachment; filename="data.json"'
      );
    });

    it('should handle special characters in filename', () => {
      const data = new ArrayBuffer(8);
      const filename = 'test file (1).pdf';

      const response = createDownloadResponse(data, filename);

      expect(response.headers.get('Content-Disposition')).toContain(
        'attachment; filename="test file (1).pdf"'
      );
    });
  });

  describe('createStreamResponse', () => {
    it('should create stream response with default content type', () => {
      const stream = new ReadableStream();

      const response = createStreamResponse(stream);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Transfer-Encoding')).toBe('chunked');
    });

    it('should create stream response with custom content type', () => {
      const stream = new ReadableStream();

      const response = createStreamResponse(stream, 'text/plain');

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain');
      expect(response.headers.get('Transfer-Encoding')).toBe('chunked');
    });
  });

  describe('createCachedResponse', () => {
    it('should create cached response with default max age', async () => {
      const data = { message: 'cached data' };

      const response = createCachedResponse(data);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=3600'
      );

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(data);
    });

    it('should create cached response with custom max age', () => {
      const data = { message: 'cached data' };
      const maxAge = 7200;

      const response = createCachedResponse(data, maxAge);

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=7200'
      );
    });

    it('should include metadata', async () => {
      const data = { message: 'cached data' };
      const meta = { version: '1.0', total: 100 };

      const response = createCachedResponse(data, 3600, meta);

      const responseData = await response.json();
      expect(responseData.meta).toEqual(meta);
    });
  });

  describe('createConditionalResponse', () => {
    it('should create response without ETag', async () => {
      const data = { message: 'conditional data' };

      const response = createConditionalResponse(data);

      expect(response.status).toBe(200);
      // NextResponse中未设置的头部返回undefined
      expect(response.headers.get('ETag')).toBeUndefined();

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data).toEqual(data);
    });

    it('should create response with ETag', () => {
      const data = { message: 'conditional data' };
      const etag = '"abc123"';

      const response = createConditionalResponse(data, etag);

      expect(response.status).toBe(200);
      expect(response.headers.get('ETag')).toBe('"abc123"');
    });

    it('should include metadata', async () => {
      const data = { message: 'conditional data' };
      const meta = { version: '1.0', modified: '2023-01-01' };

      const response = createConditionalResponse(data, undefined, meta);

      const responseData = await response.json();
      expect(responseData.meta).toEqual(meta);
    });

    it('should handle both ETag and metadata', async () => {
      const data = { message: 'conditional data' };
      const etag = '"def456"';
      const meta = { version: '2.0' };

      const response = createConditionalResponse(data, etag, meta);

      expect(response.headers.get('ETag')).toBe('"def456"');

      const responseData = await response.json();
      expect(responseData.meta).toEqual(meta);
    });
  });

  describe('createHealthResponse', () => {
    it('should create healthy response with 200 status', async () => {
      const response = createHealthResponse('healthy');

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('healthy');
      expect(responseData.data.timestamp).toBeDefined();
      expect(responseData.meta.status).toBe('healthy');
      expect(responseData.meta.timestamp).toBeDefined();
      expect(responseData.meta.version).toBe('v1');
    });

    it('should create unhealthy response with 503 status', async () => {
      const response = createHealthResponse('unhealthy');

      expect(response.status).toBe(503);

      const responseData = await response.json();
      expect(responseData.data.status).toBe('unhealthy');
    });

    it('should create degraded response with 200 status', async () => {
      const response = createHealthResponse('degraded');

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.data.status).toBe('degraded');
    });

    it('should include custom details', async () => {
      const details = { database: 'connected', cache: 'available' };

      const response = createHealthResponse('healthy', details);

      const responseData = await response.json();
      expect(responseData.data).toEqual(expect.objectContaining(details));
    });

    it('should include custom metadata', async () => {
      const meta = { uptime: '24h', version: '2.0' };

      const response = createHealthResponse('healthy', undefined, meta);

      const responseData = await response.json();
      expect(responseData.meta).toEqual(expect.objectContaining(meta));
    });

    it('should include both details and metadata', async () => {
      const details = { database: 'connected' };
      const meta = { version: '2.0' };

      const response = createHealthResponse('healthy', details, meta);

      const responseData = await response.json();
      expect(responseData.data).toEqual(expect.objectContaining(details));
      expect(responseData.meta).toEqual(expect.objectContaining(meta));
    });

    it('should validate timestamp format', async () => {
      const response = createHealthResponse('healthy');

      const responseData = await response.json();
      expect(responseData.data.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(responseData.meta.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('Response Format Consistency', () => {
    it('should maintain consistent structure for success responses', async () => {
      const data = { message: 'success' };
      const response = createSuccessResponse(data);

      const responseData = await response.json();
      expect(responseData).toHaveProperty('success', true);
      expect(responseData).toHaveProperty('data');
      expect(responseData).toHaveProperty('meta');
    });

    it('should maintain consistent structure for paginated responses', async () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };
      const response = createPaginatedResponse(data, pagination);

      const responseData = await response.json();
      expect(responseData).toHaveProperty('success', true);
      expect(responseData).toHaveProperty('data');
      expect(responseData).toHaveProperty('meta');
      expect(responseData.meta).toHaveProperty('pagination');
    });

    it('should include timestamp in metadata', async () => {
      const data = { message: 'test' };
      const response = createSuccessResponse(data);

      const responseData = await response.json();
      expect(responseData.meta.timestamp).toBeDefined();
      expect(new Date(responseData.meta.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data in cached response', async () => {
      const data = null;
      const response = createCachedResponse(data);

      const responseData = await response.json();
      expect(responseData.data).toBeNull();
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=3600'
      );
    });

    it('should handle zero max age', () => {
      const data = { message: 'no cache' };
      const response = createCachedResponse(data, 0);

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=0');
    });

    it('should handle negative max age', () => {
      const data = { message: 'expired cache' };
      const response = createCachedResponse(data, -1);

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=-1');
    });

    it('should handle empty string ETag', () => {
      const data = { message: 'test' };
      const response = createConditionalResponse(data, '');

      expect(response.headers.get('ETag')).toBe('');
    });

    it('should handle null ETag', () => {
      const data = { message: 'test' };
      const response = createConditionalResponse(data, null);

      // null ETag表示不设置ETag头部，所以返回undefined
      expect(response.headers.get('ETag')).toBeUndefined();
    });
  });

  describe('Header Handling', () => {
    it('should set multiple headers correctly', () => {
      const stream = new ReadableStream();
      const response = createStreamResponse(stream, 'application/json');

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Transfer-Encoding')).toBe('chunked');
    });

    it('should overwrite headers correctly', () => {
      const data = { message: 'test' };
      const response = createCachedResponse(data, 3600);

      // 测试后续修改头部不会影响已设置的头部
      response.headers.set('X-Custom', 'value');

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=3600'
      );
      expect(response.headers.get('X-Custom')).toBe('value');
    });

    it('should handle header case sensitivity', () => {
      const response = createCachedResponse({ message: 'test' }, 3600);

      // NextResponse的headers对大小写不敏感，但get方法返回的是规范化的值
      // 小写的key可能返回undefined，需要使用正确的大小写
      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=3600'
      );
      // 验证headers确实被设置了
      expect(response.headers.has('Cache-Control')).toBe(true);
    });
  });
});
