/**
 * 中间件安全测试
 * 测试CORS、安全头和速率限制功能
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
  corsMiddleware, 
  securityMiddleware, 
  rateLimitMiddleware 
} = require('../../app/api/lib/middleware/security');

describe('Middleware Security Tests', () => {
  describe('CORS Middleware', () => {
    it('应该处理OPTIONS预检请求', async () => {
      const request = new global.Request('http://localhost:3000/api/test', {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:3000',
        },
      });
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await corsMiddleware(request, context, response);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization, X-Requested-With, Accept, Origin');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('应该为常规请求添加CORS头', async () => {
      const request = new global.Request('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          origin: 'http://localhost:3000',
        },
      });
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await corsMiddleware(request, createRequestContext(request), response);
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('应该处理没有origin头的请求', async () => {
      const request = new global.Request('http://localhost:3000/api/test', {
        method: 'GET',
      });
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await corsMiddleware(request, context, response);
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });
  });

  describe('Security Middleware', () => {
    it('应该添加安全头', async () => {
      const request = new global.Request('http://localhost:3000/api/test');
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await securityMiddleware(request, context, response);
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
      expect(response.headers.get('X-API-Version')).toBe('v1');
    });

    it('应该包含环境头', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'test';

      const request = new global.Request('http://localhost:3000/api/test');
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await securityMiddleware(request, context, response);
      
      expect(response.headers.get('X-Node-Environment')).toBe('test');

      // 恢复原始环境
      (process.env as any).NODE_ENV = originalEnv;
    });
  });

  describe('Rate Limit Middleware', () => {
    beforeEach(() => {
      // 在测试之间清除速率限制器状态
      jest.resetModules();
    });

    it('应该允许限制内的请求', async () => {
      const request = new global.Request('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await rateLimitMiddleware(request, context, response);
      
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('98'); // 修复计算逻辑
      expect(response.headers.get('X-RateLimit-Reset')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('应该在使用x-real-ip头时可用', async () => {
      const request = new global.Request('http://localhost:3000/api/test', {
        headers: {
          'x-real-ip': '10.0.0.1',
        },
      });
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await rateLimitMiddleware(request, context, response);
      
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('98');
    });

    it('应该将IP默认为localhost', async () => {
      const request = new global.Request('http://localhost:3000/api/test');
      const context = createRequestContext(request);

      const response = MockNextResponse.next();
      await rateLimitMiddleware(request, context, response);
      
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('98');
    });

    it('应该在超过限制时返回429', async () => {
      const request = new global.Request('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.2',
        },
      });
      const context = createRequestContext(request);

      // 测试超过限制时速率限制抛出错误
      let errorThrown = false;
      try {
        // 模拟超过速率限制
        for (let i = 0; i < 101; i++) {
          const response = MockNextResponse.next();
          await rateLimitMiddleware(request, context, response);
        }
      } catch (error) {
        errorThrown = true;
        expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(error.message).toBe('Too many requests, please try again later');
      }

      expect(errorThrown).toBe(true);
    });
  });
});
