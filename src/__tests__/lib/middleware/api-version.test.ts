/**
 * API 版本中间件单元测试
 * TDD 红阶段 - 先写测试再实现
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withApiVersion,
  addDeprecationHeaders,
  createV1ProxyHandler,
  API_VERSION_CONFIG,
  type ApiVersionConfig,
} from '@/lib/middleware/api-version';

// Mock Next.js
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, init) => ({
      ...init,
      headers: new Map(Object.entries(init?.headers || {})),
    })),
    next: jest.fn(() => ({
      headers: new Map(),
    })),
    rewrite: jest.fn(url => ({
      headers: new Map(),
      url,
    })),
  },
}));

describe('API Version Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addDeprecationHeaders', () => {
    it('should add X-Deprecated header to response', () => {
      const response = NextResponse.json({ data: 'test' });

      const result = addDeprecationHeaders(response);

      expect(result.headers.get('X-Deprecated')).toBe('true');
    });

    it('should add Sunset header with deprecation date', () => {
      const response = NextResponse.json({ data: 'test' });

      const result = addDeprecationHeaders(response, '2026-12-31');

      expect(result.headers.get('Sunset')).toBe('2026-12-31');
    });

    it('should add Link header with v1 alternative', () => {
      const response = NextResponse.json({ data: 'test' });

      const result = addDeprecationHeaders(
        response,
        undefined,
        '/api/v1/cases'
      );

      const linkHeader = result.headers.get('Link');
      expect(linkHeader).toContain('</api/v1/cases>');
      expect(linkHeader).toContain('rel="successor-version"');
    });

    it('should preserve existing headers', () => {
      const response = NextResponse.json(
        { data: 'test' },
        { headers: { 'X-Custom': 'value' } }
      );

      const result = addDeprecationHeaders(response);

      expect(result.headers.get('X-Custom')).toBe('value');
      expect(result.headers.get('X-Deprecated')).toBe('true');
    });
  });

  describe('withApiVersion', () => {
    it('should pass through v1 routes without deprecation', async () => {
      const handler = jest
        .fn()
        .mockResolvedValue(NextResponse.json({ data: 'test' }));
      const wrappedHandler = withApiVersion(handler, { version: 'v1' });

      const request = {
        url: 'http://localhost:3000/api/v1/cases',
        nextUrl: { pathname: '/api/v1/cases' },
      } as unknown as NextRequest;
      const context = { params: {} };

      const result = await wrappedHandler(request, context);

      expect(handler).toHaveBeenCalledWith(request, context);
      expect(result.headers.get('X-Deprecated')).toBeUndefined();
    });

    it('should add deprecation headers to root level routes', async () => {
      const handler = jest
        .fn()
        .mockResolvedValue(NextResponse.json({ data: 'test' }));
      const wrappedHandler = withApiVersion(handler, {
        version: 'legacy',
        deprecated: true,
      });

      const request = {
        url: 'http://localhost:3000/api/cases',
        nextUrl: { pathname: '/api/cases' },
      } as unknown as NextRequest;
      const context = { params: {} };

      const result = await wrappedHandler(request, context);

      expect(handler).toHaveBeenCalledWith(request, context);
      expect(result.headers.get('X-Deprecated')).toBe('true');
    });

    it('should add v1 alternative link when provided', async () => {
      const handler = jest
        .fn()
        .mockResolvedValue(NextResponse.json({ data: 'test' }));
      const wrappedHandler = withApiVersion(handler, {
        version: 'legacy',
        deprecated: true,
        v1Alternative: '/api/v1/cases',
      });

      const request = {
        url: 'http://localhost:3000/api/cases',
        nextUrl: { pathname: '/api/cases' },
      } as unknown as NextRequest;

      const result = await wrappedHandler(request, { params: {} });

      const linkHeader = result.headers.get('Link');
      expect(linkHeader).toContain('/api/v1/cases');
    });

    it('should support custom deprecation message', async () => {
      const handler = jest
        .fn()
        .mockResolvedValue(NextResponse.json({ data: 'test' }));
      const wrappedHandler = withApiVersion(handler, {
        version: 'legacy',
        deprecated: true,
        deprecationMessage: 'This API will be removed in v2.0',
      });

      const request = {
        url: 'http://localhost:3000/api/cases',
        nextUrl: { pathname: '/api/cases' },
      } as unknown as NextRequest;

      const result = await wrappedHandler(request, { params: {} });

      expect(result.headers.get('Deprecation')).toContain(
        'This API will be removed in v2.0'
      );
    });
  });

  describe('createV1ProxyHandler', () => {
    it('should create a handler that forwards to v1', async () => {
      const proxyHandler = createV1ProxyHandler('/api/v1/cases');

      const request = {
        url: 'http://localhost:3000/api/cases',
        method: 'GET',
        headers: new Map([['Authorization', 'Bearer token']]),
        nextUrl: {
          pathname: '/api/cases',
          searchParams: new URLSearchParams(),
        },
      } as unknown as NextRequest;

      const result = await proxyHandler(request);

      expect(NextResponse.rewrite).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/api/v1/cases',
        })
      );
    });

    it('should preserve query parameters when forwarding', async () => {
      const proxyHandler = createV1ProxyHandler('/api/v1/cases');

      const searchParams = new URLSearchParams();
      searchParams.set('page', '1');
      searchParams.set('limit', '10');

      const request = {
        url: 'http://localhost:3000/api/cases?page=1&limit=10',
        method: 'GET',
        headers: new Map(),
        nextUrl: { pathname: '/api/cases', searchParams },
      } as unknown as NextRequest;

      await proxyHandler(request);

      expect(NextResponse.rewrite).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '?page=1&limit=10',
        })
      );
    });

    it('should preserve request method when forwarding', async () => {
      const proxyHandler = createV1ProxyHandler('/api/v1/cases');

      const request = {
        url: 'http://localhost:3000/api/cases',
        method: 'POST',
        headers: new Map([['Content-Type', 'application/json']]),
        nextUrl: {
          pathname: '/api/cases',
          searchParams: new URLSearchParams(),
        },
        json: jest.fn().mockResolvedValue({ name: 'Test Case' }),
      } as unknown as NextRequest;

      await proxyHandler(request);

      // 验证rewrite被调用
      expect(NextResponse.rewrite).toHaveBeenCalled();
    });

    it('should add deprecation headers to proxy response', async () => {
      const proxyHandler = createV1ProxyHandler('/api/v1/cases');

      const request = {
        url: 'http://localhost:3000/api/cases',
        method: 'GET',
        headers: new Map(),
        nextUrl: {
          pathname: '/api/cases',
          searchParams: new URLSearchParams(),
        },
      } as unknown as NextRequest;

      const result = await proxyHandler(request);

      expect(result.headers.get('X-Deprecated')).toBe('true');
    });
  });

  describe('API_VERSION_CONFIG', () => {
    it('should have correct version constants', () => {
      expect(API_VERSION_CONFIG.CURRENT).toBe('v1');
      expect(API_VERSION_CONFIG.DEPRECATED).toBe('legacy');
      expect(API_VERSION_CONFIG.SUNSET_DATE).toBeDefined();
    });

    it('should list high-frequency routes for migration', () => {
      expect(API_VERSION_CONFIG.HIGH_FREQUENCY_ROUTES).toContain('cases');
      expect(API_VERSION_CONFIG.HIGH_FREQUENCY_ROUTES).toContain('debate');
      expect(API_VERSION_CONFIG.HIGH_FREQUENCY_ROUTES).toContain('users');
      expect(API_VERSION_CONFIG.HIGH_FREQUENCY_ROUTES).toContain('stats');
      expect(API_VERSION_CONFIG.HIGH_FREQUENCY_ROUTES).toContain('health');
    });
  });

  describe('getV1Alternative', () => {
    it('should match exact path', () => {
      const { getV1Alternative } = require('@/lib/middleware/api-version');
      expect(getV1Alternative('/api/cases')).toBe('/api/v1/cases');
      expect(getV1Alternative('/api/health')).toBe('/api/v1/health');
    });

    it('should match path without trailing slash', () => {
      const { getV1Alternative } = require('@/lib/middleware/api-version');
      expect(getV1Alternative('/api/cases/')).toBe('/api/v1/cases');
    });

    it('should match wildcard path with ID', () => {
      const { getV1Alternative } = require('@/lib/middleware/api-version');
      expect(getV1Alternative('/api/cases/123')).toBe('/api/v1/cases/123');
      expect(getV1Alternative('/api/users/456/profile')).toBe(
        '/api/v1/users/456/profile'
      );
    });

    it('should return null for unknown path', () => {
      const { getV1Alternative } = require('@/lib/middleware/api-version');
      expect(getV1Alternative('/api/unknown')).toBeNull();
      expect(getV1Alternative('/api/not-in-mapping')).toBeNull();
    });

    it('should handle empty or invalid paths', () => {
      const { getV1Alternative } = require('@/lib/middleware/api-version');
      expect(getV1Alternative('')).toBeNull();
      expect(getV1Alternative('/')).toBeNull();
    });
  });

  describe('isRootLevelApi', () => {
    it('should return true for root level API paths', () => {
      const { isRootLevelApi } = require('@/lib/middleware/api-version');
      expect(isRootLevelApi('/api/cases')).toBe(true);
      expect(isRootLevelApi('/api/users/123')).toBe(true);
      expect(isRootLevelApi('/api/stats')).toBe(true);
    });

    it('should return false for v1 paths', () => {
      const { isRootLevelApi } = require('@/lib/middleware/api-version');
      expect(isRootLevelApi('/api/v1/cases')).toBe(false);
      expect(isRootLevelApi('/api/v1/')).toBe(false);
      expect(isRootLevelApi('/api/v1')).toBe(false);
    });

    it('should return false for auth paths', () => {
      const { isRootLevelApi } = require('@/lib/middleware/api-version');
      expect(isRootLevelApi('/api/auth/login')).toBe(false);
      expect(isRootLevelApi('/api/auth/oauth/wechat')).toBe(false);
    });

    it('should return false for non-API paths', () => {
      const { isRootLevelApi } = require('@/lib/middleware/api-version');
      expect(isRootLevelApi('/')).toBe(false);
      expect(isRootLevelApi('/about')).toBe(false);
      expect(isRootLevelApi('/dashboard')).toBe(false);
    });

    it('should handle edge cases', () => {
      const { isRootLevelApi } = require('@/lib/middleware/api-version');
      expect(isRootLevelApi('')).toBe(false);
      expect(isRootLevelApi('/api/')).toBe(true);
    });
  });

  describe('isHighFrequencyRoute', () => {
    it('should return true for high frequency routes', () => {
      const { isHighFrequencyRoute } = require('@/lib/middleware/api-version');
      expect(isHighFrequencyRoute('/api/cases')).toBe(true);
      expect(isHighFrequencyRoute('/api/debate')).toBe(true);
      expect(isHighFrequencyRoute('/api/users')).toBe(true);
      expect(isHighFrequencyRoute('/api/health')).toBe(true);
    });

    it('should return true for sub-routes of high frequency routes', () => {
      const { isHighFrequencyRoute } = require('@/lib/middleware/api-version');
      expect(isHighFrequencyRoute('/api/cases/123')).toBe(true);
      expect(isHighFrequencyRoute('/api/users/search')).toBe(true);
    });

    it('should return false for non-high-frequency routes', () => {
      const { isHighFrequencyRoute } = require('@/lib/middleware/api-version');
      expect(isHighFrequencyRoute('/api/rare-route')).toBe(false);
      expect(isHighFrequencyRoute('/api/unknown')).toBe(false);
    });
  });

  describe('apiVersionMiddleware', () => {
    it('should return null for v1 paths', () => {
      const { apiVersionMiddleware } = require('@/lib/middleware/api-version');
      const request = {
        nextUrl: { pathname: '/api/v1/cases', search: '' },
        url: 'http://localhost/api/v1/cases',
      } as unknown as NextRequest;

      expect(apiVersionMiddleware(request)).toBeNull();
    });

    it('should return null for auth paths', () => {
      const { apiVersionMiddleware } = require('@/lib/middleware/api-version');
      const request = {
        nextUrl: { pathname: '/api/auth/login', search: '' },
        url: 'http://localhost/api/auth/login',
      } as unknown as NextRequest;

      expect(apiVersionMiddleware(request)).toBeNull();
    });

    it('should return null for non-API paths', () => {
      const { apiVersionMiddleware } = require('@/lib/middleware/api-version');
      const request = {
        nextUrl: { pathname: '/about', search: '' },
        url: 'http://localhost/about',
      } as unknown as NextRequest;

      expect(apiVersionMiddleware(request)).toBeNull();
    });

    it('should add deprecation headers for root level API', () => {
      const { apiVersionMiddleware } = require('@/lib/middleware/api-version');
      const request = {
        nextUrl: { pathname: '/api/unknown-route', search: '' },
        url: 'http://localhost/api/unknown-route',
      } as unknown as NextRequest;

      const response = apiVersionMiddleware(request);
      expect(response).not.toBeNull();
      expect(response?.headers.get('X-Deprecated')).toBe('true');
    });

    it('should add Cache-Control header to prevent caching', () => {
      const { apiVersionMiddleware } = require('@/lib/middleware/api-version');
      const request = {
        nextUrl: { pathname: '/api/cases', search: '' },
        url: 'http://localhost/api/cases',
      } as unknown as NextRequest;

      const response = apiVersionMiddleware(request);
      expect(response?.headers.get('Cache-Control')).toContain('no-cache');
    });
  });
});
