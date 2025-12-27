/**
 * 中间件日志和版本测试
 * 测试日志记录、响应时间和版本检测功能
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  MockRequest, 
  MockResponse, 
  MockHeaders, 
  MockNextResponse 
} from './middleware-simple-mocks.test';

// 现在导入和测试中间件
const { createRequestContext } = require('../../app/api/lib/middleware/core');

const { 
  loggingMiddleware, 
  responseTimeMiddleware, 
  versionMiddleware 
} = require('../../app/api/lib/middleware/logging');

describe('Middleware Logging Tests', () => {
  describe('Logging Middleware', () => {
    it('应该记录请求信息', async () => {
      const request = new global.Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'user-agent': 'Test-Agent',
          'x-forwarded-for': '192.168.1.1',
        },
      });
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await loggingMiddleware(request, context, response);

      expect(response).toBeDefined();
      expect(console.log).toHaveBeenCalledWith('API Request Started:', {
        requestId: context.requestId,
        method: 'POST',
        url: 'http://localhost:3000/api/test',
        userAgent: 'Test-Agent',
        ip: '192.168.1.1',
        timestamp: expect.any(String),
      });
    });

    it('应该优雅处理缺失的头信息', async () => {
      const request = new global.Request('http://localhost:3000/api/test', {
        method: 'GET',
      });
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await loggingMiddleware(request, context, response);

      expect(response).toBeDefined();
      expect(console.log).toHaveBeenCalledWith('API Request Started:', {
        requestId: context.requestId,
        method: 'GET',
        url: 'http://localhost:3000/api/test',
        userAgent: 'Unknown',
        ip: '127.0.0.1',
        timestamp: expect.any(String),
      });
    });
  });

  describe('Response Time Middleware', () => {
    it('应该添加响应时间头', async () => {
      const request = new global.Request('http://localhost:3000/api/test');
      const context = createRequestContext(request);
      const response = MockNextResponse.next();

      await responseTimeMiddleware(request, context, response);

      const headers = response.header || response.headers;
      expect(headers.get('X-Response-Time')).toMatch(/^\d+ms$/);
      expect(headers.get('X-Request-ID')).toBe(context.requestId);
    });
  });

  describe('Version Middleware', () => {
    it('应该从v1路径提取版本', async () => {
      const request = new global.Request('http://localhost:3000/api/v1/test');
      const context = createRequestContext(request);
      const response = MockNextResponse.next();
      
      await versionMiddleware(request, context, response);

      expect(response.headers.get('API-Version')).toBe('v1');
      expect(response.headers.get('X-API-Version')).toBe('v1');
    });

    it('应该从v2路径提取版本', async () => {
      const request = new global.Request('http://localhost:3000/api/v2/test');
      const context = createRequestContext(request);
      const response = MockNextResponse.next();
      
      await versionMiddleware(request, context, response);

      expect(response.headers.get('API-Version')).toBe('v2');
      expect(response.headers.get('X-API-Version')).toBe('v2');
    });

    it('应该将非版本化路径默认为v1', async () => {
      const request = new global.Request('http://localhost:3000/api/test');
      const context = createRequestContext(request);
      const response = MockNextResponse.next();
      
      await versionMiddleware(request, context, response);

      expect(response.headers.get('API-Version')).toBe('v1');
      expect(response.headers.get('X-API-Version')).toBe('v1');
    });
  });
});
