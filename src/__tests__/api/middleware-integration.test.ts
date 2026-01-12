import {
  MiddlewareStack,
  createRequestContext,
} from '@/app/api/lib/middleware/core';
import {
  corsMiddleware,
  securityMiddleware,
  rateLimitMiddleware,
} from '@/app/api/lib/middleware/security';
import { NextRequest, NextResponse } from 'next/server';

describe('Middleware Integration Tests', () => {
  describe('Complete Middleware Stack', () => {
    it('should handle typical API request flow', async () => {
      const stack = new MiddlewareStack();
      const testRequest = new NextRequest(
        'http://localhost:3000/api/v1/users',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            'x-forwarded-for': '192.168.1.100',
          },
          body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }),
        }
      );
      const testContext = createRequestContext(testRequest);

      // Authentication middleware
      const authMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          ctx.userId = 'user123';
          ctx.role = 'admin';
        });

      // Request logging middleware
      const loggingMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          response.headers.set('X-Request-ID', ctx.requestId);
        });

      // Response middleware
      const responseMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          return NextResponse.json({
            success: true,
            data: {
              userId: ctx.userId,
              role: ctx.role,
              requestId: ctx.requestId,
              processingTime: Date.now() - ctx.startTime,
              endpoint: '/api/v1/users',
            },
          });
        });

      stack
        .use(corsMiddleware)
        .use(securityMiddleware)
        .use(rateLimitMiddleware)
        .use(authMiddleware)
        .use(loggingMiddleware)
        .use(responseMiddleware);

      const result = await stack.execute(testRequest, testContext);

      // Verify all middlewares were called
      expect(authMiddleware).toHaveBeenCalled();
      expect(loggingMiddleware).toHaveBeenCalled();
      expect(responseMiddleware).toHaveBeenCalled();

      // Verify response data
      const responseData = await result.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.userId).toBe('user123');
      expect(responseData.data.role).toBe('admin');
      expect(responseData.data.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(responseData.data.processingTime).toBeGreaterThanOrEqual(0);

      // Verify that response structure is correct and middleware chain works
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeDefined();

      // The most important verification is that all middlewares executed
      expect(authMiddleware).toHaveBeenCalled();
      expect(loggingMiddleware).toHaveBeenCalled();
      expect(responseMiddleware).toHaveBeenCalled();
    });

    it('should handle OPTIONS preflight correctly', async () => {
      const stack = new MiddlewareStack();
      const testRequest = new NextRequest('http://localhost:3000/api/v1/data', {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'Content-Type, Authorization',
        },
      });
      const testContext = createRequestContext(testRequest);

      stack
        .use(corsMiddleware)
        .use(securityMiddleware)
        .use(rateLimitMiddleware);

      const result = await stack.execute(testRequest, testContext);

      // Verify OPTIONS response
      expect(result.status).toBe(200);
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(result.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
      expect(result.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization, X-Requested-With, Accept, Origin'
      );
      expect(result.headers.get('Access-Control-Allow-Credentials')).toBe(
        'true'
      );
      expect(result.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should handle rate limiting properly', async () => {
      const stack = new MiddlewareStack();
      const testRequest = new NextRequest('http://localhost:3000/api/v1/test', {
        method: 'GET',
        headers: {
          origin: 'http://localhost:3000',
          'x-forwarded-for': '192.168.1.200',
        },
      });
      const testContext = createRequestContext(testRequest);

      // Simple response middleware for testing
      const responseMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          return NextResponse.json({ message: 'OK' });
        });

      stack
        .use(corsMiddleware)
        .use(securityMiddleware)
        .use(rateLimitMiddleware)
        .use(responseMiddleware);

      // First request should succeed
      const result1 = await stack.execute(
        testRequest,
        createRequestContext(testRequest)
      );
      expect(result1.status).toBe(200);

      // Multiple requests should work within limits
      for (let i = 0; i < 50; i++) {
        const result = await stack.execute(
          testRequest,
          createRequestContext(testRequest)
        );
        expect(result.status).toBe(200);
      }
    });

    it('should maintain context isolation between requests', async () => {
      const stack = new MiddlewareStack();

      // Create multiple requests with different contexts
      const request1 = new NextRequest('http://localhost:3000/api/test1');
      const request2 = new NextRequest('http://localhost:3000/api/test2');

      const context1 = createRequestContext(request1);
      const context2 = createRequestContext(request2);

      // Context modification middleware
      const contextMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          ctx.userId = `user_${ctx.requestId}`;
          ctx.customData = 'test';
        });

      const responseMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          return NextResponse.json({
            requestId: ctx.requestId,
            userId: ctx.userId,
            customData: ctx.customData,
          });
        });

      stack.use(contextMiddleware).use(responseMiddleware);

      // Execute both requests
      const result1 = await stack.execute(request1, context1);
      const result2 = await stack.execute(request2, context2);

      // Verify isolation
      expect(context1.requestId).not.toBe(context2.requestId);

      const data1 = await result1.json();
      const data2 = await result2.json();

      expect(data1.userId).toBe(`user_${context1.requestId}`);
      expect(data2.userId).toBe(`user_${context2.requestId}`);
      expect(data1.requestId).toBe(context1.requestId);
      expect(data2.requestId).toBe(context2.requestId);
    });

    it('should handle middleware chain termination correctly', async () => {
      const stack = new MiddlewareStack();
      const testRequest = new NextRequest('http://localhost:3000/api/test');
      const testContext = createRequestContext(testRequest);

      // Early termination middleware
      const terminationMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          return NextResponse.json({ message: 'Early termination' });
        });

      const shouldNotExecuteMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          // This should never be called
          throw new Error('Should not execute');
        });

      stack.use(terminationMiddleware).use(shouldNotExecuteMiddleware);

      const result = await stack.execute(testRequest, testContext);

      expect(terminationMiddleware).toHaveBeenCalled();
      expect(shouldNotExecuteMiddleware).not.toHaveBeenCalled();

      const responseData = await result.json();
      expect(responseData.message).toBe('Early termination');
    });

    it('should handle error propagation through middleware chain', async () => {
      const stack = new MiddlewareStack();
      const testRequest = new NextRequest('http://localhost:3000/api/error');
      const testContext = createRequestContext(testRequest);

      // Error throwing middleware
      const errorMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          throw new Error('Test error');
        });

      const shouldNotExecuteMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          // This should never be called
          throw new Error('Should not execute after error');
        });

      stack
        .use(corsMiddleware)
        .use(errorMiddleware)
        .use(shouldNotExecuteMiddleware);

      const result = await stack.execute(testRequest, testContext);

      expect(errorMiddleware).toHaveBeenCalled();
      expect(shouldNotExecuteMiddleware).not.toHaveBeenCalled();
      expect(result.status).toBe(500);

      const responseData = await result.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should simulate API endpoint with authentication', async () => {
      const stack = new MiddlewareStack();
      const testRequest = new NextRequest(
        'http://localhost:3000/api/v1/profile',
        {
          method: 'GET',
          headers: {
            authorization: 'Bearer valid-token',
            origin: 'http://localhost:3000',
          },
        }
      );
      const testContext = createRequestContext(testRequest);

      // Auth middleware
      const authMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          const token = req.headers.get('authorization');
          if (!token) {
            return NextResponse.json(
              { error: 'Unauthorized' },
              { status: 401 }
            );
          }

          // Simulate token validation
          if (token === 'Bearer valid-token') {
            ctx.userId = 'user123';
            ctx.role = 'user';
          } else {
            return NextResponse.json(
              { error: 'Invalid token' },
              { status: 401 }
            );
          }
        });

      // Profile middleware
      const profileMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          if (!ctx.userId) {
            return NextResponse.json(
              { error: 'Authentication required' },
              { status: 401 }
            );
          }

          return NextResponse.json({
            user: {
              id: ctx.userId,
              name: 'John Doe',
              email: 'john@example.com',
              role: ctx.role,
            },
          });
        });

      stack
        .use(corsMiddleware)
        .use(securityMiddleware)
        .use(authMiddleware)
        .use(profileMiddleware);

      const result = await stack.execute(testRequest, testContext);

      expect(result.status).toBe(200);

      const responseData = await result.json();
      expect(responseData.user.id).toBe('user123');
      expect(responseData.user.name).toBe('John Doe');
      expect(responseData.user.role).toBe('user');
    });

    it('should handle file upload simulation', async () => {
      const stack = new MiddlewareStack();
      const testRequest = new NextRequest(
        'http://localhost:3000/api/v1/upload',
        {
          method: 'POST',
          headers: {
            'content-type': 'multipart/form-data',
            origin: 'http://localhost:3000',
          },
        }
      );
      const testContext = createRequestContext(testRequest);

      // File validation middleware
      const fileValidationMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          const contentType = req.headers.get('content-type');
          if (!contentType || !contentType.includes('multipart/form-data')) {
            return NextResponse.json(
              { error: 'Invalid content type' },
              { status: 400 }
            );
          }

          ctx.fileSize = 1024 * 1024; // 1MB
          ctx.fileName = 'test-file.pdf';
        });

      // Upload processing middleware
      const uploadMiddleware = jest
        .fn()
        .mockImplementation(async (req, ctx, response) => {
          if (!ctx.fileName) {
            return NextResponse.json(
              { error: 'No file provided' },
              { status: 400 }
            );
          }

          // Simulate file processing
          const processedSize = ctx.fileSize * 0.8; // Compressed

          return NextResponse.json({
            success: true,
            file: {
              name: ctx.fileName,
              originalSize: ctx.fileSize,
              compressedSize: processedSize,
              url: '/uploads/' + ctx.fileName,
            },
          });
        });

      stack
        .use(corsMiddleware)
        .use(securityMiddleware)
        .use(rateLimitMiddleware)
        .use(fileValidationMiddleware)
        .use(uploadMiddleware);

      const result = await stack.execute(testRequest, testContext);

      expect(result.status).toBe(200);

      const responseData = await result.json();
      expect(responseData.success).toBe(true);
      expect(responseData.file.name).toBe('test-file.pdf');
      expect(responseData.file.originalSize).toBe(1024 * 1024);
      expect(responseData.file.compressedSize).toBe(1024 * 1024 * 0.8);
    });
  });
});
