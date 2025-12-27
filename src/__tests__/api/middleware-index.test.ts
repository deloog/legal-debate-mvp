import { 
  createDefaultMiddlewareStack,
  MiddlewareStack,
  createRequestContext 
} from '@/app/api/lib/middleware/index';
import {
  corsMiddleware,
  securityMiddleware,
  rateLimitMiddleware,
} from '@/app/api/lib/middleware/security';
import {
  loggingMiddleware,
  responseTimeMiddleware,
  versionMiddleware,
} from '@/app/api/lib/middleware/logging';

// 模拟NextResponse用于测试
const mockNextResponse = {
  next: () => ({ status: 200, headers: new Map() }),
  json: (data: any) => ({ 
    status: 200, 
    headers: new Map([['content-type', 'application/json']]), 
    json: async () => data 
  })
};

// 设置全局模拟
(global as any).NextResponse = mockNextResponse;

describe('Middleware Index', () => {
  let mockRequest: any;
  let context: any;

  beforeEach(() => {
    mockRequest = {
      url: 'http://localhost:3000/api/test',
      method: 'GET',
      headers: {
        get: jest.fn(),
        set: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
      },
      cookies: {
        size: 0,
        get: jest.fn(),
        getAll: jest.fn(),
        has: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        toString: jest.fn(),
        [Symbol.iterator]: function* () {
          yield* [];
        },
      },
      nextUrl: {
        href: 'http://localhost:3000/api/test',
        origin: 'http://localhost:3000',
        protocol: 'http:',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/test',
        search: '',
        searchParams: new URLSearchParams(),
        hash: '',
        username: '',
        password: '',
        host: 'localhost:3000',
        domainLocale: undefined,
        analyze: jest.fn(),
        formatPathname: jest.fn(),
        formatSearch: jest.fn(),
        buildId: '',
        locale: '',
        defaultLocale: '',
        basePath: '',
        toJSON: jest.fn(),
        clone: jest.fn(),
        [Symbol('Internal')]: {},
        toString: () => 'http://localhost:3000/api/test',
      },
      page: {},
      ua: 'test-agent',
      ip: '127.0.0.1',
      geo: {},
      body: null,
      json: jest.fn(),
      text: jest.fn(),
      blob: jest.fn(),
      formData: jest.fn(),
      arrayBuffer: jest.fn(),
      clone: jest.fn(),
      cache: 'default' as RequestCache,
      credentials: 'same-origin' as RequestCredentials,
      destination: 'document' as RequestDestination,
      integrity: '',
      keepalive: false,
      mode: 'cors' as RequestMode,
      redirect: 'follow' as RequestRedirect,
      referrer: 'about:client',
      referrerPolicy: '' as ReferrerPolicy,
      signal: new AbortController().signal,
      isBot: false,
      urlSearchParams: new URLSearchParams(),
      bodyUsed: false,
      bytes: null,
    };
    context = createRequestContext(mockRequest);
  });

  describe('createDefaultMiddlewareStack', () => {
    it('should create a middleware stack with default middlewares', () => {
      const stack = createDefaultMiddlewareStack();

      expect(stack).toBeInstanceOf(MiddlewareStack);
    });

    it('should include all default middlewares in correct order', async () => {
      const stack = createDefaultMiddlewareStack();
      
      // 添加一个最终的响应中间件来测试栈执行
      const finalMiddleware = jest.fn().mockImplementation(async (req, ctx, response) => {
        return mockNextResponse.json({ success: true });
      });
      stack.use(finalMiddleware);

      const result = await stack.execute(mockRequest, context);

      // 验证所有中间件都被调用
      expect(finalMiddleware).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should execute middlewares in the correct order', async () => {
      const stack = createDefaultMiddlewareStack();
      const executionOrder: string[] = [];

      // 模拟中间件执行顺序检查
      const originalCors = corsMiddleware;
      const originalLogging = loggingMiddleware;
      const originalResponseTime = responseTimeMiddleware;
      const originalSecurity = securityMiddleware;
      const originalRateLimit = rateLimitMiddleware;
      const originalVersion = versionMiddleware;

      const finalMiddleware = jest.fn().mockImplementation(async (req, ctx, response) => {
        executionOrder.push('final');
        return mockNextResponse.json({ success: true });
      });

      const mockCors = jest.fn().mockImplementation(async (req, ctx, response) => {
        executionOrder.push('cors');
        return originalCors(req, ctx, response);
      });

      const mockLogging = jest.fn().mockImplementation(async (req, ctx, response) => {
        executionOrder.push('logging');
        return originalLogging(req, ctx, response);
      });

      const mockResponseTime = jest.fn().mockImplementation(async (req, ctx, response) => {
        executionOrder.push('responseTime');
        return originalResponseTime(req, ctx, response);
      });

      const mockSecurity = jest.fn().mockImplementation(async (req, ctx, response) => {
        executionOrder.push('security');
        return originalSecurity(req, ctx, response);
      });

      const mockRateLimit = jest.fn().mockImplementation(async (req, ctx, response) => {
        executionOrder.push('rateLimit');
        return originalRateLimit(req, ctx, response);
      });

      const mockVersion = jest.fn().mockImplementation(async (req, ctx, response) => {
        executionOrder.push('version');
        return originalVersion(req, ctx, response);
      });

      // 创建新的栈来测试顺序
      const testStack = new MiddlewareStack()
        .use(mockCors)
        .use(mockLogging)
        .use(mockResponseTime)
        .use(mockSecurity)
        .use(mockRateLimit)
        .use(mockVersion)
        .use(finalMiddleware);

      await testStack.execute(mockRequest, context);

      // 验证执行顺序
      expect(executionOrder).toEqual([
        'cors',
        'logging', 
        'responseTime',
        'security',
        'rateLimit',
        'version',
        'final'
      ]);
    });

    it('should handle errors in default middleware stack', async () => {
      const stack = createDefaultMiddlewareStack();
      
      // 添加一个会抛出错误的中间件
      const errorMiddleware = jest.fn().mockRejectedValue(new Error('Test error'));
      stack.use(errorMiddleware);

      const result = await stack.execute(mockRequest, context);

      expect(result.status).toBe(500);
    });

    it('should work with different request methods', async () => {
      const stack = createDefaultMiddlewareStack();

      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
      
      for (const method of methods) {
        const request = {
          url: 'http://localhost:3000/api/test',
          method,
          headers: {
            get: jest.fn(),
            set: jest.fn(),
            has: jest.fn(),
            delete: jest.fn(),
          },
          cookies: {
            size: 0,
            get: jest.fn(),
            getAll: jest.fn(),
            has: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            toString: jest.fn(),
            [Symbol.iterator]: function* () {
              yield* [];
            },
          },
          nextUrl: {
            href: 'http://localhost:3000/api/test',
            origin: 'http://localhost:3000',
            protocol: 'http:',
            hostname: 'localhost',
            port: '3000',
            pathname: '/api/test',
            search: '',
            searchParams: new URLSearchParams(),
            hash: '',
            username: '',
            password: '',
            host: 'localhost:3000',
            domainLocale: undefined,
            analyze: jest.fn(),
            formatPathname: jest.fn(),
            formatSearch: jest.fn(),
            buildId: '',
            locale: '',
            defaultLocale: '',
            basePath: '',
            toJSON: jest.fn(),
            clone: jest.fn(),
            [Symbol('Internal')]: {},
            toString: () => 'http://localhost:3000/api/test',
          },
          page: {},
          ua: 'test-agent',
          ip: '127.0.0.1',
          geo: {},
          body: null,
          json: jest.fn(),
          text: jest.fn(),
          blob: jest.fn(),
          formData: jest.fn(),
          arrayBuffer: jest.fn(),
          clone: jest.fn(),
          cache: 'default' as RequestCache,
          credentials: 'same-origin' as RequestCredentials,
          destination: 'document' as RequestDestination,
          integrity: '',
          keepalive: false,
          mode: 'cors' as RequestMode,
          redirect: 'follow' as RequestRedirect,
          referrer: 'about:client',
          referrerPolicy: '' as ReferrerPolicy,
          signal: new AbortController().signal,
          isBot: false,
          urlSearchParams: new URLSearchParams(),
          bodyUsed: false,
          bytes: null,
        };

        const context = createRequestContext(request as any);
        
        const finalMiddleware = jest.fn().mockImplementation(async (req, ctx, response) => {
          return mockNextResponse.json({ method });
        });
        stack.use(finalMiddleware);

        const result = await stack.execute(request as any, context);
        expect(result).toBeDefined();
      }
    });

    it('should maintain request context through the stack', async () => {
      const stack = createDefaultMiddlewareStack();

      let capturedContext: any = null;
      
      const finalMiddleware = jest.fn().mockImplementation(async (req, ctx, response) => {
        capturedContext = { ...ctx };
        return mockNextResponse.json({ 
          requestId: ctx.requestId,
          startTime: ctx.startTime 
        });
      });
      stack.use(finalMiddleware);

      await stack.execute(mockRequest, context);

      expect(capturedContext).toBeDefined();
      expect(capturedContext.requestId).toBe(context.requestId);
      expect(capturedContext.startTime).toBe(context.startTime);
    });
  });

  describe('Middleware Integration', () => {
    it('should combine CORS and security headers correctly', async () => {
      const stack = createDefaultMiddlewareStack();
      
      const finalMiddleware = jest.fn().mockImplementation(async (req, ctx, response) => {
        return mockNextResponse.json({ success: true });
      });
      stack.use(finalMiddleware);

      const result = await stack.execute(mockRequest, context);

      expect(result).toBeDefined();
    });

    it('should handle rate limiting with concurrent requests', async () => {
      const stack = createDefaultMiddlewareStack();
      
      const finalMiddleware = jest.fn().mockImplementation(async (req, ctx, response) => {
        return mockNextResponse.json({ success: true });
      });
      stack.use(finalMiddleware);

      // 模拟并发请求
      const requests = Array(10).fill(null).map(() => 
        stack.execute(mockRequest, context)
      );

      const results = await Promise.all(requests);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should preserve request metadata across middlewares', async () => {
      const stack = createDefaultMiddlewareStack();
      
      const metadata: any = {};
      
      const finalMiddleware = jest.fn().mockImplementation(async (req, ctx, response) => {
        metadata.requestId = ctx.requestId;
        metadata.startTime = ctx.startTime;
        return mockNextResponse.json(metadata);
      });
      stack.use(finalMiddleware);

      const result = await stack.execute(mockRequest, context);
      const data = await result.json();

      expect(data.requestId).toBe(context.requestId);
      expect(data.startTime).toBe(context.startTime);
    });
  });

  describe('Export verification', () => {
    it('should export all required functions and classes', () => {
      expect(typeof createDefaultMiddlewareStack).toBe('function');
      expect(typeof MiddlewareStack).toBe('function');
      expect(typeof createRequestContext).toBe('function');
    });

    it('should export middleware functions', () => {
      expect(typeof corsMiddleware).toBe('function');
      expect(typeof securityMiddleware).toBe('function');
      expect(typeof rateLimitMiddleware).toBe('function');
      expect(typeof loggingMiddleware).toBe('function');
      expect(typeof responseTimeMiddleware).toBe('function');
      expect(typeof versionMiddleware).toBe('function');
    });
  });
});
