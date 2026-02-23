import { NextRequest } from 'next/server';
import {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  InternalServerError,
} from '@/app/api/lib/errors/api-error';
import {
  handleApiError,
  withErrorHandler,
  withErrorHandling,
} from '@/app/api/lib/errors/error-handler';

// Mock console.error to test error logging
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('API Error Handling', () => {
  beforeEach(() => {
    mockConsoleError.mockClear();
  });

  describe('ApiError', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError(400, 'TEST_ERROR', 'Test message', {
        field: 'value',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApiError');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should convert to NextResponse with correct format', async () => {
      const error = new ApiError(400, 'TEST_ERROR', 'Test message', {
        field: 'value',
      });
      const response = error.toResponse();

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData).toEqual({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test message',
          details: { field: 'value' },
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle error without details', async () => {
      const error = new ApiError(500, 'INTERNAL_ERROR', 'Server error');
      const response = error.toResponse();

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.details).toBeUndefined();
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with correct status code', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should handle ValidationError without details', () => {
      const error = new ValidationError('Invalid input');

      expect(error.details).toBeUndefined();
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError with default resource', () => {
      const error = new NotFoundError();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
    });

    it('should create NotFoundError with custom resource', () => {
      const error = new NotFoundError('User');

      expect(error.message).toBe('User not found');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create UnauthorizedError with default message', () => {
      const error = new UnauthorizedError();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized');
    });

    it('should create UnauthorizedError with custom message', () => {
      const error = new UnauthorizedError('Invalid credentials');

      expect(error.message).toBe('Invalid credentials');
    });
  });

  describe('ForbiddenError', () => {
    it('should create ForbiddenError with default message', () => {
      const error = new ForbiddenError();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Forbidden');
    });

    it('should create ForbiddenError with custom message', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.message).toBe('Access denied');
    });
  });

  describe('InternalServerError', () => {
    it('should create InternalServerError with default message', () => {
      const error = new InternalServerError();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.message).toBe('Internal server error');
    });

    it('should create InternalServerError with custom message', () => {
      const error = new InternalServerError('Database connection failed');

      expect(error.message).toBe('Database connection failed');
    });

    it('should handle InternalServerError with details', () => {
      const error = new InternalServerError('Database error', {
        query: 'SELECT * FROM users',
      });

      expect(error.details).toEqual({ query: 'SELECT * FROM users' });
    });
  });

  describe('handleApiError', () => {
    let mockRequest: NextRequest;

    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });
    });

    it('should handle ApiError correctly', async () => {
      const error = new ApiError(400, 'TEST_ERROR', 'Test error');
      const response = handleApiError(error, mockRequest);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('TEST_ERROR');
      expect(responseData.error.message).toBe('Test error');
    });

    it('should log error to console', async () => {
      const error = new ApiError(400, 'TEST_ERROR', 'Test error');
      handleApiError(error, mockRequest);

      expect(mockConsoleError).toHaveBeenCalledWith('API Error:', {
        error: 'Test error',
        stack: expect.any(String),
        url: 'http://localhost:3000/api/test',
        method: 'GET',
        timestamp: expect.any(String),
      });
    });

    it('should handle Zod validation error', async () => {
      const zodError = {
        issues: [
          { path: ['email'], message: 'Invalid email' },
          { path: ['password'], message: 'Password too short' },
        ],
      };

      const response = handleApiError(zodError, mockRequest);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe('VALIDATION_ERROR');
      expect(responseData.error.message).toBe('Request validation failed');
      expect(responseData.error.details.validationErrors).toEqual(
        zodError.issues
      );
    });

    it('should handle Prisma P2002 error (duplicate entry)', async () => {
      const prismaError = {
        code: 'P2002',
        message: 'Unique constraint failed',
      };

      const response = handleApiError(prismaError, mockRequest);

      expect(response.status).toBe(409);
      const responseData = await response.json();
      expect(responseData.error.code).toBe('DUPLICATE_ENTRY');
      expect(responseData.error.message).toBe('Resource already exists');
    });

    it('should handle Prisma P2025 error (not found)', async () => {
      const prismaError = { code: 'P2025', message: 'Record not found' };

      const response = handleApiError(prismaError, mockRequest);

      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error.code).toBe('NOT_FOUND');
      expect(responseData.error.message).toBe('Resource not found');
    });

    it('should handle unknown Prisma error', async () => {
      const prismaError = { code: 'P9999', message: 'Unknown Prisma error' };

      const response = handleApiError(prismaError, mockRequest);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle generic Error', async () => {
      const error = new Error('Generic error');

      const response = handleApiError(error, mockRequest);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(responseData.error.message).toBe('Generic error');
    });

    it('should handle unknown error', async () => {
      const error = 'String error';

      const response = handleApiError(error, mockRequest);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(responseData.error.message).toBe('Unknown error');
    });

    it('should hide error details in production', async () => {
      // 使用 Jest mock 来模拟环境变量
      const __originalNodeEnv = process.env.NODE_ENV;

      // Mock process.env.NODE_ENV
      const mockProcessEnv = {
        ...process.env,
        NODE_ENV: 'production',
      };

      // 临时替换 process.env
      const originalProcessEnv = process.env;
      (process as any).env = mockProcessEnv;

      try {
        const error = new Error('Sensitive error details');
        const response = handleApiError(error, mockRequest);

        const responseData = await response.json();
        expect(responseData.error.message).toBe('Internal server error');
      } finally {
        // 恢复原始 process.env
        (process as any).env = originalProcessEnv;
      }
    });

    it('should show error details in development', async () => {
      // 使用 Jest mock 来模拟环境变量
      const __originalNodeEnv = process.env.NODE_ENV;

      // Mock process.env.NODE_ENV
      const mockProcessEnv = {
        ...process.env,
        NODE_ENV: 'development',
      };

      // 临时替换 process.env
      const originalProcessEnv = process.env;
      (process as any).env = mockProcessEnv;

      try {
        const error = new Error('Development error details');
        const response = handleApiError(error, mockRequest);

        const responseData = await response.json();
        expect(responseData.error.message).toBe('Development error details');
      } finally {
        // 恢复原始 process.env
        (process as any).env = originalProcessEnv;
      }
    });
  });

  describe('withErrorHandler', () => {
    let mockRequest: NextRequest;

    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });
    });

    it('should wrap handler and handle errors', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const wrappedHandler = withErrorHandler(handler);

      const response = await wrappedHandler(mockRequest);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should pass through successful responses', async () => {
      const mockResponse = {
        status: 200,
        json: jest.fn().mockReturnValue({ success: true }),
      };
      const handler = jest.fn().mockResolvedValue(mockResponse);
      const wrappedHandler = withErrorHandler(handler);

      const response = await wrappedHandler(mockRequest);

      expect(response).toBe(mockResponse);
      expect(handler).toHaveBeenCalledWith(mockRequest);
    });

    it('should handle async errors', async () => {
      const handler = async () => {
        throw new ValidationError('Async validation error');
      };
      const wrappedHandler = withErrorHandler(handler);

      const response = await wrappedHandler(mockRequest);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('withErrorHandling', () => {
    let mockRequest: NextRequest;

    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });
    });

    it('should return [result, null] on success', async () => {
      const promise = Promise.resolve({ data: 'success' });
      const [result, error] = await withErrorHandling(promise, mockRequest);

      expect(result).toEqual({ data: 'success' });
      expect(error).toBeNull();
    });

    it('should return [null, response] on error', async () => {
      const promise = Promise.reject(new Error('Promise error'));
      const [result, error] = await withErrorHandling(promise, mockRequest);

      expect(result).toBeNull();
      expect(error).toBeDefined();
      expect(error.status).toBe(500);
    });

    it('should handle ApiError in promise rejection', async () => {
      const promise = Promise.reject(new NotFoundError('Test resource'));
      const [result, error] = await withErrorHandling(promise, mockRequest);

      expect(result).toBeNull();
      expect(error.status).toBe(404);
      const responseData = await error.json();
      expect(responseData.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Error Response Format', () => {
    it('should include timestamp in all error responses', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const errors = [
        new ApiError(400, 'TEST', 'Test error'),
        new ValidationError('Validation error'),
        new NotFoundError('Test resource'),
      ];

      for (const error of errors) {
        const response = handleApiError(error, mockRequest);
        const responseData = await response.json();
        expect(responseData.error.timestamp).toBeDefined();
        expect(new Date(responseData.error.timestamp)).toBeInstanceOf(Date);
      }
    });

    it('should maintain consistent error response structure', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      const error = new ApiError(400, 'TEST_ERROR', 'Test message', {
        detail: 'value',
      });
      const response = handleApiError(error, mockRequest);
      const responseData = await response.json();

      expect(responseData).toHaveProperty('success', false);
      expect(responseData).toHaveProperty('error');
      expect(responseData.error).toHaveProperty('code');
      expect(responseData.error).toHaveProperty('message');
      expect(responseData.error).toHaveProperty('timestamp');
    });
  });
});
