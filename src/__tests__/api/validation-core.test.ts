import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ValidationError } from '@/app/api/lib/errors/api-error';
import {
  validateRequestBody,
  validateQueryParams,
  validatePathParams,
  validatePathParam,
  validateRequest,
} from '@/app/api/lib/validation/core';

describe('Validation Core', () => {
  describe('validateRequestBody', () => {
    let mockRequest: NextRequest;

    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should validate correct request body', async () => {
      const schema = z.object({
        test: z.string(),
      });

      const result = await validateRequestBody(mockRequest, schema);
      expect(result).toEqual({ test: 'data' });
    });

    it('should throw ValidationError for Zod validation errors', async () => {
      const schema = z.object({
        test: z.string(),
        required: z.string(),
      });

      await expect(validateRequestBody(mockRequest, schema)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for invalid JSON', async () => {
      // Create a request with invalid JSON
      const invalidRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: 'invalid json{',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const schema = z.object({ test: z.string() });

      await expect(validateRequestBody(invalidRequest, schema)).rejects.toThrow(
        ValidationError
      );
      await expect(validateRequestBody(invalidRequest, schema)).rejects.toThrow(
        'Invalid JSON in request body'
      );
    });

    it('should throw ValidationError for malformed JSON that throws during parsing', async () => {
      // Create a request that will cause JSON.parse to throw a non-ZodError
      const malformedRequest = new NextRequest(
        'http://localhost:3000/api/test',
        {
          method: 'POST',
          body: '{"test": "data"', // Valid JSON but we'll mock json() to throw a different error
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Mock the json method to throw a non-ZodError
      const originalJson = malformedRequest.json;
      malformedRequest.json = jest
        .fn()
        .mockRejectedValue(new Error('Unexpected token'));

      const schema = z.object({ test: z.string() });

      await expect(
        validateRequestBody(malformedRequest, schema)
      ).rejects.toThrow(ValidationError);
      await expect(
        validateRequestBody(malformedRequest, schema)
      ).rejects.toThrow('Invalid JSON in request body');

      // Restore original method
      malformedRequest.json = originalJson;
    });

    it('should handle empty request body', async () => {
      const emptyRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: '',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const schema = z.object({ test: z.string() });

      await expect(validateRequestBody(emptyRequest, schema)).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle complex nested objects', async () => {
      const complexRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({
          user: {
            name: 'John',
            profile: {
              age: 30,
              settings: {
                theme: 'dark',
                notifications: true,
              },
            },
          },
          items: [1, 2, 3],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const schema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            age: z.number(),
            settings: z.object({
              theme: z.string(),
              notifications: z.boolean(),
            }),
          }),
        }),
        items: z.array(z.number()),
      });

      const result = await validateRequestBody(complexRequest, schema);
      expect(result).toEqual({
        user: {
          name: 'John',
          profile: {
            age: 30,
            settings: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        items: [1, 2, 3],
      });
    });
  });

  describe('validateQueryParams', () => {
    it('should validate simple query parameters', () => {
      const url = 'http://localhost:3000/api/test?name=John&age=30';
      const mockRequest = new NextRequest(url);
      const schema = z.object({
        name: z.string(),
        age: z.string(),
      });

      const result = validateQueryParams(mockRequest, schema);
      expect(result).toEqual({ name: 'John', age: '30' });
    });

    it('should handle array parameters', () => {
      const url =
        'http://localhost:3000/api/test?tags=tag1&tags=tag2&tags=tag3';
      const mockRequest = new NextRequest(url);
      const schema = z.object({
        tags: z.array(z.string()),
      });

      const result = validateQueryParams(mockRequest, schema);
      expect(result).toEqual({ tags: ['tag1', 'tag2', 'tag3'] });
    });

    it('should handle mixed array and single parameters', () => {
      const url =
        'http://localhost:3000/api/test?name=John&tags=tag1&tags=tag2&age=30';
      const mockRequest = new NextRequest(url);
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()),
        age: z.string(),
      });

      const result = validateQueryParams(mockRequest, schema);
      expect(result).toEqual({
        name: 'John',
        tags: ['tag1', 'tag2'],
        age: '30',
      });
    });

    it('should throw ValidationError for Zod validation errors', () => {
      const url = 'http://localhost:3000/api/test?name=John';
      const mockRequest = new NextRequest(url);
      const schema = z.object({
        name: z.string(),
        age: z.string().min(1, 'Age is required'),
      });

      expect(() => validateQueryParams(mockRequest, schema)).toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for invalid URL format', () => {
      // Create a mock request with invalid URL
      const mockRequest = {
        url: 'invalid-url',
      } as NextRequest;
      const schema = z.object({});

      expect(() => validateQueryParams(mockRequest, schema)).toThrow(
        ValidationError
      );
      expect(() => validateQueryParams(mockRequest, schema)).toThrow(
        'Invalid query parameters'
      );
    });

    it('should throw ValidationError for URL parsing errors', () => {
      // Create a mock request that will cause URL constructor to throw
      const mockRequest = {
        url: null, // This will cause URL parsing to fail
      } as NextRequest;
      const schema = z.object({});

      expect(() => validateQueryParams(mockRequest, schema)).toThrow(
        ValidationError
      );
      expect(() => validateQueryParams(mockRequest, schema)).toThrow(
        'Invalid query parameters'
      );
    });

    it('should handle encoded query parameters', () => {
      const url =
        'http://localhost:3000/api/test?name=John%20Doe&message=Hello%20World';
      const mockRequest = new NextRequest(url);
      const schema = z.object({
        name: z.string(),
        message: z.string(),
      });

      const result = validateQueryParams(mockRequest, schema);
      expect(result).toEqual({ name: 'John Doe', message: 'Hello World' });
    });

    it('should handle empty query parameters', () => {
      const url = 'http://localhost:3000/api/test';
      const mockRequest = new NextRequest(url);
      const schema = z.object({});

      const result = validateQueryParams(mockRequest, schema);
      expect(result).toEqual({});
    });
  });

  describe('validatePathParams', () => {
    it('should validate correct path parameters', () => {
      const params = { id: '123', name: 'John' };
      const schema = z.object({
        id: z.string(),
        name: z.string(),
      });

      const result = validatePathParams(params, schema);
      expect(result).toEqual(params);
    });

    it('should throw ValidationError for Zod validation errors', () => {
      const params = { id: 'invalid-uuid' };
      const schema = z.object({
        id: z.string().uuid('Invalid UUID format'),
      });

      expect(() => validatePathParams(params, schema)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid parameters', () => {
      const params = null as any;
      const schema = z.object({
        id: z.string(),
      });

      expect(() => validatePathParams(params, schema)).toThrow(ValidationError);
      expect(() => validatePathParams(params, schema)).toThrow(
        'Path parameters validation failed'
      );
    });

    it('should handle nested object validation', () => {
      const params = {
        user: { id: '123', name: 'John' },
        filters: { active: true, role: 'admin' },
      };
      const schema = z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
        }),
        filters: z.object({
          active: z.boolean(),
          role: z.string(),
        }),
      });

      const result = validatePathParams(params, schema);
      expect(result).toEqual(params);
    });
  });

  describe('validatePathParam', () => {
    it('should validate single path parameter', () => {
      const param = '123';
      const schema = z.string().transform(Number);

      const result = validatePathParam(param, schema);
      expect(result).toBe(123);
    });

    it('should throw ValidationError for invalid single parameter', () => {
      const param = 'invalid-uuid';
      const schema = z.string().uuid('Invalid UUID');

      expect(() => validatePathParam(param, schema)).toThrow(ValidationError);
    });

    it('should handle null parameter', () => {
      const param = null;
      const schema = z.string();

      expect(() => validatePathParam(param, schema)).toThrow(ValidationError);
      expect(() => validatePathParam(param, schema)).toThrow(
        'Path parameter validation failed'
      );
    });

    it('should handle undefined parameter', () => {
      const param = undefined;
      const schema = z.string();

      expect(() => validatePathParam(param, schema)).toThrow(ValidationError);
    });

    it('should handle complex transformations', () => {
      const param = '2023-12-22';
      const schema = z.string().transform(str => new Date(str));

      const result = validatePathParam(param, schema);
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2023);
    });
  });

  describe('validateRequest', () => {
    let mockRequest: NextRequest;

    beforeEach(() => {
      mockRequest = new NextRequest('http://localhost:3000/api/test?id=123', {
        method: 'POST',
        body: JSON.stringify({ name: 'John' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should validate body only', async () => {
      const bodySchema = z.object({ name: z.string() });
      const validateFn = validateRequest(bodySchema);

      const result = await validateFn(mockRequest);

      expect(result.body).toEqual({ name: 'John' });
      expect(result.query).toBeUndefined();
      expect(result.params).toBeUndefined();
    });

    it('should validate query only', async () => {
      const querySchema = z.object({ id: z.string() });
      const validateFn = validateRequest(undefined, querySchema);

      const result = await validateFn(mockRequest);

      expect(result.query).toEqual({ id: '123' });
      expect(result.body).toBeUndefined();
      expect(result.params).toBeUndefined();
    });

    it('should validate path params only', async () => {
      const pathSchema = z.object({ id: z.string() });
      const context = { params: { id: '123' } };
      const validateFn = validateRequest(undefined, undefined, pathSchema);

      const result = await validateFn(mockRequest, context);

      expect(result.params).toEqual({ id: '123' });
      expect(result.body).toBeUndefined();
      expect(result.query).toBeUndefined();
    });

    it('should validate body and query', async () => {
      const bodySchema = z.object({ name: z.string() });
      const querySchema = z.object({ id: z.string() });
      const validateFn = validateRequest(bodySchema, querySchema);

      const result = await validateFn(mockRequest);

      expect(result.body).toEqual({ name: 'John' });
      expect(result.query).toEqual({ id: '123' });
      expect(result.params).toBeUndefined();
    });

    it('should validate all three types', async () => {
      const bodySchema = z.object({ name: z.string() });
      const querySchema = z.object({ id: z.string() });
      const pathSchema = z.object({ userId: z.string() });
      const context = { params: { userId: '456' } };
      const validateFn = validateRequest(bodySchema, querySchema, pathSchema);

      const result = await validateFn(mockRequest, context);

      expect(result.body).toEqual({ name: 'John' });
      expect(result.query).toEqual({ id: '123' });
      expect(result.params).toEqual({ userId: '456' });
    });

    it('should handle missing context for path validation', async () => {
      const pathSchema = z.object({ id: z.string() });
      const validateFn = validateRequest(undefined, undefined, pathSchema);

      const result = await validateFn(mockRequest, undefined);

      expect(result.params).toBeUndefined();
    });

    it('should handle missing params in context', async () => {
      const pathSchema = z.object({ id: z.string() });
      const context = {} as any;
      const validateFn = validateRequest(undefined, undefined, pathSchema);

      const result = await validateFn(mockRequest, context);

      expect(result.params).toBeUndefined();
    });

    it('should propagate validation errors from body', async () => {
      const bodySchema = z.object({ name: z.string().min(5) });
      const validateFn = validateRequest(bodySchema);

      await expect(validateFn(mockRequest)).rejects.toThrow(ValidationError);
    });

    it('should propagate validation errors from query', async () => {
      const querySchema = z.object({ id: z.string().uuid() });
      const validateFn = validateRequest(undefined, querySchema);

      await expect(validateFn(mockRequest)).rejects.toThrow(ValidationError);
    });

    it('should propagate validation errors from params', async () => {
      const pathSchema = z.object({ id: z.string().uuid() });
      const context = { params: { id: 'invalid-uuid' } };
      const validateFn = validateRequest(undefined, undefined, pathSchema);

      await expect(validateFn(mockRequest, context)).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle no schemas provided', async () => {
      const validateFn = validateRequest();

      const result = await validateFn(mockRequest);

      expect(result.body).toBeUndefined();
      expect(result.query).toBeUndefined();
      expect(result.params).toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed request body with extra whitespace', async () => {
      const malformedRequest = new NextRequest(
        'http://localhost:3000/api/test',
        {
          method: 'POST',
          body: '   {"test": "data"}   ',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const schema = z.object({ test: z.string() });
      const result = await validateRequestBody(malformedRequest, schema);
      expect(result).toEqual({ test: 'data' });
    });

    it('should handle very large query parameter values', () => {
      const largeValue = 'a'.repeat(10000);
      const url = `http://localhost:3000/api/test?data=${largeValue}`;
      const mockRequest = new NextRequest(url);
      const schema = z.object({
        data: z.string(),
      });

      const result = validateQueryParams(mockRequest, schema);
      expect(result.data).toBe(largeValue);
    });

    it('should handle special characters in query parameters', () => {
      const url =
        'http://localhost:3000/api/test?name=John%26Doe&symbol=%E2%9C%93';
      const mockRequest = new NextRequest(url);
      const schema = z.object({
        name: z.string(),
        symbol: z.string(),
      });

      const result = validateQueryParams(mockRequest, schema);
      expect(result.name).toBe('John&Doe');
      expect(result.symbol).toBe('✓');
    });
  });
});
