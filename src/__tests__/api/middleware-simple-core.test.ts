/**
 * 中间件核心测试
 * 测试中间件栈和请求上下文创建功能
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { 
  MockRequest, 
  MockResponse, 
  MockHeaders, 
  MockNextResponse 
} from './middleware-simple-mocks.test';

// 现在导入和测试中间件
const { 
  createRequestContext, 
  MiddlewareStack 
} = require('../../app/api/lib/middleware/core');

describe('Middleware Core Tests', () => {
  describe('createRequestContext', () => {
    it('应该创建包含必需属性的请求上下文', () => {
      const request = new global.Request('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const context = createRequestContext(request);

      expect(context.request).toBe(request);
      expect(context.startTime).toBeDefined();
      expect(context.requestId).toBeDefined();
      expect(typeof context.startTime).toBe('number');
      expect(typeof context.requestId).toBe('string');
    });

    it('应该生成唯一的请求ID', () => {
      const request = new global.Request('http://localhost:3000/api/test');

      const context1 = createRequestContext(request);
      const context2 = createRequestContext(request);

      expect(context1.requestId).not.toBe(context2.requestId);
      expect(context1.startTime).toBeLessThanOrEqual(context2.startTime);
    });

    it('应该生成有效的请求ID格式', () => {
      const request = new global.Request('http://localhost:3000/api/test');

      const context = createRequestContext(request);

      expect(context.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('MiddlewareStack', () => {
    let mockRequest;
    let context;

    beforeEach(() => {
      mockRequest = new global.Request('http://localhost:3000/api/test', {
        method: 'GET',
      });
      context = createRequestContext(mockRequest);
    });

    it('应该向栈中添加中间件', () => {
      const stack = new MiddlewareStack();
      const mockMiddleware = jest.fn();

      const result = stack.use(mockMiddleware);

      expect(result).toBe(stack);
      expect(stack.middlewares).toContain(mockMiddleware);
    });

    it('应该允许链式添加多个中间件', () => {
      const stack = new MiddlewareStack();
      const middleware1 = jest.fn();
      const middleware2 = jest.fn();
      const middleware3 = jest.fn();

      stack.use(middleware1).use(middleware2).use(middleware3);

      expect(stack.middlewares).toEqual([
        middleware1,
        middleware2,
        middleware3,
      ]);
    });

    it('应该执行单个中间件', async () => {
      const stack = new MiddlewareStack();
      const mockMiddleware = jest.fn();

      stack.use(mockMiddleware);

      const result = await stack.execute(mockRequest, context);

      expect(mockMiddleware).toHaveBeenCalledWith(mockRequest, context, expect.any(Object));
      expect(result).toBeDefined();
    });

    it('应该按顺序执行多个中间件', async () => {
      const stack = new MiddlewareStack();
      const executionOrder = [];

      const middleware1 = jest.fn().mockImplementation(async (req, ctx, response) => {
        executionOrder.push(1);
        // 不返回response以继续到下一个
      });

      const middleware2 = jest.fn().mockImplementation(async (req, ctx, response) => {
        executionOrder.push(2);
      });

      stack.use(middleware1).use(middleware2);

      const result = await stack.execute(mockRequest, context);

      expect(executionOrder).toEqual([1, 2]);
      expect(middleware1).toHaveBeenCalledWith(mockRequest, context, expect.any(Object));
      expect(middleware2).toHaveBeenCalledWith(mockRequest, context, expect.any(Object));
    });
  });
});
