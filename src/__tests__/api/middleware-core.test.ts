import { ApiError, ValidationError } from '@/app/api/lib/errors/api-error';
import {
  MiddlewareStack,
  RequestContext,
  createRequestContext,
} from '@/app/api/lib/middleware/core';
import { NextRequest, NextResponse } from 'next/server';

describe('Middleware Core', () => {
  describe('createRequestContext', () => {
    it('should create request context with required properties', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const context = createRequestContext(request);

      expect(context.request).toBe(request);
      expect(context.startTime).toBeDefined();
      expect(context.requestId).toBeDefined();
      expect(typeof context.startTime).toBe('number');
      expect(typeof context.requestId).toBe('string');
    });

    it('should generate unique request IDs', () => {
      const request = new NextRequest('http://localhost:3000/api/test');

      const context1 = createRequestContext(request);
      const context2 = createRequestContext(request);

      expect(context1.requestId).not.toBe(context2.requestId);
      expect(context1.startTime).toBeLessThanOrEqual(context2.startTime);
    });

    it('should generate valid request ID format', () => {
      const request = new NextRequest('http://localhost:3000/api/test');

      const context = createRequestContext(request);

      expect(context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should not include optional properties by default', () => {
      const request = new NextRequest('http://localhost:3000/api/test');

      const context = createRequestContext(request);

      expect(context.userId).toBeUndefined();
      expect(context.role).toBeUndefined();
    });
  });

  describe('MiddlewareStack', () => {
    let mockRequest: NextRequest;
    let context: RequestContext;

    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });
      context = createRequestContext(mockRequest);
    });

    describe('use method', () => {
      it('should add middleware to stack', () => {
        const stack = new MiddlewareStack();
        const mockMiddleware = jest.fn();

        const result = stack.use(mockMiddleware);

        expect(result).toBe(stack);
        expect(stack['middlewares']).toContain(mockMiddleware);
      });

      it('should allow chaining multiple middlewares', () => {
        const stack = new MiddlewareStack();
        const middleware1 = jest.fn();
        const middleware2 = jest.fn();
        const middleware3 = jest.fn();

        stack.use(middleware1).use(middleware2).use(middleware3);

        expect(stack['middlewares']).toEqual([
          middleware1,
          middleware2,
          middleware3,
        ]);
      });
    });

    describe('execute method', () => {
      it('should execute single middleware', async () => {
        const stack = new MiddlewareStack();
        const mockResponse = NextResponse.json({ success: true });
        const mockMiddleware = jest.fn().mockResolvedValue(mockResponse);

        stack.use(mockMiddleware);

        const result = await stack.execute(mockRequest, context);

        expect(mockMiddleware).toHaveBeenCalledWith(
          mockRequest,
          context,
          expect.any(NextResponse)
        );
        expect(result).toBe(mockResponse);
      });

      it('should execute multiple middlewares in order', async () => {
        const stack = new MiddlewareStack();
        const executionOrder: number[] = [];

        const middleware1 = jest
          .fn()
          .mockImplementation(async (_req, ctx, response) => {
            executionOrder.push(1);
            // Don't return response to continue to next
          });

        const middleware2 = jest
          .fn()
          .mockImplementation(async (_req, ctx, response) => {
            executionOrder.push(2);
            return NextResponse.json({ middleware: 2 });
          });

        stack.use(middleware1).use(middleware2);

        const __result = await stack.execute(mockRequest, context);

        expect(executionOrder).toEqual([1, 2]);
        expect(middleware1).toHaveBeenCalledWith(
          mockRequest,
          context,
          expect.any(NextResponse)
        );
        expect(middleware2).toHaveBeenCalledWith(
          mockRequest,
          context,
          expect.any(NextResponse)
        );
      });

      it('should pass updated context through middleware chain', async () => {
        const stack = new MiddlewareStack();
        let contextReceived: RequestContext | null = null;

        const middleware1 = jest
          .fn()
          .mockImplementation(async (_req, ctx, response) => {
            ctx.userId = 'user123';
            contextReceived = { ...ctx };
          });

        const middleware2 = jest
          .fn()
          .mockImplementation(async (_req, ctx, response) => {
            expect(ctx.userId).toBe('user123');
            return NextResponse.json({ userId: ctx.userId });
          });

        stack.use(middleware1).use(middleware2);

        const __result = await stack.execute(mockRequest, context);

        expect(middleware2).toHaveBeenCalledWith(
          mockRequest,
          expect.objectContaining({
            userId: 'user123',
          }),
          expect.any(NextResponse)
        );
      });

      it('should handle middleware that returns void', async () => {
        const stack = new MiddlewareStack();
        const mockResponse = NextResponse.json({ success: true });

        const middleware1 = jest.fn().mockImplementation(async () => {
          // Return undefined to continue
        });

        const middleware2 = jest.fn().mockResolvedValue(mockResponse);

        stack.use(middleware1).use(middleware2);

        const result = await stack.execute(mockRequest, context);

        expect(result).toBe(mockResponse);
        expect(middleware1).toHaveBeenCalled();
        expect(middleware2).toHaveBeenCalled();
      });

      it('should stop at first middleware that returns response', async () => {
        const stack = new MiddlewareStack();
        const mockResponse = NextResponse.json({ stopped: true });

        const middleware1 = jest.fn().mockResolvedValue(mockResponse);
        const middleware2 = jest.fn(); // Should not be called

        stack.use(middleware1).use(middleware2);

        const result = await stack.execute(mockRequest, context);

        expect(result).toBe(mockResponse);
        expect(middleware1).toHaveBeenCalled();
        expect(middleware2).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle middleware errors using error handler', async () => {
        const stack = new MiddlewareStack();
        const error = new Error('Middleware error');

        const mockMiddleware = jest.fn().mockRejectedValue(error);
        stack.use(mockMiddleware);

        const result = await stack.execute(mockRequest, context);

        expect(mockMiddleware).toHaveBeenCalled();
        expect(result.status).toBe(500);

        const responseData = await result.json();
        expect(responseData.success).toBe(false);
        expect(responseData.error.code).toBe('INTERNAL_SERVER_ERROR');
      });

      it('should handle ValidationError in middleware', async () => {
        const stack = new MiddlewareStack();
        const validationError = new ValidationError('Invalid input');

        const mockMiddleware = jest.fn().mockRejectedValue(validationError);
        stack.use(mockMiddleware);

        const result = await stack.execute(mockRequest, context);

        expect(result.status).toBe(400);

        const responseData = await result.json();
        expect(responseData.success).toBe(false);
        expect(responseData.error.code).toBe('VALIDATION_ERROR');
        expect(responseData.error.message).toBe('Invalid input');
      });

      it('should handle ApiError in middleware', async () => {
        const stack = new MiddlewareStack();
        const apiError = new ApiError(
          422,
          'UNPROCESSABLE_ENTITY',
          'Cannot process'
        );

        const mockMiddleware = jest.fn().mockRejectedValue(apiError);
        stack.use(mockMiddleware);

        const result = await stack.execute(mockRequest, context);

        expect(result.status).toBe(422);

        const responseData = await result.json();
        expect(responseData.success).toBe(false);
        expect(responseData.error.code).toBe('UNPROCESSABLE_ENTITY');
        expect(responseData.error.message).toBe('Cannot process');
      });

      it('should include request information in error handling', async () => {
        const stack = new MiddlewareStack();
        const error = new Error('Test error');

        const mockMiddleware = jest.fn().mockRejectedValue(error);
        stack.use(mockMiddleware);

        // Mock console.error to capture error logging
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        await stack.execute(mockRequest, context);

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('API Error:')
        );

        consoleSpy.mockRestore();
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty middleware stack', async () => {
        const stack = new MiddlewareStack();

        const result = await stack.execute(mockRequest, context);
        expect(result.status).toBe(200);
      });

      it('should handle middleware chain completion without response', async () => {
        const stack = new MiddlewareStack();

        const mockMiddleware = jest.fn().mockImplementation(async () => {
          // Don't return anything
        });

        stack.use(mockMiddleware);

        const result = await stack.execute(mockRequest, context);
        expect(result.status).toBe(200);
      });

      it('should maintain correct execution context', async () => {
        const stack = new MiddlewareStack();
        const middlewareContexts: RequestContext[] = [];

        const middleware1 = jest
          .fn()
          .mockImplementation(async (_req, ctx, response) => {
            middlewareContexts.push({ ...ctx });
            ctx.userId = 'user1';
          });

        const middleware2 = jest
          .fn()
          .mockImplementation(async (_req, ctx, response) => {
            middlewareContexts.push({ ...ctx });
            ctx.userId = 'user2';
            return NextResponse.json({ finalUserId: ctx.userId });
          });

        stack.use(middleware1).use(middleware2);

        const result = await stack.execute(mockRequest, context);

        expect(middlewareContexts[0].userId).toBeUndefined();
        expect(middlewareContexts[1].userId).toBe('user1');

        const responseData = await result.json();
        expect(responseData.finalUserId).toBe('user2');
      });

      it('should handle asynchronous middleware operations', async () => {
        const stack = new MiddlewareStack();

        const middleware1 = jest
          .fn()
          .mockImplementation(async (_req, ctx, response) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            ctx.asyncOperation = 'completed';
          });

        const middleware2 = jest
          .fn()
          .mockImplementation(async (_req, ctx, response) => {
            expect(ctx.asyncOperation).toBe('completed');
            return NextResponse.json({ async: true });
          });

        stack.use(middleware1).use(middleware2);

        const result = await stack.execute(mockRequest, context);

        expect(middleware1).toHaveBeenCalled();
        expect(middleware2).toHaveBeenCalled();

        const responseData = await result.json();
        expect(responseData.async).toBe(true);
      });
    });
  });

  describe('Integration Examples', () => {
    it('should demonstrate typical middleware usage', async () => {
      const stack = new MiddlewareStack();
      const testRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });
      const testContext = createRequestContext(testRequest);

      // Authentication middleware
      const authMiddleware = jest
        .fn()
        .mockImplementation(async (_req, ctx, response) => {
          ctx.userId = 'user123';
          ctx.role = 'user';
        });

      // Logging middleware
      const loggingMiddleware = jest
        .fn()
        .mockImplementation(async (_req, ctx, response) => {
          ctx.requestId = `custom_${ctx.requestId}`;
        });

      // Response middleware
      const responseMiddleware = jest
        .fn()
        .mockImplementation(async (_req, ctx, response) => {
          return NextResponse.json({
            success: true,
            data: {
              userId: ctx.userId,
              role: ctx.role,
              requestId: ctx.requestId,
              processingTime: Date.now() - ctx.startTime,
            },
          });
        });

      stack.use(authMiddleware).use(loggingMiddleware).use(responseMiddleware);

      const result = await stack.execute(testRequest, testContext);

      expect(authMiddleware).toHaveBeenCalled();
      expect(loggingMiddleware).toHaveBeenCalled();
      expect(responseMiddleware).toHaveBeenCalled();

      const responseData = await result.json();
      expect(responseData.data.userId).toBe('user123');
      expect(responseData.data.role).toBe('user');
      expect(responseData.data.requestId).toMatch(/^custom_req_/);
      expect(responseData.data.processingTime).toBeGreaterThanOrEqual(0);
    });
  });
});
